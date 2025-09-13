import { type Message, type Service, type Enum, type Extension } from '../../types';

const generateIndent = (level: number): string => '  '.repeat(level);

const generateEnumSource = (enumItem: Enum, indentLevel: number): string => {
    let source = '';
    if (enumItem.description) {
        source += `${generateIndent(indentLevel)}// ${enumItem.description.replace(/\n/g, `\n${generateIndent(indentLevel)}// `)}\n`;
    }
    source += `${generateIndent(indentLevel)}enum ${enumItem.name} {\n`;
    if (enumItem.values) {
        enumItem.values.forEach(value => {
            if (value.description) {
                source += `${generateIndent(indentLevel + 1)}// ${value.description.replace(/\n/g, `\n${generateIndent(indentLevel + 1)}// `)}\n`;
            }
            source += `${generateIndent(indentLevel + 1)}${value.name} = ${value.value};\n`;
        });
    }
    source += `${generateIndent(indentLevel)}}\n`;
    return source;
};

const generateMessageSource = (message: Message, indentLevel: number): string => {
    let source = '';
    if (message.description) {
        source += `${generateIndent(indentLevel)}// ${message.description.replace(/\n/g, `\n${generateIndent(indentLevel)}// `)}\n`;
    }
    source += `${generateIndent(indentLevel)}message ${message.name} {\n`;

    if (message.nestedEnums) {
        message.nestedEnums.forEach(nestedEnum => {
            source += `\n${generateEnumSource(nestedEnum, indentLevel + 1)}`;
        });
    }

    if (message.nestedMessages) {
        message.nestedMessages.forEach(nestedMessage => {
            source += `\n${generateMessageSource(nestedMessage, indentLevel + 1)}`;
        });
    }

    if (message.fields) {
        message.fields.forEach(field => {
            if (field.description) {
                source += `${generateIndent(indentLevel + 1)}// ${field.description.replace(/\n/g, `\n${generateIndent(indentLevel + 1)}// `)}\n`;
            }
            const repeated = field.isRepeated && !field.isMap ? 'repeated ' : '';
            const fieldType = field.isMap ? `map<${field.keyType}, ${field.valueType}>` : field.type;
            source += `${generateIndent(indentLevel + 1)}${repeated}${fieldType} ${field.name} = ${field.tag};\n`;
        });
    }

    source += `${generateIndent(indentLevel)}}\n`;
    return source;
}

export const generateSource = (item: Message | Service | Enum | Extension, type: string): string => {
    if (!item) return '';

    if (type === 'messages') {
        return generateMessageSource(item as Message, 0);
    }

    if (type === 'enums') {
        return generateEnumSource(item as Enum, 0);
    }

    let source = ``;
    if (item.description) {
        source += `// ${item.description.replace(/\n/g, '\n// ')}\n`;
    }

    if (type === 'services') {
        const service = item as Service;
        source += `service ${service.name} {\n`;
        if (service.rpcs) {
            service.rpcs.forEach(rpc => {
                if (rpc.description) {
                    source += `  // ${rpc.description.replace(/\n/g, '\n  // ')}\n`;
                }
                const clientStream = rpc.isClientStream ? 'stream ' : '';
                const serverStream = rpc.isServerStream ? 'stream ' : '';
                source += `  rpc ${rpc.name} (${clientStream}${rpc.request}) returns (${serverStream}${rpc.response});\n`;
            });
        }
        source += '}';
    } else if (type === 'extensions') {
        const ext = item as Extension;
        source += `extend ${ext.extendee} {\n`;
        const repeated = ext.isRepeated ? 'repeated ' : '';
        source += `  ${repeated}${ext.type} ${ext.name} = ${ext.tag};\n`;
        source += `}`;
    }

    return source;
};
