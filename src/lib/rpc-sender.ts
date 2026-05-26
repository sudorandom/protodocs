import { fromBinary, toJsonString, fromJsonString, toBinary } from '@bufbuild/protobuf';

export interface RpcResponseResult {
  status: string;
  headers: string;
  body: string;
}

/**
 * Sends a Connect (JSON) or gRPC-Web (Binary) request dynamically using
 * the compiled FileRegistry definitions.
 */
export async function sendRpcRequest({
  baseUrl,
  packageName,
  serviceName,
  methodName,
  inputFqn,
  outputFqn,
  requestJson,
  protocol,
  registry,
  extraHeaders,
  isServerStreaming,
  onChunk,
}: {
  baseUrl: string;
  packageName: string;
  serviceName: string;
  methodName: string;
  inputFqn: string;
  outputFqn: string;
  requestJson: string;
  protocol: 'connect' | 'grpc-web';
  registry: any;
  extraHeaders?: Record<string, string>;
  isServerStreaming?: boolean;
  onChunk?: (chunk: { body?: string; headers?: string }) => void;
}): Promise<RpcResponseResult> {
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
  const url = `${normalizedUrl}/${fullServiceName}/${methodName}`;

  const cleanInputFqn = inputFqn.startsWith('.') ? inputFqn.substring(1) : inputFqn;
  const cleanOutputFqn = outputFqn.startsWith('.') ? outputFqn.substring(1) : outputFqn;

  const inputSchema = registry.getMessage(cleanInputFqn);
  const outputSchema = registry.getMessage(cleanOutputFqn);

  if (!inputSchema || !outputSchema) {
    throw new Error(`Message definition schema for ${inputFqn} or ${outputFqn} was not found in active FileRegistry.`);
  }

  // 1. Parse user edited request JSON to message
  const parsedRequest = fromJsonString(inputSchema, requestJson);

  const headers: Record<string, string> = {};
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }
  let body: Uint8Array | string;

  if (protocol === 'connect') {
    if (isServerStreaming) {
      // Connect Streaming JSON POST (Request must be enveloped in Connect streaming protocol)
      headers['Content-Type'] = 'application/connect+json';
      headers['Connect-Protocol-Version'] = '1';
      
      const jsonStr = toJsonString(inputSchema, parsedRequest);
      const jsonBytes = new TextEncoder().encode(jsonStr);
      const enveloped = new Uint8Array(5 + jsonBytes.length);
      enveloped[0] = 0x00; // Flag 0: data
      const view = new DataView(enveloped.buffer);
      view.setUint32(1, jsonBytes.length, false);
      enveloped.set(jsonBytes, 5);
      body = enveloped;
    } else {
      // Connect Unary JSON POST
      headers['Content-Type'] = 'application/json';
      headers['Connect-Protocol-Version'] = '1';
      body = toJsonString(inputSchema, parsedRequest);
    }
  } else {
    // gRPC-Web Binary serialization (always enveloped)
    const binaryBytes = toBinary(inputSchema, parsedRequest);

    // Frame wrapping: 1 byte flag (0 = data), 4 bytes big-endian length
    const enveloped = new Uint8Array(5 + binaryBytes.length);
    enveloped[0] = 0x00;
    const view = new DataView(enveloped.buffer);
    view.setUint32(1, binaryBytes.length, false);
    enveloped.set(binaryBytes, 5);

    headers['Content-Type'] = 'application/grpc-web+proto';
    headers['X-Grpc-Web'] = '1';
    body = enveloped;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  const headerLines = Array.from(res.headers.entries())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    return {
      status: `HTTP ${res.status} Error`,
      headers: headerLines,
      body: errorText || `Failed to fetch: Server returned HTTP ${res.status}`,
    };
  }

  if (isServerStreaming) {
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('Response body reader not available.');
    }

    let buffer = new Uint8Array(0);
    const appendToBuffer = (newBytes: Uint8Array) => {
      const tmp = new Uint8Array(buffer.length + newBytes.length);
      tmp.set(buffer, 0);
      tmp.set(newBytes, buffer.length);
      buffer = tmp;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        appendToBuffer(value);
      }

      while (buffer.length >= 5) {
        const flag = buffer[0];
        const lenView = new DataView(buffer.buffer, buffer.byteOffset + 1, 4);
        const len = lenView.getUint32(0, false);

        if (buffer.length < 5 + len) {
          break; // wait for more data
        }

        const payload = buffer.subarray(5, 5 + len);
        buffer = buffer.slice(5 + len);

        if (protocol === 'connect') {
          if (flag === 0) {
            // Data message JSON
            const text = new TextDecoder().decode(payload);
            const jsonObj = JSON.parse(text);
            onChunk?.({ body: JSON.stringify(jsonObj, null, 2) });
          } else if (flag === 2) {
            // EOS metadata JSON
            const text = new TextDecoder().decode(payload);
            onChunk?.({ headers: `[Connect EOS]\n${text}` });
          }
        } else {
          // grpc-web
          if (flag === 0x00) {
            const decodedMsg = fromBinary(outputSchema, payload);
            const responseObj = JSON.parse(toJsonString(outputSchema, decodedMsg));
            onChunk?.({ body: JSON.stringify(responseObj, null, 2) });
          } else if (flag === 0x80) {
            const trailersText = new TextDecoder().decode(payload);
            onChunk?.({ headers: `[gRPC-Web Trailers]\n${trailersText}` });
          }
        }
      }
    }

    return {
      status: `HTTP ${res.status} Stream Completed`,
      headers: headerLines,
      body: '',
    };
  }

  if (protocol === 'connect') {
    const responseJson = await res.json();
    return {
      status: `HTTP ${res.status} OK`,
      headers: headerLines,
      body: JSON.stringify(responseJson, null, 2),
    };
  } else {
    // Decode gRPC-Web binary stream response
    const arrayBuf = await res.arrayBuffer();
    const resBytes = new Uint8Array(arrayBuf);

    let offset = 0;
    let responseObj: any = null;
    let trailersText = '';

    while (offset < resBytes.length) {
      if (offset + 5 > resBytes.length) break;
      const flag = resBytes[offset];
      const lenView = new DataView(resBytes.buffer, resBytes.byteOffset + offset + 1, 4);
      const len = lenView.getUint32(0, false);

      if (offset + 5 + len > resBytes.length) break;

      const payload = resBytes.subarray(offset + 5, offset + 5 + len);

      if (flag === 0x00) {
        // Data block
        const decodedMsg = fromBinary(outputSchema, payload);
        responseObj = JSON.parse(toJsonString(outputSchema, decodedMsg));
      } else if (flag === 0x80) {
        // Trailer block
        trailersText = new TextDecoder().decode(payload);
      }

      offset += 5 + len;
    }

    const fullHeaders = headerLines + 
      (trailersText ? `\n\n[gRPC-Web Trailers]\n${trailersText}` : '');

    return {
      status: `HTTP ${res.status} OK`,
      headers: fullHeaders,
      body: responseObj ? JSON.stringify(responseObj, null, 2) : '(No response data received)',
    };
  }
}
