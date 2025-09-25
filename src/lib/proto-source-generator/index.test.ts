import { describe, it, expect } from 'vitest';
import { generateSource } from './index';
import { type Message, type Enum, type Service, type Extension, type ProtoPackage } from '../../types';

const allTypes = new Map();
const protoPackage: ProtoPackage = { name: 'test', files: [] };

describe('generateSource', () => {
  it('should generate source for a simple message', () => {
    const message: Message = {
      name: 'TestMessage',
      leadingComments: 'A simple test message.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, leadingComments: 'A test field.', description: '' },
      ],
      description: ''
    };
    const expectedSource = `// A simple test message.
message TestMessage {
  // A test field.
  string test_field = 1;
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with repeated fields', () => {
    const message: Message = {
      name: 'TestMessage',
      leadingComments: 'A message with repeated fields.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, leadingComments: 'A repeated string field.', isRepeated: true, description: '' },
      ],
      description: ''
    };
    const expectedSource = `// A message with repeated fields.
message TestMessage {
  // A repeated string field.
  repeated string test_field = 1;
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with map fields', () => {
    const message: Message = {
      name: 'TestMessage',
      leadingComments: 'A message with map fields.',
      fields: [
        { name: 'test_field', type: 'string', tag: 1, leadingComments: 'A map field.', isMap: true, keyType: 'string', valueType: 'int32', description: '' },
      ],
      description: ''
    };
    const expectedSource = `// A message with map fields.
message TestMessage {
  // A map field.
  map<string, int32> test_field = 1;
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a simple enum', () => {
    const enumItem: Enum = {
      name: 'TestEnum',
      leadingComments: 'A simple test enum.',
      values: [
        { name: 'TEST_VALUE', value: 0, leadingComments: 'A test value.', description: '' },
      ],
      description: ''
    };
    const expectedSource = `// A simple test enum.
enum TestEnum {
  // A test value.
  TEST_VALUE = 0;
}`;
    expect(generateSource(enumItem, 'enums', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a simple service', () => {
    const service: Service = {
      name: 'TestService',
      leadingComments: 'A simple test service.',
      rpcs: [
        { name: 'TestRPC', request: 'TestRequest', response: 'TestResponse', leadingComments: 'A test RPC.', description: '' },
      ],
      description: ''
    };
    const expectedSource = `// A simple test service.
service TestService {
  // A test RPC.
  rpc TestRPC (TestRequest) returns (TestResponse);
}`;
    expect(generateSource(service, 'services', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a service with streaming', () => {
    const service: Service = {
        name: 'TestService',
        leadingComments: 'A test service with streaming.',
        rpcs: [
            { name: 'ClientStreamingRPC', request: 'TestRequest', response: 'TestResponse', leadingComments: 'A client streaming RPC.', isClientStream: true, description: '' },
            { name: 'ServerStreamingRPC', request: 'TestRequest', response: 'TestResponse', leadingComments: 'A server streaming RPC.', isServerStream: true, description: '' },
            { name: 'BidiStreamingRPC', request: 'TestRequest', response: 'TestResponse', leadingComments: 'A bidi streaming RPC.', isClientStream: true, isServerStream: true, description: '' },
        ],
        description: ''
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
    expect(generateSource(service, 'services', protoPackage, allTypes)).toBe(expectedSource);
});


  it('should generate source for a simple extension', () => {
    const extension: Extension = {
      name: 'test_extension',
      type: 'string',
      tag: 123,
      leadingComments: 'A simple test extension.',
      extendee: 'TestMessage',
      description: ''
    };
    const expectedSource = `// A simple test extension.
extend TestMessage {
  string test_extension = 123;
}`;
    expect(generateSource(extension, 'extensions', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with a nested message', () => {
    const message: Message = {
      name: 'OuterMessage',
      leadingComments: 'An outer message.',
      fields: [],
      nestedMessages: [
        {
          name: 'InnerMessage',
          leadingComments: 'An inner message.',
          fields: [
            { name: 'inner_field', type: 'int32', tag: 1, leadingComments: 'An inner field.', description: '' },
          ],
          description: ''
        },
      ],
      description: ''
    };
    const expectedSource = `// An outer message.
message OuterMessage {
  // An inner message.
  message InnerMessage {
    // An inner field.
    int32 inner_field = 1;
  }
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should generate source for a message with a nested enum', () => {
    const message: Message = {
      name: 'TestMessage',
      leadingComments: 'A message with a nested enum.',
      fields: [],
      nestedEnums: [
        {
          name: 'NestedEnum',
          leadingComments: 'A nested enum.',
          values: [
            { name: 'NESTED_VALUE', value: 0, leadingComments: 'A nested value.', description: '' },
          ],
          description: ''
        },
      ],
      description: ''
    };
    const expectedSource = `// A message with a nested enum.
message TestMessage {
  // A nested enum.
  enum NestedEnum {
    // A nested value.
    NESTED_VALUE = 0;
  }
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  it('should handle multiple levels of nesting', () => {
    const message: Message = {
      name: 'L1',
      leadingComments: 'Level 1 message.',
      fields: [],
      nestedMessages: [
        {
          name: 'L2',
          leadingComments: 'Level 2 message.',
          fields: [],
          nestedMessages: [
            {
              name: 'L3',
              leadingComments: 'Level 3 message.',
              fields: [
                { name: 'l3_field', type: 'bool', tag: 1, leadingComments: 'A level 3 field.', description: '' },
              ],
              description: ''
            },
          ],
          description: ''
        },
      ],
      description: ''
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
}`;
    expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
  });

  describe('Comment Generation', () => {
    it('should handle leading, trailing, and detached comments', () => {
      const message: Message = {
        name: 'CommentMessage',
        leadingDetachedComments: ['Detached comment before message.'],
        leadingComments: 'Leading comment for message.',
        trailingComments: 'Trailing comment for message.',
        fields: [
          { name: 'field1', type: 'string', tag: 1, leadingComments: 'Leading for field 1.', trailingComments: 'Trailing for field 1.', description: '' },
          { name: 'field2', type: 'int32', tag: 2, leadingDetachedComments: ['Detached before field 2.'], leadingComments: 'Leading for field 2.', description: '' },
        ],
        description: ''
      };
      const expectedSource = `// Detached comment before message.

// Leading comment for message.
message CommentMessage {
  // Leading for field 1.
  string field1 = 1; // Trailing for field 1.
  // Detached before field 2.

  // Leading for field 2.
  int32 field2 = 2;
}`;
      expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource.trim());
    });

    it('should handle multi-line comments correctly', () => {
        const enumItem: Enum = {
            name: 'MultiLineEnum',
            leadingComments: 'This is a multi-line\nleading comment for the enum.',
            values: [
                { name: 'VALUE_ONE', value: 0, trailingComments: 'This is a multi-line\ntrailing comment.', description: '' },
            ],
            description: ''
        };
        const expectedSource = `// This is a multi-line
// leading comment for the enum.
enum MultiLineEnum {
  VALUE_ONE = 0; // This is a multi-line
// trailing comment.
}`;
        expect(generateSource(enumItem, 'enums', protoPackage, allTypes)).toBe(expectedSource);
    });

    it('should not add extra newlines for items without comments', () => {
        const message: Message = {
            name: 'NoCommentMessage',
            fields: [
                { name: 'field1', type: 'string', tag: 1, description: '' },
                { name: 'field2', type: 'int32', tag: 2, description: '' },
            ],
            nestedMessages: [
                {
                    name: 'InnerNoComment',
                    fields: [
                        { name: 'inner_field', type: 'bool', tag: 1, description: '' },
                    ],
                    description: ''
                }
            ],
            description: ''
        };
        const expectedSource = `message NoCommentMessage {
  message InnerNoComment {
    bool inner_field = 1;
  }

  string field1 = 1;
  int32 field2 = 2;
}`;
        expect(generateSource(message, 'messages', protoPackage, allTypes)).toBe(expectedSource);
    });
  });
});
