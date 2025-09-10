import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import * as protobuf from 'protobufjs';
import { BrowserRouter as Router, Routes, Route, useParams, useNavigate, Link, NavLink } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// --- Data Types ---
interface Annotation extends String {}

interface Field {
  name: string;
  type: string;
  tag: number;
  description: string;
  annotations?: Annotation[];
  isRepeated?: boolean;
  isMap?: boolean;
  keyType?: string;
  valueType?: string;
}

interface Message {
  name: string;
  description: string;
  fields: Field[];
  isMapEntry?: boolean;
}

interface EnumValue {
  name: string;
  value: number;
  description: string;
}

interface Enum {
  name: string;
  description: string;
  values: EnumValue[];
}

interface Rpc {
  name:string;
  request: string;
  response: string;
  description: string;
  isServerStream?: boolean;
  isClientStream?: boolean;
  isBidi?: boolean;
}

interface Service {
  name: string;
  description: string;
  rpcs: Rpc[];
}

interface ProtoFile {
  fileName: string;
  package: string;
  description: string;
  messages: Message[];
  services: Service[];
  enums: Enum[];
  options?: Record<string, any>;
}

interface ProtoPackage {
    name: string;
    files: ProtoFile[];
}


// --- Utility Functions ---
const getAnchorId = (type: string, name: string) => `${type}-${name}`;
const getFieldAnchorId = (type: string, name: string, fieldName: string) => `${type}-${name}--${fieldName}`;

