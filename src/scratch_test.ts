import { createFileRegistry } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';

const registry = createFileRegistry({
  $typeName: 'google.protobuf.FileDescriptorSet',
  file: [],
} as any);

const serviceDesc = registry.getService('connectrpc.eliza.v1.ElizaService');
if (serviceDesc) {
  const transport = createConnectTransport({
    baseUrl: 'http://localhost:8080',
  });
  const client = createClient(serviceDesc, transport);
  console.log(client);
}
