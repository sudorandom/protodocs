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
});
