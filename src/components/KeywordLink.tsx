import React from 'react';

const KEYWORD_DESCRIPTIONS: Record<string, { text: string; url: string }> = {
  syntax: {
    text: 'Declares the syntax version of Protocol Buffers used in this file (e.g. "proto3" or "proto2").',
    url: 'https://protobuf.dev/programming-guides/proto3/#syntax',
  },
  edition: {
    text: 'Declares the Protobuf edition (e.g. "2023") used to compile this file. Editions represent a unified lifecycle system replacing proto2/proto3.',
    url: 'https://protobuf.dev/editions/overview/',
  },
  package: {
    text: "Defines a namespace identifier for this file's message, enum, and service definitions to prevent name clashes.",
    url: 'https://protobuf.dev/programming-guides/proto3/#packages',
  },
  import: {
    text: 'Imports definitions from another .proto file, allowing this file to reference its messages and enums.',
    url: 'https://protobuf.dev/programming-guides/proto3/#importing',
  },
  option: {
    text: 'Defines custom or standard settings/metadata annotations for files, messages, fields, enums, or services.',
    url: 'https://protobuf.dev/programming-guides/proto3/#options',
  },
  message: {
    text: 'Defines a structured data type in Protobuf consisting of a set of typed, numbered fields.',
    url: 'https://protobuf.dev/programming-guides/proto3/#simple',
  },
  enum: {
    text: 'Defines an enumeration type with a predefined set of named integer constant values.',
    url: 'https://protobuf.dev/programming-guides/proto3/#enum',
  },
  extend: {
    text: 'Declares a block of custom field extensions for a message type (mostly used in proto2 and custom options).',
    url: 'https://protobuf.dev/programming-guides/proto2/#extensions',
  },
  optional: {
    text: 'Specifies that a field value is optional. The field can either contain a value or be left unset.',
    url: 'https://protobuf.dev/programming-guides/proto3/#specifying-field-rules',
  },
  repeated: {
    text: 'Specifies that a field can be repeated zero or more times (representing a dynamically sized list/array).',
    url: 'https://protobuf.dev/programming-guides/proto3/#specifying-field-rules',
  },
  required: {
    text: 'Specifies that a field must have exactly one value set. If not set, parsing the message will fail (proto2 only, deprecated).',
    url: 'https://protobuf.dev/programming-guides/proto2/#required',
  },
  oneof: {
    text: 'Defines a group of mutually exclusive fields where at most one field can be set at a time. Setting a value clears other fields in the group.',
    url: 'https://protobuf.dev/programming-guides/proto3/#oneof',
  },
  map: {
    text: 'Specifies an unordered map type linking unique keys to values (e.g. map<string, Value>).',
    url: 'https://protobuf.dev/programming-guides/proto3/#maps',
  },
  service: {
    text: 'Defines a set of Remote Procedure Call (RPC) methods exported by a server, specifying their request and response message types.',
    url: 'https://protobuf.dev/programming-guides/proto3/#services',
  },
  rpc: {
    text: 'Defines an individual remote procedure call method within a service.',
    url: 'https://protobuf.dev/programming-guides/proto3/#services',
  },
  stream: {
    text: 'Specifies that a request or response is a stream of multiple messages sent sequentially rather than a single message.',
    url: 'https://protobuf.dev/programming-guides/proto3/#services',
  },
  returns: {
    text: 'Separates the input request type from the output response type in an RPC method definition.',
    url: 'https://protobuf.dev/programming-guides/proto3/#services',
  },
};

interface KeywordLinkProps {
  keyword: string;
  className?: string;
  onMouseEnter: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  onMouseLeave: () => void;
  onPinClick: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  children?: React.ReactNode;
}

export default function KeywordLink({
  keyword,
  className = 'text-syn-keyword border-b border-dotted border-syn-keyword/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text font-mono',
  onMouseEnter,
  onMouseLeave,
  onPinClick,
  children,
}: KeywordLinkProps) {
  const desc = KEYWORD_DESCRIPTIONS[keyword] || {
    text: `Protobuf keyword: ${keyword}`,
    url: 'https://protobuf.dev/',
  };

  return (
    <span
      className={className}
      onMouseEnter={(e) => onMouseEnter(e, keyword, desc, 'primitive', keyword)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => onPinClick(e, keyword, desc, 'primitive', keyword)}
    >
      {children || keyword}
    </span>
  );
}
