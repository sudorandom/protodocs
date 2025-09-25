
import { useParams } from 'react-router-dom';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import protobuf from 'react-syntax-highlighter/dist/esm/languages/prism/protobuf';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('protobuf', protobuf);
import { type ProtoPackage, type ProtoFile } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const generateFileSource = (file: ProtoFile) => {
    let source = file.edition ? `edition = "${file.edition.replace("EDITION_", "")}";\n\n` : `syntax = "proto3";\n\n`;
    source += `package ${file.package};\n\n`;

    if (file.options) {
        source += formatProtobufOptions(file.options) + '\n\n';
    }

    (file.extensions || []).forEach(ext => {
        if (ext.description) {
            source += `// ${ext.description.replace(/\n/g, '\n// ')}
`;
        }
        source += `extend ${ext.extendee} {
`;
        const repeated = ext.isRepeated ? 'repeated ' : '';
        source += `  ${repeated}${ext.type} ${ext.name} = ${ext.tag};
`;
        source += `}

`;
    });

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
            <SyntaxHighlighter
                language="protobuf"
                style={atomDark}
                customStyle={{ background: 'transparent' }}
                wrapLines={true}
                codeTagProps={{ style: { whiteSpace: 'pre-wrap' } }}>
                {generateFileSource(protoFile)}
            </SyntaxHighlighter>
        </div>
    );
}

export default FileSourceContentView;
