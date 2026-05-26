import { getOptionFqn } from './option-resolver';

export interface StandardEnumValInfo {
  name: string;
  description: string;
}

export interface StandardEnumInfo {
  enumFqn: string;
  values: Record<number, StandardEnumValInfo>;
}

export const STANDARD_OPTION_ENUMS: Record<string, StandardEnumInfo> = {
  '.google.protobuf.MethodOptions.idempotency_level': {
    enumFqn: '.google.protobuf.MethodOptions.IdempotencyLevel',
    values: {
      0: { name: 'IDEMPOTENCY_UNKNOWN', description: 'Default value. Idempotency of the method is unknown.' },
      1: { name: 'NO_SIDE_EFFECTS', description: 'The method has no side effects (e.g. read-only GET requests).' },
      2: { name: 'IDEMPOTENT', description: 'The method is idempotent (safe to retry, e.g. PUT/DELETE requests).' }
    }
  },
  '.google.protobuf.MethodOptions.idempotencyLevel': {
    enumFqn: '.google.protobuf.MethodOptions.IdempotencyLevel',
    values: {
      0: { name: 'IDEMPOTENCY_UNKNOWN', description: 'Default value. Idempotency of the method is unknown.' },
      1: { name: 'NO_SIDE_EFFECTS', description: 'The method has no side effects (e.g. read-only GET requests).' },
      2: { name: 'IDEMPOTENT', description: 'The method is idempotent (safe to retry, e.g. PUT/DELETE requests).' }
    }
  },
  '.google.protobuf.FieldOptions.jstype': {
    enumFqn: '.google.protobuf.FieldOptions.JSType',
    values: {
      0: { name: 'JS_NORMAL', description: 'Use standard JavaScript representation for 64-bit integers (e.g. numbers/strings).' },
      1: { name: 'JS_STRING', description: 'Force 64-bit integer values to be represented as strings in JavaScript.' },
      2: { name: 'JS_NUMBER', description: 'Force 64-bit integer values to be represented as numbers in JavaScript.' }
    }
  }
};

export const STANDARD_OPTION_DESCRIPTIONS: Record<string, string> = {
  // MethodOptions
  'MethodOptions.deprecated': 'Is this method deprecated? New code should avoid using it.',
  'MethodOptions.idempotency_level': 'Indicates the level of idempotency of the method (e.g., side-effect-free, idempotent).',
  'MethodOptions.idempotencyLevel': 'Indicates the level of idempotency of the method (e.g., side-effect-free, idempotent).',

  // MessageOptions
  'MessageOptions.deprecated': 'Is this message type deprecated? New code should avoid using it.',
  'MessageOptions.map_entry': 'Generated automatically by compiler for map fields. Do not use directly.',
  'MessageOptions.mapEntry': 'Generated automatically by compiler for map fields. Do not use directly.',

  // FieldOptions
  'FieldOptions.deprecated': 'Is this field deprecated? New code should avoid using it.',
  'FieldOptions.packed': 'If true, uses packed encoding for repeated primitive fields.',
  'FieldOptions.lazy': 'Should this field be parsed lazily?',
  'FieldOptions.jstype': 'Option to control JavaScript representation of 64-bit integers (e.g., JS_NUMBER, JS_STRING).',
  'FieldOptions.json_name': 'Custom JSON representation name for the field.',
  'FieldOptions.jsonName': 'Custom JSON representation name for the field.',

  // FileOptions
  'FileOptions.java_package': 'Java package name for generated classes.',
  'FileOptions.javaPackage': 'Java package name for generated classes.',
  'FileOptions.java_outer_classname': 'Java outer classname for generated wrapper class.',
  'FileOptions.javaOuterClassname': 'Java outer classname for generated wrapper class.',
  'FileOptions.java_multiple_files': 'If true, generates separate Java files for each message/enum.',
  'FileOptions.javaMultipleFiles': 'If true, generates separate Java files for each message/enum.',
  'FileOptions.go_package': 'Go package import path for generated code.',
  'FileOptions.goPackage': 'Go package import path for generated code.',
  'FileOptions.deprecated': 'Is this file deprecated?',
};

