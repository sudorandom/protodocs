import { describe, it, expect } from 'vitest';
import { reconstructProto } from './proto-reconstructor';

describe('proto-reconstructor', () => {
  it('should reconstruct a basic proto file with sorted imports', () => {
    const file = {
      syntax: 'proto3',
      package: 'test.package',
      dependency: [
        'google/protobuf/timestamp.proto',
        'google/protobuf/duration.proto',
        'a_first.proto',
      ],
      messageType: [
        {
          name: 'MyMessage',
          field: [
            { name: 'id', number: 1, type: 9, label: 'LABEL_OPTIONAL' },
            { name: 'name', number: 2, type: 9, label: 'LABEL_OPTIONAL' },
          ],
        },
      ],
    };

    const output = reconstructProto(file);
    expect(output).toBe(
      'syntax = "proto3";\n' +
      '\n' +
      'package test.package;\n' +
      '\n' +
      'import "a_first.proto";\n' +
      'import "google/protobuf/duration.proto";\n' +
      'import "google/protobuf/timestamp.proto";\n' +
      '\n' +
      'message MyMessage {\n' +
      '  string id = 1;\n' +
      '  string name = 2;\n' +
      '}\n'
    );
  });

  it('should format and sort file options correctly', () => {
    const file = {
      syntax: 'proto3',
      package: 'test.package',
      options: {
        '[google.api.resource_definition]': 'resource_value',
        'go_package': 'github.com/test/package',
        'java_multiple_files': true,
        '[buf.validate.field]': 'field_value',
      },
    };

    const output = reconstructProto(file);
    expect(output).toBe(
      'syntax = "proto3";\n' +
      '\n' +
      'package test.package;\n' +
      '\n' +
      'option go_package = "github.com/test/package";\n' +
      'option java_multiple_files = true;\n' +
      'option (buf.validate.field) = "field_value";\n' +
      'option (google.api.resource_definition) = "resource_value";\n'
    );
  });

  it('should format message, field, oneof, enum, and service options', () => {
    const file = {
      syntax: 'proto3',
      package: 'test.package',
      messageType: [
        {
          name: 'ComplexMessage',
          options: {
            'deprecated': true,
            '[custom.msg_option]': 'val',
          },
          field: [
            {
              name: 'simple_field',
              number: 1,
              type: 9, // string
              label: 'LABEL_OPTIONAL',
              jsonName: 'custom_json_name',
              options: {
                'deprecated': true,
                '[custom.field_option]': 'field_val',
              },
            },
            {
              name: 'oneof_field',
              number: 2,
              type: 9, // string
              label: 'LABEL_OPTIONAL',
              oneofIndex: 0,
            },
          ],
          oneofDecl: [
            {
              name: 'either_or',
              options: {
                '[custom.oneof_option]': 'oneof_val',
              },
            },
          ],
        },
      ],
      enumType: [
        {
          name: 'MyEnum',
          options: {
            'deprecated': true,
          },
          value: [
            {
              name: 'MY_ENUM_UNSPECIFIED',
              number: 0,
              options: {
                'deprecated': true,
                '[custom.val_option]': 'val_opt',
              },
            },
          ],
        },
      ],
      service: [
        {
          name: 'MyService',
          options: {
            '[custom.service_option]': 'service_val',
          },
          method: [
            {
              name: 'CallMethod',
              inputType: '.test.package.ComplexMessage',
              outputType: '.test.package.ComplexMessage',
              options: {
                '[google.api.http]': {
                  get: '/v1/call',
                },
              },
            },
          ],
        },
      ],
    };

    const output = reconstructProto(file);
    expect(output).toBe(
      'syntax = "proto3";\n' +
      '\n' +
      'package test.package;\n' +
      '\n' +
      'enum MyEnum {\n' +
      '  option deprecated = true;\n' +
      '\n' +
      '  MY_ENUM_UNSPECIFIED = 0 [deprecated = true, (custom.val_option) = "val_opt"];\n' +
      '}\n' +
      '\n' +
      'message ComplexMessage {\n' +
      '  option deprecated = true;\n' +
      '  option (custom.msg_option) = "val";\n' +
      '\n' +
      '  string simple_field = 1 [deprecated = true, json_name = "custom_json_name", (custom.field_option) = "field_val"];\n' +
      '\n' +
      '  oneof either_or {\n' +
      '    option (custom.oneof_option) = "oneof_val";\n' +
      '\n' +
      '    string oneof_field = 2;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      'service MyService {\n' +
      '  option (custom.service_option) = "service_val";\n' +
      '\n' +
      '  rpc CallMethod(ComplexMessage) returns (ComplexMessage) {\n' +
      '    option (google.api.http) = { get: "/v1/call" };\n' +
      '  }\n' +
      '}\n'
    );
  });
});
