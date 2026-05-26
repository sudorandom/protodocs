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
    // Connect Unary JSON POST
    headers['Content-Type'] = 'application/json';
    headers['Connect-Protocol-Version'] = '1';
    body = toJsonString(inputSchema, parsedRequest);
  } else {
    // gRPC-Web Binary serialization
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