const isValueComplex = (v: any): boolean => {
  if (v === null || typeof v !== 'object') {
    return false;
  }
  if (Array.isArray(v)) {
    if (v.length > 1) {
      if (v.some(item => typeof item === 'object' && item !== null)) return true;
      const totalLen = v.reduce((acc, item) => acc + String(item).length, 0);
      if (totalLen > 50) return true;
    }
    return false;
  }
  const entries = Object.entries(v);
  if (entries.length > 1) {
    if (entries.some(([, val]) => typeof val === 'object' && val !== null)) return true;
    const totalLen = entries.reduce((acc, [k, val]) => acc + k.length + String(val).length, 0);
    if (totalLen > 50) return true;
  }
  if (entries.length === 1 && typeof entries[0][1] === 'object' && entries[0][1] !== null) {
    return true;
  }
  return false;
};

export function formatOptionValue(
  val: any,
  optionKey?: string,
  parentOptionsMessage?: string,
  typeIndex?: Record<string, any>,
  indent: number = 0
): string {
  const currentIndent = '  '.repeat(indent);
  const nextIndent = '  '.repeat(indent + 1);

  // If we have enough context, try resolving integer value to its Enum value name
  if (optionKey && parentOptionsMessage) {
    const fqn = getOptionFqn(parentOptionsMessage, optionKey);

    // 1. Try standard fallback enums first
    const stdEnum = STANDARD_OPTION_ENUMS[fqn];
    if (stdEnum) {
      const resolveStdEnumValueName = (v: any): string => {
        const num = Number(v);
        const matched = stdEnum.values[num];
        return matched ? matched.name : String(v);
      };

      if (Array.isArray(val)) {
        const resolvedList = val.map(resolveStdEnumValueName);
        const isComplex = isValueComplex(val);
        if (isComplex) {
          return `[\n${resolvedList.map(v => `${nextIndent}${v}`).join(',\n')}\n${currentIndent}]`;
        } else {
          return `[${resolvedList.join(', ')}]`;
        }
      }
      return resolveStdEnumValueName(val);
    }

    // 2. Try resolving dynamically via typeIndex
    if (typeIndex) {
      const optionInfo = typeIndex[fqn];
      if (optionInfo && optionInfo.kind === 'option') {
        const fieldProto = optionInfo.obj;
        if (fieldProto.typeName) {
          const enumTypeFqn = fieldProto.typeName;
          const enumInfo = typeIndex[enumTypeFqn];
          if (enumInfo && enumInfo.kind === 'enum') {
            const enumObj = enumInfo.obj;
            const resolveEnumValueName = (v: any): string => {
              const num = Number(v);
              const matched = enumObj.value?.find((ev: any) => ev.number === num);
              return matched ? matched.name : String(v);
            };

            if (Array.isArray(val)) {
              const resolvedList = val.map(resolveEnumValueName);
              const isComplex = isValueComplex(val);
              if (isComplex) {
                return `[\n${resolvedList.map(v => `${nextIndent}${v}`).join(',\n')}\n${currentIndent}]`;
              } else {
                return `[${resolvedList.join(', ')}]`;
              }
            }
            return resolveEnumValueName(val);
          }
        }
      }
    }
  }

  // Fallback to default formatting if not resolved
  if (typeof val === 'string') {
    return `"${val}"`;
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const isComplex = isValueComplex(val);
    const formattedElements = val.map(v => formatOptionValue(v, optionKey, parentOptionsMessage, typeIndex, indent + 1));
    if (isComplex) {
      return `[\n${formattedElements.map(v => `${nextIndent}${v}`).join(',\n')}\n${currentIndent}]`;
    } else {
      return `[${formattedElements.join(', ')}]`;
    }
  }
  if (typeof val === 'object' && val !== null) {
    const entries = Object.entries(val);
    if (entries.length === 0) return '{}';
    const isComplex = isValueComplex(val);
    const formattedEntries = entries.map(([k, v]) => {
      const formattedVal = formatOptionValue(v, optionKey, parentOptionsMessage, typeIndex, indent + 1);
      return `${k}: ${formattedVal}`;
    });
    if (isComplex) {
      return `{\n${formattedEntries.map(v => `${nextIndent}${v}`).join(',\n')}\n${currentIndent}}`;
    } else {
      return `{ ${formattedEntries.join(', ')} }`;
    }
  }
  return String(val);
}

export function formatOptionKey(key: string): string {
  if (key.startsWith('[') && key.endsWith(']')) {
    return `(${key.slice(1, -1)})`;
  }
  return key;
}
