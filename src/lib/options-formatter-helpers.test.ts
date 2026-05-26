import { describe, it, expect } from 'vitest';
import {
  formatOptionKey,
  formatOptionValue,
} from './options-formatter-helpers';

describe('options-formatter-helpers', () => {
  describe('formatOptionKey', () => {
    it('should keep standard camelCase or snake_case option keys as-is', () => {
      expect(formatOptionKey('java_multiple_files')).toBe('java_multiple_files');
      expect(formatOptionKey('goPackage')).toBe('goPackage');
    });

    it('should convert bracketed custom option extensions to parenthesized format', () => {
      expect(formatOptionKey('[google.api.http]')).toBe('(google.api.http)');
      expect(formatOptionKey('[buf.validate.field]')).toBe('(buf.validate.field)');
    });
  });

  describe('formatOptionValue', () => {
    describe('primitive types', () => {
      it('should format numbers correctly', () => {
        expect(formatOptionValue(123)).toBe('123');
        expect(formatOptionValue(-45.67)).toBe('-45.67');
      });

      it('should format booleans correctly', () => {
        expect(formatOptionValue(true)).toBe('true');
        expect(formatOptionValue(false)).toBe('false');
      });

      it('should wrap strings in double quotes', () => {
        expect(formatOptionValue('hello')).toBe('"hello"');
        expect(formatOptionValue('')).toBe('""');
      });
    });

    describe('collections (simple inline)', () => {
      it('should format empty arrays and objects inline', () => {
        expect(formatOptionValue([])).toBe('[]');
        expect(formatOptionValue({})).toBe('{}');
      });

      it('should format short/flat arrays inline', () => {
        expect(formatOptionValue([1, 'two', false])).toBe('[1, "two", false]');
      });

      it('should format short/flat objects inline', () => {
        expect(formatOptionValue({ a: 1, b: 'two' })).toBe('{ a: 1, b: "two" }');
      });
    });

    describe('collections (complex multi-line)', () => {
      it('should format nested arrays with multi-line indentation', () => {
        const val = [
          { name: 'rule_1', expression: 'this.length() > 0' },
          { name: 'rule_2', expression: 'this.startsWith("prefix")' },
        ];
        const formatted = formatOptionValue(val);
        expect(formatted).toBe(
          '[\n' +
          '  { name: "rule_1", expression: "this.length() > 0" },\n' +
          '  { name: "rule_2", expression: "this.startsWith("prefix")" }\n' +
          ']'
        );
      });
    });

    describe('enum name resolution', () => {
      it('should resolve standard idempotencyLevel options to enum value names', () => {
        // MethodOptions idempotencyLevel -> 1 maps to NO_SIDE_EFFECTS
        expect(
          formatOptionValue(1, 'idempotencyLevel', 'MethodOptions')
        ).toBe('NO_SIDE_EFFECTS');

        expect(
          formatOptionValue(2, 'idempotency_level', 'MethodOptions')
        ).toBe('IDEMPOTENT');

        expect(
          formatOptionValue(0, 'idempotencyLevel', 'MethodOptions')
        ).toBe('IDEMPOTENCY_UNKNOWN');
      });

      it('should resolve dynamic custom option enums using typeIndex', () => {
        // Mock a custom extension option and its enum definition
        const mockTypeIndex = {
          '.google.api.field_behavior': {
            kind: 'option',
            obj: {
              name: 'field_behavior',
              typeName: '.google.api.FieldBehavior',
            },
          },
          '.google.api.FieldBehavior': {
            kind: 'enum',
            obj: {
              name: 'FieldBehavior',
              value: [
                { name: 'FIELD_BEHAVIOR_UNSPECIFIED', number: 0 },
                { name: 'OPTIONAL', number: 1 },
                { name: 'REQUIRED', number: 2 },
              ],
            },
          },
        };

        // Custom bracketed option matching FQN .google.api.field_behavior
        expect(
          formatOptionValue(
            2,
            '[google.api.field_behavior]',
            'FieldOptions',
            mockTypeIndex
          )
        ).toBe('REQUIRED');

        expect(
          formatOptionValue(
            1,
            '[google.api.field_behavior]',
            'FieldOptions',
            mockTypeIndex
          )
        ).toBe('OPTIONAL');

        // Lists of dynamic enums should also resolve
        expect(
          formatOptionValue(
            [1, 2],
            '[google.api.field_behavior]',
            'FieldOptions',
            mockTypeIndex
          )
        ).toBe('[OPTIONAL, REQUIRED]');
      });
    });
  });
});
