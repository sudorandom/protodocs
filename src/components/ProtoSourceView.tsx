import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Service, Enum, Extension } from '../types';

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

const ProtoSourceView = ({ item, type }: { item: Message | Service | Enum | Extension, type: string }) => {
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
        } else if (type === 'extensions') {
            const ext = item as Extension;
            source += `extend ${ext.extendee} {
`;
            const repeated = ext.isRepeated ? 'repeated ' : '';
            source += `  ${repeated}${ext.type} ${ext.name} = ${ext.tag};
`;
            source += `}`;
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

export default ProtoSourceView;
