export const getAnchorId = (type: string, name: string) => `${type}-${name}`;
export const getFieldAnchorId = (type: string, name: string, fieldName: string) => `${type}-${name}--${fieldName}`;

export const getCommonPathPrefix = (paths: string[]): string => {
    if (!paths || paths.length === 0) return '';
    if (paths.length === 1) {
        const lastSlash = paths[0].lastIndexOf('/');
        if (lastSlash === -1) {
            return ''; // No directory path, just a file name
        }
        return paths[0].substring(0, lastSlash + 1);
    }

    const sortedPaths = [...paths].sort();
    const first = sortedPaths[0];
    const last = sortedPaths[sortedPaths.length - 1];
    let i = 0;
    while (i < first.length && first.charAt(i) === last.charAt(i)) {
        i++;
    }
    let prefix = first.substring(0, i);
    const lastSlash = prefix.lastIndexOf('/');
    if (lastSlash === -1) {
        return '';
    }
    return prefix.substring(0, lastSlash + 1);
};

export const scalarDocUrls: Record<string, string> = {
  'double': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'float': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'int32': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'int64': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'uint32': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'uint64': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'sint32': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'sint64': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'fixed32': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'fixed64': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'sfixed32': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'sfixed64': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'bool': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'string': 'https://protobuf.dev/programming-guides/proto3/#scalar',
  'bytes': 'https://protobuf.dev/programming-guides/proto3/#scalars'
};

export const wellKnownTypeUrls: Record<string, string> = {
    'google.protobuf.Any': 'https://protobuf.dev/reference/protobuf/google.protobuf/#any',
    'google.protobuf.Timestamp': 'https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp',
    'google.protobuf.Duration': 'https://protobuf.dev/reference/protobuf/google.protobuf/#duration',
    'google.protobuf.Struct': 'https://protobuf.dev/reference/protobuf/google.protobuf/#struct',
    'google.protobuf.Value': 'https://protobuf.dev/reference/protobuf/google.protobuf/#value',
    'google.protobuf.ListValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#list-value',
    'google.protobuf.FieldMask': 'https://protobuf.dev/reference/protobuf/google.protobuf/#field-mask',
    'google.protobuf.Empty': 'https://protobuf.dev/reference/protobuf/google.protobuf/#empty',
    'google.protobuf.DoubleValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#doublevalue',
    'google.protobuf.FloatValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#float-value',
    'google.protobuf.Int64Value': 'https://protobuf.dev/reference/protobuf/google.protobuf/#int64-value',
    'google.protobuf.UInt64Value': 'https://protobuf.dev/reference/protobuf/google.protobuf/#uint64-value',
    'google.protobuf.Int32Value': 'https://protobuf.dev/reference/protobuf/google.protobuf/#int32-value',
    'google.protobuf.UInt32Value': 'https://protobuf.dev/reference/protobuf/google.protobuf/#uint32-value',
    'google.protobuf.BoolValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#bool-value',
    'google.protobuf.StringValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#string-value',
    'google.protobuf.BytesValue': 'https://protobuf.dev/reference/protobuf/google.protobuf/#bytes-value',
  };

export const uniqueBy = <T extends { name: string }>(arr: T[]): T[] => {
    const seen = new Set<string>();
    return arr.filter(item => {
        if (seen.has(item.name)) {
            return false;
        } else {
            seen.add(item.name);
            return true;
        }
    });
};
