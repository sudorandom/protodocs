"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var index_1 = require("./index");
(0, vitest_1.describe)('generateSource', function () {
    (0, vitest_1.it)('should generate source for a simple message', function () {
        var message = {
            name: 'TestMessage',
            description: 'A simple test message.',
            fields: [
                { name: 'test_field', type: 'string', tag: 1, description: 'A test field.' },
            ],
        };
        var expectedSource = "// A simple test message.\nmessage TestMessage {\n  // A test field.\n  string test_field = 1;\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a message with repeated fields', function () {
        var message = {
            name: 'TestMessage',
            description: 'A message with repeated fields.',
            fields: [
                { name: 'test_field', type: 'string', tag: 1, description: 'A repeated string field.', isRepeated: true },
            ],
        };
        var expectedSource = "// A message with repeated fields.\nmessage TestMessage {\n  // A repeated string field.\n  repeated string test_field = 1;\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a message with map fields', function () {
        var message = {
            name: 'TestMessage',
            description: 'A message with map fields.',
            fields: [
                { name: 'test_field', type: 'string', tag: 1, description: 'A map field.', isMap: true, keyType: 'string', valueType: 'int32' },
            ],
        };
        var expectedSource = "// A message with map fields.\nmessage TestMessage {\n  // A map field.\n  map<string, int32> test_field = 1;\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a simple enum', function () {
        var enumItem = {
            name: 'TestEnum',
            description: 'A simple test enum.',
            values: [
                { name: 'TEST_VALUE', value: 0, description: 'A test value.' },
            ],
        };
        var expectedSource = "// A simple test enum.\nenum TestEnum {\n  // A test value.\n  TEST_VALUE = 0;\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(enumItem, 'enums')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a simple service', function () {
        var service = {
            name: 'TestService',
            description: 'A simple test service.',
            rpcs: [
                { name: 'TestRPC', request: 'TestRequest', response: 'TestResponse', description: 'A test RPC.' },
            ],
        };
        var expectedSource = "// A simple test service.\nservice TestService {\n  // A test RPC.\n  rpc TestRPC (TestRequest) returns (TestResponse);\n}";
        (0, vitest_1.expect)((0, index_1.generateSource)(service, 'services')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a service with streaming', function () {
        var service = {
            name: 'TestService',
            description: 'A test service with streaming.',
            rpcs: [
                { name: 'ClientStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A client streaming RPC.', isClientStream: true },
                { name: 'ServerStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A server streaming RPC.', isServerStream: true },
                { name: 'BidiStreamingRPC', request: 'TestRequest', response: 'TestResponse', description: 'A bidi streaming RPC.', isClientStream: true, isServerStream: true },
            ],
        };
        var expectedSource = "// A test service with streaming.\nservice TestService {\n  // A client streaming RPC.\n  rpc ClientStreamingRPC (stream TestRequest) returns (TestResponse);\n  // A server streaming RPC.\n  rpc ServerStreamingRPC (TestRequest) returns (stream TestResponse);\n  // A bidi streaming RPC.\n  rpc BidiStreamingRPC (stream TestRequest) returns (stream TestResponse);\n}";
        (0, vitest_1.expect)((0, index_1.generateSource)(service, 'services')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a simple extension', function () {
        var extension = {
            name: 'test_extension',
            type: 'string',
            tag: 123,
            description: 'A simple test extension.',
            extendee: 'TestMessage',
        };
        var expectedSource = "// A simple test extension.\nextend TestMessage {\n  string test_extension = 123;\n}";
        (0, vitest_1.expect)((0, index_1.generateSource)(extension, 'extensions')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a message with a nested message', function () {
        var message = {
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
        var expectedSource = "// An outer message.\nmessage OuterMessage {\n\n  // An inner message.\n  message InnerMessage {\n    // An inner field.\n    int32 inner_field = 1;\n  }\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should generate source for a message with a nested enum', function () {
        var message = {
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
        var expectedSource = "// A message with a nested enum.\nmessage TestMessage {\n\n  // A nested enum.\n  enum NestedEnum {\n    // A nested value.\n    NESTED_VALUE = 0;\n  }\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
    (0, vitest_1.it)('should handle multiple levels of nesting', function () {
        var message = {
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
        var expectedSource = "// Level 1 message.\nmessage L1 {\n\n  // Level 2 message.\n  message L2 {\n\n    // Level 3 message.\n    message L3 {\n      // A level 3 field.\n      bool l3_field = 1;\n    }\n  }\n}\n";
        (0, vitest_1.expect)((0, index_1.generateSource)(message, 'messages')).toBe(expectedSource);
    });
});