const getCommonPathPrefix = (paths: string[]): string => {
    if (!paths || paths.length < 2) return '';
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

const scalarDocUrls: Record<string, string> = {
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

const wellKnownTypeUrls: Record<string, string> = {
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

// --- UI Components ---

interface CompactMessageViewProps {
  message: Message;
  title: string;
  renderFieldType: (field: Field, messagePackage: string) => React.ReactNode;
  messagePackage: string;
}

const CompactMessageView = ({ message, title, renderFieldType, messagePackage }: CompactMessageViewProps) => {
  if (!message) return null;
  return (
    <div className="mt-4">
      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}: <span className="font-mono text-purple-500">{message.name}</span></h4>
      <ul className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
        {message.fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <p className="font-mono text-purple-600 dark:text-purple-300 font-medium">
                {field.name}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.isRepeated && !field.isMap ? 'repeated ' : ''}
                {renderFieldType(field, messagePackage)}
              </span>
            </div>
            {field.description && <div className="prose dark:prose-invert max-w-none text-xs"><ReactMarkdown>{field.description}</ReactMarkdown></div>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const formatProtobufOptions = (options: Record<string, any>, indent = ''): string => {
    return Object.entries(options).map(([key, value]): string => {
        let valueStr;
        if (typeof value === 'string') {
            valueStr = `"${value}"`;
        } else if (typeof value === 'object' && value !== null) {
            valueStr = `{
${formatProtobufOptions(value, indent + '  ')}${indent}}`;
        } else {
            valueStr = value.toString();
        }
        return `${indent}option (${key}) = ${valueStr};
`;
    }).join('\n');
};

const ProtoSourceView = ({ item, type }: { item: Message | Service | Enum, type: string }) => {
    const generateSource = (): string => {
        if (!item) return '';

        let source = ``;
        if (item.description) {
            source += `// ${item.description.replace(/\n/g, '\n// ')}
`;
        }

        if (type === 'messages') {
            const message = item as Message;
            source += `message ${message.name} {
`;
            if(message.fields) {
                message.fields.forEach(field => {
                    if (field.description) {
                        source += `  // ${field.description.replace(/\n/g, '\n  // ')}
`;
                    }
                    const repeated = field.isRepeated && !field.isMap ? 'repeated ' : '';
                    const fieldType = field.isMap ? `map<${field.keyType}, ${field.valueType}>` : field.type;
                    source += `  ${repeated}${fieldType} ${field.name} = ${field.tag};
`;
                });
            }
            source += '}';
        } else if (type === 'enums') {
            const enumItem = item as Enum;
            source += `enum ${enumItem.name} {
`;
            if(enumItem.values) {
                enumItem.values.forEach(value => {
                    if (value.description) {
                        source += `  // ${value.description.replace(/\n/g, '\n  // ')}
`;
                    }
                    source += `  ${value.name} = ${value.value};
`;
                });
            }
            source += '}';
        } else if (type === 'services') {
            const service = item as Service;
            source += `service ${service.name} {
`;
            if(service.rpcs) {
                service.rpcs.forEach(rpc => {
                    if (rpc.description) {
                        source += `  // ${rpc.description.replace(/\n/g, '\n  // ')}
`;
                    }
                    const clientStream = rpc.isClientStream ? 'stream ' : '';
                    const serverStream = rpc.isServerStream ? 'stream ' : '';
                    source += `  rpc ${rpc.name} (${clientStream}${rpc.request}) returns (${serverStream}${rpc.response});
`;
                });
            }
            source += '}';
        }

        return source;
    };

    return (
        <div className="p-8">
            <SyntaxHighlighter language="protobuf" style={atomDark} customStyle={{ background: 'transparent' }}>
                {generateSource()}
            </SyntaxHighlighter>
        </div>
    );
};

interface ProtoDetailViewProps {
    item: Message | Service | Enum | null;
    type: string | null;
    proto: ProtoFile;
    allTypes: Map<string, {pkg: ProtoPackage, item: Message | Enum, type: string}>;
    protoPackage: ProtoPackage;
}

const DetailSection = <T,>({ title, items, renderItem, titleAddon }: { title: string, items: T[], renderItem: (item: T) => React.ReactNode, titleAddon?: React.ReactNode }) => {
    if (!items || items.length === 0) return null;
    return (
        <div className="mt-8">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                {title}
                {titleAddon}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(renderItem)}
            </div>
        </div>
    );
};

const ProtoDetailView = ({ item, type, proto, allTypes, protoPackage }: ProtoDetailViewProps) => {
  const { packageName } = useParams();
  const [expandedRpc, setExpandedRpc] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const navigate = useNavigate();

  if (!item) {
    const fileNames = protoPackage.files.map(f => f.fileName);
    const commonPrefix = getCommonPathPrefix(fileNames);
    return (
        <div className="p-8">
            <div className="border-b dark:border-gray-700 pb-4">
                <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100 font-mono">{proto.package}</h2>
                {proto.description && <div className="prose dark:prose-invert max-w-none mt-2"><ReactMarkdown>{proto.description}</ReactMarkdown></div>}
            </div>

            <DetailSection
                title="Services"
                items={proto.services}
                renderItem={service => (
                    <li key={service.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <Link to={`/package/${protoPackage.name}/services/${service.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{service.name}</Link>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{service.rpcs.length} methods</span>
                    </li>
                )}
            />

            <DetailSection
                title="Messages"
                items={proto.messages}
                renderItem={message => (
                    <li key={message.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <Link to={`/package/${protoPackage.name}/messages/${message.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{message.name}</Link>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{message.fields.length} fields</span>
                    </li>
                )}
            />

            <DetailSection
                title="Enums"
                items={proto.enums}
                renderItem={enumItem => (
                    <li key={enumItem.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm flex justify-between items-center">
                        <Link to={`/package/${protoPackage.name}/enums/${enumItem.name}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">{enumItem.name}</Link>
                        <span className="text-sm text-gray-500 dark:text-gray-400">{enumItem.values.length} values</span>
                    </li>
                )}
            />

            <DetailSection
                title="Files"
                items={protoPackage.files}
                titleAddon={commonPrefix && (
                    <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={commonPrefix}>
                        {commonPrefix}
                    </span>
                )}
                renderItem={file => (
                    <li key={file.fileName} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                        <Link to={`/package/${protoPackage.name}/files/${file.fileName.replace(/\//g, '+')}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all">{file.fileName.substring(commonPrefix.length)}</Link>
                        <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                            <span>{file.services.length} services</span>
                            <span>{file.messages.length} messages</span>
                            <span>{file.enums.length} enums</span>
                        </div>
                    </li>
                )}
            />
        </div>
    );
  }

  const findAndSelect = (typeName: string) => {
    const found = allTypes.get(typeName);
    if (found) {
        const { pkg, item, type } = found;
        navigate(`/package/${pkg.name}/${type}/${item.name}`);
    }
  };

  const renderFieldType = (field: Field, messagePackage: string) => {
    if (field.isMap) {
        return (
            <span className="font-semibold">
                map&lt;{renderType(field.keyType!, messagePackage)}, {renderType(field.valueType!, messagePackage)}&gt;
            </span>
        );
    }
    return renderType(field.type, messagePackage);
  };

  const renderType = (type: string, messagePackage: string) => {
    if (scalarDocUrls[type]) {
      return (
        <a href={scalarDocUrls[type]} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline">
          {type}
        </a>
      );
    }
    if (wellKnownTypeUrls[type]) {
        return (
            <a href={wellKnownTypeUrls[type]} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline">
                {type.split('.').pop()}
            </a>
        );
    }

    const isExternal = !type.startsWith(messagePackage);
    const typeName = isExternal ? type : type.split('.').pop();

    if (!typeName) {
        return <span className="font-semibold text-red-500">Unknown Type</span>;
    }

    return (
      <button onClick={() => findAndSelect(type)} className="font-semibold text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200">
        {typeName}
      </button>
    );
  }

  const renderFields = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Fields</h3>
      <ul className="space-y-2">
        {(item as Message).fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, field.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold"><a href={`#${getFieldAnchorId(type!, item.name, field.name)}`} className="hover:underline">{field.tag}. {field.name}</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.isRepeated && !field.isMap ? 'repeated ' : ''}
                {renderFieldType(field, proto.package)}
              </span>
            </div>
            <div className="prose dark:prose-invert max-w-none text-sm"><ReactMarkdown>{field.description}</ReactMarkdown></div>
            {field.annotations && field.annotations.length > 0 && (
              <div className="mt-3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-200">Annotations:</span>
                <ul className="font-mono text-xs text-gray-800 dark:text-gray-100 mt-1 space-y-1">
                  {field.annotations.map((annotation: Annotation, index: number) => (<li key={index} className="break-words">{annotation}</li>))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderEnums = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Values</h3>
      <ul className="space-y-2">
        {(item as Enum).values.map((value: EnumValue) => (
          <li key={value.value} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, value.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 dark:text-purple-300 font-semibold"><a href={`#${getFieldAnchorId(type!, item.name, value.name)}`} className="hover:underline">{value.name}</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400"> = {value.value}</span>
            </div>
			<div className="prose dark:prose-invert max-w-none text-sm"><ReactMarkdown>{value.description}</ReactMarkdown></div>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderRpcs = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">RPCs</h3>
      <ul className="space-y-2">
        {(item as Service).rpcs.map((rpc: Rpc) => {
          const isExpanded = expandedRpc === rpc.name;
          const requestInfo = allTypes.get(rpc.request);
          const responseInfo = allTypes.get(rpc.response);
          const requestMessage = requestInfo?.type === 'messages' ? requestInfo.item as Message : undefined;
          const responseMessage = responseInfo?.type === 'messages' ? responseInfo.item as Message : undefined;

          return (
            <li key={rpc.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, rpc.name)}>
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedRpc(isExpanded ? null : rpc.name)}
              >
                <div>
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    <a href={`#${getFieldAnchorId(type!, item.name, rpc.name)}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{rpc.name}</a>
                  </div>
                </div>
                <svg className={`h-6 w-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                  {rpc.isClientStream ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200 ml-1">{rpc.request.startsWith(proto.package) ? rpc.request.split('.').pop() : rpc.request}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 dark:text-purple-300 hover:text-purple-400 dark:hover:text-purple-200 underline transition-colors duration-200">{rpc.request.startsWith(proto.package) ? rpc.request.split('.').pop() : rpc.request}</button>)}
                  <span className="mx-2">&rarr;</span>
                  {rpc.isServerStream || rpc.isBidi ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200 ml-1">{rpc.response.startsWith(proto.package) ? rpc.response.split('.').pop() : rpc.response}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200">{rpc.response.startsWith(proto.package) ? rpc.response.split('.').pop() : rpc.response}</button>)}
              </div>
              <div className="prose dark:prose-invert max-w-none text-sm"><ReactMarkdown>{rpc.description}</ReactMarkdown></div>

              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] mt-4 pt-4 border-t border-gray-200 dark:border-gray-700' : 'max-h-0'}`}>
                  {requestMessage && <CompactMessageView message={requestMessage} title="Request" renderFieldType={renderFieldType} messagePackage={requestInfo!.pkg.name} />}
                  {responseMessage && <CompactMessageView message={responseMessage} title="Response" renderFieldType={renderFieldType} messagePackage={responseInfo!.pkg.name} />}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="border-b dark:border-gray-700 pb-4 flex justify-between items-center" id={getAnchorId(type!, item.name)}>
          <div>
              <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{item.name}</h2>
              <div className="prose dark:prose-invert max-w-none"><ReactMarkdown>{item.description}</ReactMarkdown></div>
          </div>
          <button onClick={() => setShowSource(!showSource)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-4">
              {showSource ? 'View Details' : 'View Source'}
          </button>
      </div>
      {showSource ? (
          <ProtoSourceView item={item} type={type!} />
      ) : (
          <>
              {type === 'messages' && renderFields()}
              {type === 'enums' && renderEnums()}
              {type === 'services' && renderRpcs()}
          </>
      )}
    </div>
  );
};

interface NavSectionProps {
    title: string;
    items: (Message | Service | Enum)[];
    selectedItem: Message | Service | Enum | null;
    itemType: string;
    packageName: string;
}

const NavSection = ({ title, items, selectedItem, itemType, packageName }: NavSectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <div className="w-full">
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center justify-between w-full py-2 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none rounded-lg">
        <div className="flex items-center">
          <span>{title}</span>
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({items.length})</span>
        </div>
        <svg className={`h-5 w-5 transform transition-transform duration-200 ${isCollapsed ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div className={`transition-max-h duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-screen'}`}>
        <ul className="space-y-1 mt-2">
          {items.map(item => (
            <li key={item.name}>
                <Link to={`/package/${packageName}/${itemType}/${item.name}`} className={`w-full text-left py-2 px-6 text-sm rounded-lg transition-colors duration-200 block ${ selectedItem && selectedItem.name === item.name ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' }`}>
                    {item.name}
                </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};


const generateFileSource = (file: ProtoFile) => {
    let source = `syntax = "proto3";\n\n`;
    source += `package ${file.package};\n\n`;

    if (file.options) {
        source += formatProtobufOptions(file.options) + '\n\n';
    }

    file.services.forEach(service => {
        if (service.description) {
            source += `// ${service.description.replace(/\n/g, '\n// ')}
`;
        }
        source += `service ${service.name} {
`;
        service.rpcs.forEach(rpc => {
            if (rpc.description) {
                source += `  // ${rpc.description.replace(/\n/g, '\n  // ')}
`;
            }
            const clientStream = rpc.isClientStream ? 'stream ' : '';
            const serverStream = rpc.isServerStream ? 'stream ' : '';
            source += `  rpc ${rpc.name} (${clientStream}${rpc.request}) returns (${serverStream}${rpc.response});
`;
        });
        source += `}

`;
    });

    file.messages.forEach(message => {
        if (message.isMapEntry) return;
        if (message.description) {
            source += `// ${message.description.replace(/\n/g, '\n// ')}
`;
        }
        source += `message ${message.name} {
`;
        message.fields.forEach(field => {
            if (field.description) {
                source += `  // ${field.description.replace(/\n/g, '\n  // ')}
`;
            }
            const repeated = field.isRepeated && !field.isMap ? 'repeated ' : '';
            const fieldType = field.isMap ? `map<${field.keyType}, ${field.valueType}>` : field.type;
            source += `  ${repeated}${fieldType} ${field.name} = ${field.tag};
`;
        });
        source += `}

`;
    });

    file.enums.forEach(enumItem => {
        if (enumItem.description) {
            source += `// ${enumItem.description.replace(/\n/g, '\n// ')}
`;
        }
        source += `enum ${enumItem.name} {
`;
        enumItem.values.forEach(value => {
            if (value.description) {
                source += `  // ${value.description.replace(/\n/g, '\n  // ')}
`;
            }
            source += `  ${value.name} = ${value.value};
`;
        });
        source += `}

`;
    });

    return source;
}

const FileSourceContentView = ({ packages }: { packages: ProtoPackage[] }) => {
    const { packageName, fileName } = useParams();
    const protoPackage = packages.find(p => p.name === packageName);
    const protoFile = protoPackage?.files.find(f => f.fileName.replace(/\//g, '+') === fileName);

    if (!protoFile) {
        return <div className="p-8">File not found</div>;
    }

    return (
        <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">{protoFile.fileName}</h2>
            <SyntaxHighlighter language="protobuf" style={atomDark}>
                {generateFileSource(protoFile)}
            </SyntaxHighlighter>
        </div>
    );
}

const PackageNav = ({ packages, isDarkMode, toggleDarkMode }: { packages: ProtoPackage[], isDarkMode: boolean, toggleDarkMode: () => void }) => {
    const { packageName } = useParams();
    const navigate = useNavigate();
    const [isPackageDropdownOpen, setIsPackageDropdownOpen] = useState(false);
    const [packageFilter, setPackageFilter] = useState('');
    const [selectedPackageIndex, setSelectedPackageIndex] = useState(0);
    const packageFilterInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isPackageDropdownOpen) {
          packageFilterInputRef.current?.focus();
        }
    }, [isPackageDropdownOpen]);

    const filteredPackages = packages.filter((p) =>
        p.name.toLowerCase().includes(packageFilter.toLowerCase())
    );

    const handlePackageFilterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedPackageIndex((prevIndex) =>
            Math.min(prevIndex + 1, filteredPackages.length - 1)
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedPackageIndex((prevIndex) => Math.max(prevIndex - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredPackages[selectedPackageIndex]) {
            navigate(`/package/${filteredPackages[selectedPackageIndex].name}`);
            setIsPackageDropdownOpen(false);
          }
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between p-2 mb-4">
                <div className="flex items-center space-x-2">
                    <Link to={`/`} className="text-2xl font-bold text-blue-600">ProtoDocs</Link>
                </div>
                <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">{isDarkMode ? '☀️' : '🌙'}</button>
            </div>
            <div className="space-y-6">
                <div className="relative">
                    <button
                    onClick={() => setIsPackageDropdownOpen(!isPackageDropdownOpen)}
                    className="w-full p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex justify-between items-center"
                    >
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Package</p>
                        <h2 className="font-mono text-base font-semibold text-gray-800 dark:text-gray-100 mt-1 break-all">
                            {packageName}
                        </h2>
                    </div>
                    <svg
                        className={`h-5 w-5 transform transition-transform duration-200 ${isPackageDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                        />
                    </svg>
                    </button>
                    {isPackageDropdownOpen && (
                    <div className="absolute z-20 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                        <div className="p-2">
                        <input
                            ref={packageFilterInputRef}
                            type="text"
                            placeholder="Filter packages..."
                            value={packageFilter}
                            onChange={(e) => setPackageFilter(e.target.value)}
                            onKeyDown={handlePackageFilterKeyDown}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        </div>
                        <ul className="max-h-60 overflow-y-auto">
                        {filteredPackages.map((p, index) => (
                            <li key={p.name} className={selectedPackageIndex === index ? 'bg-gray-200 dark:bg-gray-700' : ''}>
                                <button
                                onClick={() => {
                                    navigate(`/package/${p.name}`);
                                    setIsPackageDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 truncate"
                                title={p.name}
                                >
                                {p.name}
                                </button>
                            </li>
                            ))}
                        </ul>
                    </div>
                    )}
                </div>
                
            </div>
        </div>
    )
}



interface PackageDocumentationViewProps {
    packages: ProtoPackage[];
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const FileTreeView = ({ files, packageName }: { files: ProtoFile[], packageName: string }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const fileNames = files.map(f => f.fileName);
    const commonPrefix = getCommonPathPrefix(fileNames);

    if (!files || files.length === 0) return null;

    return (
        <div className="w-full">
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center justify-between w-full py-2 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none rounded-lg">
            <div className="flex items-center">
                <span>Files</span>
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">({files.length})</span>
            </div>
            <svg className={`h-5 w-5 transform transition-transform duration-200 ${isCollapsed ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        <div className={`transition-max-h duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-screen'}`}>
            {commonPrefix && (
                <div className="px-6 py-1 text-xs text-gray-500 dark:text-gray-400 truncate" title={commonPrefix}>
                    {commonPrefix}
                </div>
            )}
            <ul className="space-y-1 mt-2">
                {files.map(file => (
                    <li key={file.fileName}>
                        <NavLink to={`/package/${packageName}/files/${file.fileName.replace(/\//g, '+')}`} className={({ isActive }) => `w-full text-left py-2 px-6 text-sm rounded-lg transition-colors duration-200 block ${ isActive ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' }`}>
                            {file.fileName.substring(commonPrefix.length)}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </div>
        </div>
    );
};

const uniqueBy = <T extends { name: string }>(arr: T[]): T[] => {
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

const PackageDocumentationView = ({ packages, isDarkMode, toggleDarkMode }: PackageDocumentationViewProps) => {
  const { packageName, itemType, itemName, fileName } = useParams();
  const [selectedItem, setSelectedItem] = useState<Message | Service | Enum | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);

  const protoPackage = packages.find(p => p.name === packageName);

  const mergedProtoFile = useMemo(() => {
    if (!protoPackage) return null;

    const description = protoPackage.files.map(f => f.description).filter(d => d).join('\n\n');
    const options = protoPackage.files.reduce((acc, file) => {
        if (file.options) {
            return {...acc, ...file.options};
        }
        return acc;
    }, {});

    return {
        fileName: '',
        package: protoPackage.name,
        description: description,
        messages: uniqueBy(protoPackage.files.flatMap(f => f.messages)).filter(m => !m.isMapEntry),
        services: uniqueBy(protoPackage.files.flatMap(f => f.services)),
        enums: uniqueBy(protoPackage.files.flatMap(f => f.enums)),
        options: options,
    };
  }, [protoPackage]);

  const allTypes = useMemo(() => {
    const map = new Map<string, {pkg: ProtoPackage, item: Message | Enum, type: string}>();
    packages.forEach(pkg => {
        const messages = uniqueBy(pkg.files.flatMap(f => f.messages));
        const enums = uniqueBy(pkg.files.flatMap(f => f.enums));
        messages.forEach(m => map.set(`${pkg.name}.${m.name}`, {pkg, item: m, type: 'messages'}));
        enums.forEach(e => map.set(`${pkg.name}.${e.name}`, {pkg, item: e, type: 'enums'}));
    });
    return map;
  }, [packages]);

  useEffect(() => {
    if (mergedProtoFile && itemType && itemName) {
        let foundItem: Message | Service | Enum | undefined;
        let foundType = '';
        if (itemType === 'messages') { foundItem = mergedProtoFile.messages.find((msg) => msg.name === itemName); foundType = 'messages'; }
        else if (itemType === 'services') { foundItem = mergedProtoFile.services.find((svc) => svc.name === itemName); foundType = 'services'; }
        else if (itemType === 'enums') { foundItem = mergedProtoFile.enums.find((enm) => enm.name === itemName); foundType = 'enums'; }
        
        if (foundItem) {
            setSelectedItem(foundItem);
            setSelectedItemType(foundType);
        } else {
            setSelectedItem(null);
            setSelectedItemType(null);
        }
    } else {
        setSelectedItem(null);
        setSelectedItemType(null);
    }
  }, [mergedProtoFile, itemType, itemName]);

  useEffect(() => {
    if (selectedItem && selectedItemType) {
      const anchorId = getAnchorId(selectedItemType, selectedItem.name);
      const element = document.getElementById(anchorId);
      if (element) { element.scrollIntoView({ behavior: 'smooth' }); }
    }
  }, [selectedItem, selectedItemType]);

  if (!mergedProtoFile) {
      return <div>Package not found</div>
  }

  const filteredServices = mergedProtoFile.services.filter((svc) => svc.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredMessages = mergedProtoFile.messages.filter((msg) => msg.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredEnums = mergedProtoFile.enums.filter((enm) => enm.name.toLowerCase().includes(filterQuery.toLowerCase()));

  return (
    <div className={`font-sans antialiased text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col md:flex-row transition-colors duration-500`}>
        <div className="flex-shrink-0 w-full md:w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 shadow-xl transition-all duration-300 ease-in-out md:flex flex-col h-screen">
            <PackageNav packages={packages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
            <div className="flex-grow overflow-y-auto">
              <div className="p-2 mb-4">
                  <input type="text" placeholder="Filter definitions..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} className="w-full px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-6">
                  <FileTreeView files={protoPackage.files} packageName={packageName!} />
                  <NavSection title="Services" items={filteredServices} selectedItem={selectedItem} itemType="services" packageName={packageName!} />
                  <NavSection title="Messages" items={filteredMessages} selectedItem={selectedItem} itemType="messages" packageName={packageName!} />
                  <NavSection title="Enums" items={filteredEnums} selectedItem={selectedItem} itemType="enums" packageName={packageName!} />
              </div>
            </div>
        </div>
      <main ref={mainRef} className="flex-1 w-full bg-white dark:bg-gray-900 md:rounded-l-3xl shadow-xl z-20 overflow-y-auto transition-colors duration-500">
        {fileName ? (
            <FileSourceContentView packages={packages} />
        ) : (
            <ProtoDetailView item={selectedItem} type={selectedItemType} proto={mergedProtoFile} allTypes={allTypes} protoPackage={protoPackage!} />
        )}
      </main>
    </div>
  );
};

interface PackageListViewProps {
    packages: ProtoPackage[];
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PackageListView = ({ packages, isDarkMode, toggleDarkMode, onFileChange }: PackageListViewProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <header className="p-4 flex justify-between items-center container mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">ProtoDocs</h1>
        <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">{isDarkMode ? '☀️' : '🌙'}</button>
      </header>
      <div className="container mx-auto p-8 pt-4">
        <div className="flex justify-center mb-8">
            <label htmlFor="file-upload" className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-colors duration-300 cursor-pointer">
                Upload Descriptor Files
            </label>
            <input id="file-upload" type="file" multiple className="hidden" onChange={onFileChange} />
        </div>
        <h2 className="text-5xl font-extrabold text-center mb-4 text-gray-900 dark:text-gray-100">Available Packages</h2>
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-12">Select a package to view its documentation.</p>
        <div className="max-w-4xl mx-auto space-y-8">
          {packages.map((pkg) => {
            const totalServices = pkg.files.reduce((sum, file) => sum + file.services.length, 0);
            const totalTypes = pkg.files.reduce((sum, file) => sum + file.messages.length + file.enums.length, 0);

            return (
              <div key={pkg.name} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border dark:border-gray-700 flex flex-col md:flex-row items-center justify-between hover:shadow-xl transition-shadow duration-300">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 font-mono">{pkg.name}</h3>
                  <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                    <span><span className="font-semibold">{totalServices}</span> Services</span>
                    <span><span className="font-semibold">{totalTypes}</span> Types</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/package/${pkg.name}`)}
                  className="mt-4 md:mt-0 bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-colors duration-300 self-start md:self-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm">
                  View Documentation
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [files, setFiles] = useState<ProtoFile[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
    } else {
        setIsDarkMode(prefersDarkMode);
    }
  }, []);

  const transformToProtoFile = (fileDescriptor: any, allMessageDescriptors: Map<string, any>): ProtoFile => {
    const locations = new Map<string, any>();
    if (fileDescriptor.sourceCodeInfo) {
        for (const loc of fileDescriptor.sourceCodeInfo.location) {
            if (loc.path) {
                locations.set(loc.path.join(','), loc);
            }
        }
    }

    const getComment = (path: number[]) => {
        const loc = locations.get(path.join(','));
        if (!loc) return '';
        return (loc.leadingComments || loc.trailingComments || '').trim();
    };

    const typeStringMap: { [key: number]: string } = {};
    for (const key in protobuf.types.basic) {
        if (Object.prototype.hasOwnProperty.call(protobuf.types.basic, key)) {
            typeStringMap[(protobuf.types.basic as any)[key]] = key;
        }
    }
    const resolveType = (type: number) => typeStringMap[type] || 'unknown';

    const transformMessages = (messageDescriptors: any[], prefix: string, path: number[]): Message[] => {
        if (!messageDescriptors) return [];
        let messages: Message[] = [];
        messageDescriptors.forEach((msg, i) => {
            const messageName = prefix ? `${prefix}.${msg.name}` : msg.name;
            const msgPath = path.concat(i);

            const fields: Field[] = (msg.field || []).map((field: any, j: number) => {
                let typeName = '';
                let isMap = false;
                let keyType: string | undefined;
                let valueType: string | undefined;

                const fieldMessageType = allMessageDescriptors.get(field.typeName?.substring(1));
                if (field.label === 3 && field.type === 11 && fieldMessageType?.options?.mapEntry) {
                    isMap = true;
                    const keyField = fieldMessageType.field.find((f:any) => f.number === 1);
                    const valueField = fieldMessageType.field.find((f:any) => f.number === 2);
                    keyType = resolveType(keyField.type);
                    if (valueField.typeName) {
                        valueType = valueField.typeName.startsWith('.') ? valueField.typeName.substring(1) : valueField.typeName;
                    } else {
                        valueType = resolveType(valueField.type);
                    }
                    typeName = field.typeName.startsWith('.') ? field.typeName.substring(1) : field.typeName;
                } else {
                    if (field.typeName) {
                        typeName = field.typeName.startsWith('.') ? field.typeName.substring(1) : field.typeName;
                    } else if (typeof field.type === 'string' && field.type.startsWith('TYPE_')) {
                        typeName = field.type.substring('TYPE_'.length).toLowerCase();
                    } else {
                        typeName = typeStringMap[field.type] || '';
                    }
                    if (!typeName) {
                        console.error('Field type not resolved:', field);
                    }
                }

                return {
                    name: field.name || '',
                    type: typeName,
                    tag: field.number || 0,
                    description: getComment(msgPath.concat(2, j)), // 2 is for fields
                    isRepeated: field.label === 3,
                    isMap,
                    keyType,
                    valueType,
                };
            });
            messages.push({ name: msg.name, description: getComment(msgPath), fields, isMapEntry: msg.options?.mapEntry });
            if (msg.nestedType) {
                messages = messages.concat(transformMessages(msg.nestedType, messageName, msgPath.concat(3))); // 3 is for nested types
            }
        });
        return messages;
    }

    const messages: Message[] = transformMessages(fileDescriptor.messageType, fileDescriptor.package, [4]); // 4 is for messages

    const enums: Enum[] = (fileDescriptor.enumType || []).map((enumType: any, i: number) => {
        const enumPath = [5, i]; // 5 is for enums
        const values: EnumValue[] = (enumType.value || []).map((val: any, j: number) => ({
            name: val.name || '',
            value: val.number || 0,
            description: getComment(enumPath.concat(2, j)), // 2 is for values
        }));
        return { name: enumType.name || '', description: getComment(enumPath), values };
    });

    const services: Service[] = (fileDescriptor.service || []).map((service: any, i: number) => {
        const servicePath = [6, i]; // 6 is for services
        const rpcs: Rpc[] = (service.method || []).map((method: any, j: number) => ({
            name: method.name || '',
            request: method.inputType?.startsWith('.') ? method.inputType.substring(1) : method.inputType,
            response: method.outputType?.startsWith('.') ? method.outputType.substring(1) : method.outputType,
            description: getComment(servicePath.concat(2, j)), // 2 is for methods
            isClientStream: method.clientStreaming || false,
            isServerStream: method.serverStreaming || false,
            isBidi: (method.clientStreaming || false) && (method.serverStreaming || false),
        }));
        return { name: service.name || '', description: getComment(servicePath), rpcs };
    });

    return {
        fileName: fileDescriptor.name || '',
        package: fileDescriptor.package || '',
        description: getComment([2]), // 2 is for package
        messages,
        services,
        enums,
        options: fileDescriptor.options,
    };
  };

  const loadDescriptors = async (buffer: ArrayBuffer) => {
    try {
        const root = protobuf.Root.fromJSON(await import('protobufjs/google/protobuf/descriptor.json'));
        const FileDescriptorSet = root.lookupType("google.protobuf.FileDescriptorSet");
        const descriptorSet = FileDescriptorSet.decode(new Uint8Array(buffer));
        const descriptorSetObject = FileDescriptorSet.toObject(descriptorSet, { enums: String });

        const allMessageDescriptors = new Map<string, any>();
        (descriptorSetObject.file || []).forEach((file: any) => {
            const processMessages = (messages: any[], prefix: string) => {
                if (!messages) return;
                messages.forEach(msg => {
                    const fqn = prefix ? `${prefix}.${msg.name}` : msg.name;
                    allMessageDescriptors.set(fqn, msg);
                    if (msg.nestedType) {
                        processMessages(msg.nestedType, fqn);
                    }
                });
            };
            processMessages(file.messageType, file.package);
        });

        const protoFiles = (descriptorSetObject.file || []).map((file: any) => {
          return transformToProtoFile(file, allMessageDescriptors);
        });

        setFiles(prevFiles => {
            const existingFileNames = new Set(prevFiles.map(f => f.fileName));
            const newFiles = protoFiles.filter(pf => !existingFileNames.has(pf.fileName));
            return [...prevFiles, ...newFiles];
        });
    } catch (err) {
        setError('Failed to parse descriptor file.');
        console.error(err);
    }
  };

  useEffect(() => {
    const fetchDefaultDescriptors = async () => {
      try {
        const response = await fetch('/buf.registry.binpb');
        if (!response.ok) {
          throw new Error('Failed to fetch default descriptors');
        }
        const buffer = await response.arrayBuffer();
        await loadDescriptors(buffer);
      } catch (err) {
        setError('Failed to load default descriptors.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDefaultDescriptors();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setLoading(true);
        for (const file of e.target.files) {
            const buffer = await file.arrayBuffer();
            await loadDescriptors(buffer);
        }
        setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      localStorage.theme = 'light';
    } else {
      localStorage.theme = 'dark';
    }
    // Re-apply the class based on the new localStorage value
    if (localStorage.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Initial theme setting on load
  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const packages = files.reduce((acc: Record<string, ProtoFile[]>, file) => {
    if (!acc[file.package]) {
      acc[file.package] = [];
    }
    acc[file.package].push(file);
    return acc;
  }, {});

  const protoPackages: ProtoPackage[] = Object.entries(packages).map(([name, files]) => ({ name, files }));

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  

  return (
    <Router>
        <Routes>
            <Route path="/" element={<PackageListView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} onFileChange={handleFileChange} />} />
            <Route path="/package/:packageName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
            
            <Route path="/package/:packageName/files/:fileName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
            <Route path="/package/:packageName/:itemType/:itemName" element={<PackageDocumentationView packages={protoPackages} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />} />
        </Routes>
    </Router>
  );
}