import { fromBinary, createFileRegistry, toBinary, create, toJsonString } from '@bufbuild/protobuf';
import { FileDescriptorProtoSchema, FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt';
import { attachComments } from './descriptor-loader';
import { getProxiedUrlAndHeaders, resolveUrl } from './proxy';
import { ServerReflectionRequestSchema, ServerReflectionResponseSchema } from '../gen/grpc/reflection/v1alpha/reflection_pb';

export const ServerReflectionRequest = ServerReflectionRequestSchema;
export const ServerReflectionResponse = ServerReflectionResponseSchema;

export interface ReflectionService {
  name: string;
}

export interface ReflectionFileDescriptor {
  name: string;
  package: string;
  dependency: string[];
  messageType: any[];
  enumType: any[];
  service: any[];
  syntax: string;
}

/**
 * Encodes a message with the 5-byte gRPC-Web/Connect stream envelope.
 */
function encodeStreamMessage(bytes: Uint8Array): Uint8Array {
  const body = new Uint8Array(5 + bytes.length);
  body[0] = 0x00; // Flag: 0x00 (data)
  const view = new DataView(body.buffer);
  view.setUint32(1, bytes.length, false); // Length (big-endian)
  body.set(bytes, 5);
  return body;
}

/**
 * Decodes messages from a gRPC-Web/Connect stream response.
 */
function decodeStreamResponse(buf: ArrayBuffer, schema: any): any[] {
  const resBytes = new Uint8Array(buf);
  let offset = 0;
  const responses: any[] = [];

  while (offset < resBytes.length) {
    if (offset + 5 > resBytes.length) break;
    const flag = resBytes[offset];
    const lenView = new DataView(resBytes.buffer, resBytes.byteOffset + offset + 1, 4);
    const len = lenView.getUint32(0, false);
    
    if (offset + 5 + len > resBytes.length) break;
    
    // Only process data messages (flag 0x00)
    if (flag === 0x00) {
      const msgBytes = resBytes.subarray(offset + 5, offset + 5 + len);
      try {
        responses.push(fromBinary(schema, msgBytes));
      } catch (err) {
        console.error('Error decoding message at offset', offset, err);
      }
    }
    offset += 5 + len;
  }
  return responses;
}

/**
 * Performs a reflection call to a gRPC-Web or Connect endpoint.
 */
async function reflectionCall(
  baseUrl: string,
  servicePath: string,
  requestPayload: any,
  loadingMethod: 'grpc-web' | 'connect' | 'grpc'
): Promise<any[]> {
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const url = `${normalizedUrl}/${servicePath}/ServerReflectionInfo`;

  const requestMessage = create(ServerReflectionRequest, requestPayload);
  const binaryReq = toBinary(ServerReflectionRequest, requestMessage);
  const body = encodeStreamMessage(binaryReq);

  const headers: Record<string, string> = {};
  if (loadingMethod === 'grpc-web' || loadingMethod === 'grpc') {
    headers['Content-Type'] = 'application/grpc-web+proto';
    headers['X-Grpc-Web'] = '1';
    if (loadingMethod === 'grpc') {
      headers['X-Translate-To-Grpc'] = 'true';
    }
  } else {
    headers['Content-Type'] = 'application/connect+proto';
    headers['Connect-Protocol-Version'] = '1';
  }

  const proxied = getProxiedUrlAndHeaders(url, headers);
  const res = await fetch(proxied.url, {
    method: 'POST',
    headers: proxied.headers,
    body: body as any,
  });

  if (!res.ok) {
    throw new Error(`Server returned HTTP ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return decodeStreamResponse(arrayBuf, ServerReflectionResponse);
}

/**
 * Queries reflection API to list all services and download their file descriptors.
 */
export async function loadSchemaFromReflection(
  baseUrl: string,
  loadingMethod: 'grpc-web' | 'connect' | 'grpc'
): Promise<any> {
  // We try v1alpha first, then fallback to v1 reflection paths if v1alpha fails (common on Connect servers)
  let servicePath = 'grpc.reflection.v1alpha.ServerReflection';
  let listRes: any[];

  try {
    const listReq = {
      host: new URL(baseUrl).host,
      messageRequest: { case: 'listServices', value: '' },
    };
    listRes = await reflectionCall(baseUrl, servicePath, listReq, loadingMethod);
  } catch (err) {
    console.warn('v1alpha reflection failed, trying v1 reflection:', err);
    servicePath = 'grpc.reflection.v1.ServerReflection';
    const listReq = {
      host: new URL(baseUrl).host,
      messageRequest: { case: 'listServices', value: '' },
    };
    listRes = await reflectionCall(baseUrl, servicePath, listReq, loadingMethod);
  }

  const serviceResponse = listRes[0]?.messageResponse?.value;
  if (!serviceResponse || !serviceResponse.service) {
    throw new Error('Reflection endpoint returned empty service list');
  }

  const services: string[] = serviceResponse.service.map((s: any) => s.name);
  const fileDescriptors = new Map<string, any>();

  // Fetch and merge well-known types
  try {
    const res = await fetch(resolveUrl('/wellknowntypes.binpb'));
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const descriptorSet = fromBinary(FileDescriptorSetSchema, bytes);
      for (const fd of descriptorSet.file) {
        fileDescriptors.set(fd.name, fd);
      }
    } else {
      console.warn(`Non-fatal warning: Failed to fetch /wellknowntypes.binpb: HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn('Non-fatal warning: Failed to load well-known types:', err);
  }

  // Fetch descriptors for all non-reflection services
  for (const svc of services) {
    if (
      svc === 'grpc.reflection.v1alpha.ServerReflection' ||
      svc === 'grpc.reflection.v1.ServerReflection'
    ) {
      continue;
    }

    const fileReq = {
      host: new URL(baseUrl).host,
      messageRequest: { case: 'fileContainingSymbol', value: svc },
    };

    try {
      const fileRes = await reflectionCall(baseUrl, servicePath, fileReq, loadingMethod);
      const fdr = fileRes[0]?.messageResponse?.value?.fileDescriptorProto;
      if (fdr) {
        // Load into registry to parse them as file descriptors
        if (FileDescriptorProtoSchema) {
          for (const fBytes of fdr) {
            const fd = fromBinary(FileDescriptorProtoSchema, fBytes) as any;
            fileDescriptors.set(fd.name, fd);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to load descriptors for service ${svc}:`, err);
    }
  }

  if (fileDescriptors.size === 0) {
    throw new Error('No service file descriptors could be fetched');
  }

  // Convert FileDescriptorProto messages to JSON representation
  // Create a unified registry from the fetched file descriptors map to resolve custom options
  const unifiedFds = {
    $typeName: 'google.protobuf.FileDescriptorSet',
    file: Array.from(fileDescriptors.values())
  };
  const fetchedRegistry = createFileRegistry(unifiedFds as any);

  const fileList = Array.from(fileDescriptors.values()).map(fd => {
    // Generate JSON representation, passing registry to resolve custom options
    const jsonStr = toJsonString(FileDescriptorProtoSchema, fd, { registry: fetchedRegistry, enumAsInteger: true });
    const fileObj = JSON.parse(jsonStr);
    attachComments(fileObj);
    return fileObj;
  });

  return { file: fileList };
}

