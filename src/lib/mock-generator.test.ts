import { describe, it, expect } from 'vitest';
import { generateMockJson } from './mock-generator';

describe('generateMockJson', () => {
  it('should generate basic fields', () => {
    const typeIndex = {
      '.example.MyMessage': {
        kind: 'message',
        obj: {
          name: 'MyMessage',
          field: [
            { name: 'name', type: 9 }, // string
            { name: 'age', type: 5 }, // int32
          ],
        },
      },
    };
    const mock = generateMockJson('.example.MyMessage', typeIndex);
    expect(mock).toEqual({
      name: '',
      age: 0,
    });
  });

  it('should only generate the first field in a oneof', () => {
    const typeIndex = {
      '.example.OneofMessage': {
        kind: 'message',
        obj: {
          name: 'OneofMessage',
          oneofDecl: [{ name: 'test_oneof' }],
          field: [
            { name: 'id', type: 5, oneofIndex: 0 },
            { name: 'title', type: 9, oneofIndex: 0 },
          ],
        },
      },
    };
    const mock = generateMockJson('.example.OneofMessage', typeIndex);
    expect(mock).toEqual({
      id: 0,
    });
    expect(mock.title).toBeUndefined();
  });

  it('should generate FieldMask using its well-known JSON string form', () => {
    const mock = generateMockJson('.google.protobuf.FieldMask', {});
    expect(mock).toBe('name,displayName');
  });

  it('should generate nested FieldMask fields using their well-known JSON string form', () => {
    const typeIndex = {
      '.example.UpdateRequest': {
        kind: 'message',
        obj: {
          name: 'UpdateRequest',
          field: [
            { name: 'updateMask', typeName: '.google.protobuf.FieldMask' },
            { name: 'readMasks', typeName: '.google.protobuf.FieldMask', label: 3 },
          ],
        },
      },
      '.google.protobuf.FieldMask': {
        kind: 'message',
        obj: {
          name: 'FieldMask',
          field: [{ name: 'paths', type: 9, label: 3 }],
        },
      },
    };

    const mock = generateMockJson('.example.UpdateRequest', typeIndex);

    expect(mock).toEqual({
      updateMask: 'name,displayName',
      readMasks: ['name,displayName'],
    });
  });

  it('should generate protobuf JSON forms for well-known types', () => {
    const cases: Array<[string, any]> = [
      [
        '.google.protobuf.Any',
        {
          '@type': 'type.googleapis.com/google.protobuf.StringValue',
          value: '',
        },
      ],
      ['.google.protobuf.Timestamp', '2024-01-01T00:00:00Z'],
      ['.google.protobuf.Duration', '3.000s'],
      ['.google.protobuf.Empty', {}],
      ['.google.protobuf.Struct', { exampleKey: 'example_value' }],
      ['.google.protobuf.Value', 'example_value'],
      ['.google.protobuf.ListValue', ['value1', 'value2']],
      ['.google.protobuf.DoubleValue', 0],
      ['.google.protobuf.FloatValue', 0],
      ['.google.protobuf.Int64Value', '0'],
      ['.google.protobuf.UInt64Value', '0'],
      ['.google.protobuf.Int32Value', 0],
      ['.google.protobuf.UInt32Value', 0],
      ['.google.protobuf.BoolValue', false],
      ['.google.protobuf.StringValue', ''],
      ['.google.protobuf.BytesValue', ''],
    ];

    cases.forEach(([typeName, expected]) => {
      expect(generateMockJson(typeName, {})).toEqual(expected);
    });
  });
});
