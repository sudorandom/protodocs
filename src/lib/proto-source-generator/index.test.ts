import { describe, it, expect } from 'vitest';
import { generateSource } from './index';
import { type Message, type Enum, type Service, type Extension } from '../../types';

describe('generateSource', () => {
  it('should generate source for a simple message', () => {
    const message: Message = {
      name: 'TestMessage',
      description: 'A simple test message.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, description: 'A test field.' },
      ],
    };
    const expectedSource = `// A simple test message.
message TestMessage {
  // A test field.
  string test_field = 1;
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with repeated fields', () => {
    const message: Message = {
      name: 'TestMessage',
      description: 'A message with repeated fields.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, description: 'A repeated string field.', isRepeated: true },
      ],
    };
    const expectedSource = `// A message with repeated fields.
message TestMessage {
  // A repeated string field.
  repeated string test_field = 1;
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with map fields', () => {
    const message: Message = {
      name: 'TestMessage',
      description: 'A message with map fields.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, description: 'A map field.', isMap: true, keyType: 'string', valueType: 'int32' },
      ],
    };
    const expectedSource = `// A message with map fields.
message TestMessage {
  // A map field.
  map<string, int32> test_field = 1;
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a simple enum', () => {
    const enumItem: Enum = {
      name: 'TestEnum',
      description: 'A simple test enum.',
      values: [
        { name: 'TEST_VALUE', value: 0, description: 'A test value.' },
      ],
    };
    const expectedSource = `// A simple test enum.
enum TestEnum {
  // A test value.
  TEST_VALUE = 0;
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(enumItem, 'enums', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a simple service', () => {
    const service: Service = {
      name: 'TestService',
      description: 'A simple test service.',
      rpcs: [
        { name: 'TestRPC', request: 'TestRequest', response: 'TestResponse', description: 'A test RPC.' },
      ],
    };
    const expectedSource = `// A simple test service.
service TestService {
  // A test RPC.
  rpc TestRPC (TestRequest) returns (TestResponse);
}`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(service, 'services', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a service with streaming', () => {
    const service: Service = {
        name: 'TestService',
        description: 'A test service with streaming.',
        rpcs: [
            { name: 'ClientStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A client streaming RPC.', isClientStream: true },
            { name: 'ServerStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A server streaming RPC.', isServerStream: true },
            { name: 'BidiStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A bidi streaming RPC.', isClientStream: true, isServerStream: true },
        ],
    };
    const expectedSource = `// A test service with streaming.
service TestService {
  // A client streaming RPC.
  rpc ClientStreamingRPC (stream TestRequest) returns (TestResponse);
  // A server streaming RPC.
  rpc ServerStreamingRPC (TestRequest) returns (stream TestResponse);
  // A bidi streaming RPC.
  rpc BidiStreamingRPC (stream TestRequest) returns (stream TestResponse);
}`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(service, 'services', protoPackage, allTypes)).toBe(expectedSource);
});


  it('should generate source for a simple extension', () => {
    const extension: Extension = {
      name: 'test_extension',
      type: 'string',
      tag: 123,
      description: 'A simple test extension.',
      extendee: 'TestMessage',
    };
    const expectedSource = `// A simple test extension.
extend TestMessage {
  string test_extension = 123;
}`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(extension, 'extensions', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with a nested message', () => {
    const message: Message = {
      name: 'OuterMessage',
      description: 'An outer message.',
      fields: [],
      nestedMessages: [
        {
          name: 'InnerMessage',
          description: 'An inner message.',
          fields: [
            { name: 'inner_field', type: 'int32', tag: 1, description: 'An inner field.' },
          ],
        },
      ],
    };
    const expectedSource = `// An outer message.
message OuterMessage {

  // An inner message.
  message InnerMessage {
    // An inner field.
    int32 inner_field = 1;
  }
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with a nested enum', () => {
    const message: Message = {
      name: 'TestMessage',
      description: 'A message with a nested enum.',
      fields: [],
      nestedEnums: [
        {
          name: 'NestedEnum',
          description: 'A nested enum.',
          values: [
            { name: 'NESTED_VALUE', value: 0, description: 'A nested value.' },
          ],
        },
      ],
    };
    const expectedSource = `// A message with a nested enum.
message TestMessage {

  // A nested enum.
  enum NestedEnum {
    // A nested value.
    NESTED_VALUE = 0;
  }
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should handle multiple levels of nesting', () => {
    const message: Message = {
      name: 'L1',
      description: 'Level 1 message.',
      fields: [],
      nestedMessages: [
        {
          name: 'L2',
          description: 'Level 2 message.',
          fields: [],
          nestedMessages: [
            {
              name: 'L3',
              description: 'Level 3 message.',
              fields: [
                { name: 'l3_field', type: 'bool', tag: 1, description: 'A level 3 field.' },
              ],
            },
          ],
        },
      ],
    };
    const expectedSource = `// Level 1 message.
message L1 {

  // Level 2 message.
  message L2 {

    // Level 3 message.
    message L3 {
      // A level 3 field.
      bool l3_field = 1;
    }
  }
}
`;
    const allTypes = new Map();
    const protoPackage = { name: 'test', files: [] };
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });
});
