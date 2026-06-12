import { fromBinary, toJsonString, fromJsonString, toBinary } from '@bufbuild/protobuf';
import { getProxiedUrlAndHeaders } from './proxy';

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
  isClientStreaming,
  onChunk,
}: {
  baseUrl: string;
  packageName: string;
  serviceName: string;
  methodName: string;
  inputFqn: string;
  outputFqn: string;
  requestJson: string;
  protocol: 'connect' | 'grpc-web' | 'grpc';
  registry: any;
  extraHeaders?: Record<string, string>;
  isServerStreaming?: boolean;
  isClientStreaming?: boolean;
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

  let requestObjs: any[] = [];
  try {
    const parsed = JSON.parse(requestJson);
    if (isClientStreaming && Array.isArray(parsed)) {
      requestObjs = parsed;
    } else {
      requestObjs = [parsed];
    }
  } catch {
    throw new Error('Invalid JSON request');
  }

  const headers: Record<string, string> = {};
  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  const proxied = getProxiedUrlAndHeaders(url, headers);

  // Use WebSocket if it's a streaming call AND we are using the local proxy
  const isStreaming = isServerStreaming || isClientStreaming;
  if (isStreaming && proxied.url === '/api/proxy') {
    return new Promise((resolve) => {
      const wsUrl = new URL('/api/proxy/ws', window.location.origin);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(wsUrl.toString());

      let isFirstMessage = true;
      let statusLine = '';
      let headerLines = '';
      let errorResponse = '';

      ws.onopen = () => {
        // Setup headers
        const wsHeaders = { ...proxied.headers };
        if (protocol === 'connect') {
          wsHeaders['Content-Type'] = 'application/connect+json';
          wsHeaders['Connect-Protocol-Version'] = '1';
        } else {
          wsHeaders['Content-Type'] = 'application/grpc-web+proto';
          wsHeaders['X-Grpc-Web'] = '1';
          if (protocol === 'grpc') {
            wsHeaders['X-Translate-To-Grpc'] = 'true';
          }
        }

        ws.send(JSON.stringify({ url, headers: wsHeaders }));

        // Send payloads
        for (const reqObj of requestObjs) {
          const parsedRequest = fromJsonString(inputSchema, JSON.stringify(reqObj));
          let payloadBytes: Uint8Array;
          if (protocol === 'connect') {
            const jsonStr = toJsonString(inputSchema, parsedRequest);
            const jsonBytes = new TextEncoder().encode(jsonStr);
            const enveloped = new Uint8Array(5 + jsonBytes.length);
            enveloped[0] = 0x00;
            const view = new DataView(enveloped.buffer);
            view.setUint32(1, jsonBytes.length, false);
            enveloped.set(jsonBytes, 5);
            payloadBytes = enveloped;
          } else {
            const binaryBytes = toBinary(inputSchema, parsedRequest);
            const enveloped = new Uint8Array(5 + binaryBytes.length);
            enveloped[0] = 0x00;
            const view = new DataView(enveloped.buffer);
            view.setUint32(1, binaryBytes.length, false);
            enveloped.set(binaryBytes, 5);
            payloadBytes = enveloped;
          }
          ws.send(payloadBytes as any);
        }

        // Signal End of Stream to proxy
        ws.send(JSON.stringify({ eos: true }));
      };

      let buffer = new Uint8Array(0);

      ws.onmessage = async (event) => {
        if (isFirstMessage && typeof event.data === 'string') {
          isFirstMessage = false;
          try {
            const msg = JSON.parse(event.data);
            if (msg.error) {
              errorResponse = msg.error;
              statusLine = `HTTP ${msg.status} Error`;
            } else {
              statusLine = `HTTP ${msg.status} OK`;
              const hLines = [];
              for (const [k, v] of Object.entries(msg.headers || {})) {
                const displayK = k;
                let displayV = v as string;
                if (protocol === 'grpc' && k.toLowerCase() === 'content-type' && displayV.startsWith('application/grpc-web')) {
                  displayV = 'application/grpc';
                }
                hLines.push(`${displayK}: ${displayV}`);
              }
              headerLines = hLines.join('\n');
            }
          } catch {
            statusLine = 'Error parsing proxy response';
          }
          return;
        }

        if (event.data instanceof Blob) {
          const chunkBytes = new Uint8Array(await event.data.arrayBuffer());
          const tmp = new Uint8Array(buffer.length + chunkBytes.length);
          tmp.set(buffer, 0);
          tmp.set(chunkBytes, buffer.length);
          buffer = tmp;

          while (buffer.length >= 5) {
            const flag = buffer[0];
            const lenView = new DataView(buffer.buffer, buffer.byteOffset + 1, 4);
            const len = lenView.getUint32(0, false);

            if (buffer.length < 5 + len) {
              break;
            }

            const payload = buffer.subarray(5, 5 + len);
            buffer = buffer.slice(5 + len);

            if (protocol === 'connect') {
              if (flag === 0) {
                const text = new TextDecoder().decode(payload);
                const jsonObj = JSON.parse(text);
                onChunk?.({ body: JSON.stringify(jsonObj, null, 2) });
              } else if (flag === 2) {
                const text = new TextDecoder().decode(payload);
                onChunk?.({ headers: `[Connect EOS]\n${text}` });
              }
            } else {
              if (flag === 0x00) {
                const decodedMsg = fromBinary(outputSchema, payload);
                const responseObj = JSON.parse(toJsonString(outputSchema, decodedMsg));
                onChunk?.({ body: JSON.stringify(responseObj, null, 2) });
              } else if (flag === 0x80) {
                const trailersText = new TextDecoder().decode(payload);
                const headersStr = protocol === 'grpc' ? trailersText : `[gRPC-Web Trailers]\n${trailersText}`;
                onChunk?.({ headers: headersStr });
              }
            }
          }
        }
      };

      ws.onclose = () => {
        resolve({
          status: statusLine || 'HTTP Stream Completed',
          headers: headerLines,
          body: errorResponse || '',
        });
      };

      ws.onerror = () => {
        resolve({
          status: 'WebSocket Error',
          headers: '',
          body: 'Connection closed unexpectedly',
        });
      };
    });
  }

  // Fallback for non-streaming or non-proxied calls
  let body: Uint8Array | string;
  const parsedRequest = fromJsonString(inputSchema, JSON.stringify(requestObjs[0]));

  if (protocol === 'connect') {
    if (isServerStreaming || isClientStreaming) {
      proxied.headers['Content-Type'] = 'application/connect+json';
      proxied.headers['Connect-Protocol-Version'] = '1';
      const jsonStr = toJsonString(inputSchema, parsedRequest);
      const jsonBytes = new TextEncoder().encode(jsonStr);
      const enveloped = new Uint8Array(5 + jsonBytes.length);
      enveloped[0] = 0x00;
      const view = new DataView(enveloped.buffer);
      view.setUint32(1, jsonBytes.length, false);
      enveloped.set(jsonBytes, 5);
      body = enveloped;
    } else {
      proxied.headers['Content-Type'] = 'application/json';
      proxied.headers['Connect-Protocol-Version'] = '1';
      body = toJsonString(inputSchema, parsedRequest);
    }
  } else {
    const binaryBytes = toBinary(inputSchema, parsedRequest);
    const enveloped = new Uint8Array(5 + binaryBytes.length);
    enveloped[0] = 0x00;
    const view = new DataView(enveloped.buffer);
    view.setUint32(1, binaryBytes.length, false);
    enveloped.set(binaryBytes, 5);

    proxied.headers['Content-Type'] = 'application/grpc-web+proto';
    proxied.headers['X-Grpc-Web'] = '1';
    if (protocol === 'grpc') {
      proxied.headers['X-Translate-To-Grpc'] = 'true';
    }
    body = enveloped;
  }

  const res = await fetch(proxied.url, {
    method: 'POST',
    headers: proxied.headers,
    body: body as any,
  });

  const headerLines = Array.from(res.headers.entries())
    .map(([k, v]) => {
      if (protocol === 'grpc' && k.toLowerCase() === 'content-type' && v.startsWith('application/grpc-web')) {
        return `${k}: application/grpc`;
      }
      return `${k}: ${v}`;
    })
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
            const headersStr = protocol === 'grpc' ? trailersText : `[gRPC-Web Trailers]\n${trailersText}`;
            onChunk?.({ headers: headersStr });
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

    const fullHeaders = protocol === 'grpc'
      ? headerLines + (trailersText ? `\n${trailersText}` : '')
      : headerLines + (trailersText ? `\n\n[gRPC-Web Trailers]\n${trailersText}` : '');

    return {
      status: `HTTP ${res.status} OK`,
      headers: fullHeaders,
      body: responseObj ? JSON.stringify(responseObj, null, 2) : '(No response data received)',
    };
  }
}
