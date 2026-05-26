import React from 'react';

const PRIMITIVE_TYPES: Record<number | string, string> = {
  1: 'double', 2: 'float', 3: 'int64', 4: 'uint64', 5: 'int32',
  6: 'fixed64', 7: 'fixed32', 8: 'bool', 9: 'string',
  11: 'message', 12: 'bytes', 13: 'uint32', 14: 'enum',
  15: 'sfixed32', 16: 'sfixed64', 17: 'sint32', 18: 'sint64'
};

const WKT_DESCRIPTIONS: Record<string, { text: string; url: string }> = {
  '.google.protobuf.Timestamp': {
    text: 'A Timestamp represents a point in time independent of any time zone or local calendar.',
    url: 'https://protobuf.dev/reference/protobuf/google.protobuf/#timestamp',
  },
  '.google.protobuf.Duration': {
    text: 'A Duration represents a signed, fixed-length span of time.',
    url: 'https://protobuf.dev/reference/protobuf/google.protobuf/#duration',
  },
  '.google.protobuf.Any': {
    text: 'Contains an arbitrary serialized protocol buffer message along with a URL.',
    url: 'https://protobuf.dev/reference/protobuf/google.protobuf/#any',
  },
  '.google.protobuf.Empty': {
    text: 'A generic empty message that you can re-use to avoid defining duplicated empty messages.',
    url: 'https://protobuf.dev/reference/protobuf/google.protobuf/#empty',
  },
};

const PRIMITIVE_DESCRIPTIONS: Record<string, { text: string; url: string }> = {
  double: {
    text: 'Double-precision floating-point number (64-bit).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  float: {
    text: 'Single-precision floating-point number (32-bit).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  int64: {
    text: '64-bit signed integer (variable-length encoding). Uses variable-length encoding. Inefficient for encoding negative numbers—if your field is likely to have negative values, use sint64 instead.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  uint64: {
    text: '64-bit unsigned integer (variable-length encoding).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  int32: {
    text: '32-bit signed integer (variable-length encoding). Uses variable-length encoding. Inefficient for encoding negative numbers—if your field is likely to have negative values, use sint32 instead.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  fixed64: {
    text: '64-bit unsigned integer (always 8 bytes). More efficient than uint64 if values are often greater than 2^56.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  fixed32: {
    text: '32-bit unsigned integer (always 4 bytes). More efficient than uint32 if values are often greater than 2^28.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  bool: {
    text: 'Boolean (true or false).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  string: {
    text: 'A string must always contain UTF-8 encoded or 7-bit ASCII text and cannot exceed 2GB.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  bytes: {
    text: 'May contain any arbitrary sequence of bytes no longer than 2GB.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  uint32: {
    text: '32-bit unsigned integer (variable-length encoding).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  sfixed32: {
    text: '32-bit signed integer (always 4 bytes).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  sfixed64: {
    text: '64-bit signed integer (always 8 bytes).',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  sint32: {
    text: '32-bit signed integer (variable-length encoding). Signed value, encoded more efficiently than int32 for negative values.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
  sint64: {
    text: '64-bit signed integer (variable-length encoding). Signed value, encoded more efficiently than int64 for negative values.',
    url: 'https://protobuf.dev/programming-guides/proto3/#scalar',
  },
};

interface TypeLinkProps {
  typeName?: string;
  typeId?: number | string;
  typeIndex: Record<string, any>;
  onMouseEnter: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option',
    shortName: string
  ) => void;
  onMouseLeave: () => void;
  onPinClick: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option',
    shortName: string
  ) => void;
}

export default function TypeLink({
  typeName,
  typeId,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: TypeLinkProps) {
  if (!typeName) {
    const pId = typeId !== undefined ? Number(typeId) : 9;
    const pName = PRIMITIVE_TYPES[pId] || 'unknown';
    const desc = PRIMITIVE_DESCRIPTIONS[pName] || {
      text: `Protobuf primitive type: ${pName}`,
      url: 'https://protobuf.dev/programming-guides/proto3/#scalar'
    };

    return (
      <span
        className="text-syn-primitive border-b border-dotted border-syn-primitive/60 cursor-pointer select-text font-mono"
        onMouseEnter={(e) => onMouseEnter(e, pName, desc, 'primitive', pName)}
        onMouseLeave={onMouseLeave}
        onClick={(e) => onPinClick(e, pName, desc, 'primitive', pName)}
      >
        {pName}
      </span>
    );
  }

  const ref = typeIndex[typeName];
  const isWkt = typeName.startsWith('.google.protobuf');
  const shortName = typeName.split('.').pop() || typeName;

  let descText = '';
  let descUrl = '';

  if (WKT_DESCRIPTIONS[typeName]) {
    descText = WKT_DESCRIPTIONS[typeName].text;
    descUrl = WKT_DESCRIPTIONS[typeName].url;
  } else if (ref && ref.obj.description) {
    descText = ref.obj.description;
  } else if (isWkt) {
    descText = 'Google Well-Known Type';
  } else if (ref) {
    descText = 'No documentation provided.';
  } else {
    descText = 'Custom message/enum type.';
  }

  const desc = { text: descText, ...(descUrl ? { url: descUrl } : {}) };
  const category = (isWkt && !ref) ? 'wkt' : 'custom';

  return (
    <span
      className="text-syn-type border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
      onMouseEnter={(e) => onMouseEnter(e, typeName, desc, category, shortName)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => onPinClick(e, typeName, desc, category, shortName)}
    >
      {shortName}
    </span>
  );
}
