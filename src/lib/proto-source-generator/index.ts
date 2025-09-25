import { type Message, type Service, type Enum, type Extension, type ProtoPackage, type Commentable, type EnumValue, type Field } from '../../types';

// Custom findLastIndex implementation
const findLastIndex = <T>(array: T[], predicate: (value: T, index: number, obj: T[]) => boolean): number => {
    for (let i = array.length - 1; i >= 0; i--) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }
    return -1;
};

const generateIndent = (level: number): string => '  '.repeat(level);

const formatComment = (comment: string, indentLevel: number, isTrailing = false): string => {
    const indent = generateIndent(indentLevel);
    const lines = comment.trim().split('\n');
    if (isTrailing) {
        return ` // ${lines.join(`\n${indent}// `)}`;
    }
    return lines.map(line => `${indent}// ${line}`).join('\n');
};

const generateComments = (item: Commentable, indentLevel: number): string[] => {
    const lines: string[] = [];
    if (item.leadingDetachedComments) {
        item.leadingDetachedComments.forEach(comment => {
            lines.push(formatComment(comment, indentLevel));
            lines.push(''); // Add a blank line after detached comments
        });
    }
    if (item.leadingComments) {
        lines.push(formatComment(item.leadingComments, indentLevel));
    }
    return lines;
};

const generateEnumSource = (enumItem: Enum, indentLevel: number): string[] => {
    const lines = generateComments(enumItem, indentLevel);
    lines.push(`${generateIndent(indentLevel)}enum ${enumItem.name} {`);

    if (enumItem.values) {
        enumItem.values.forEach((value: EnumValue) => {
            lines.push(...generateComments(value, indentLevel + 1));
            let line = `${generateIndent(indentLevel + 1)}${value.name} = ${String(value.value)};`;
            if (value.trailingComments) {
                line += formatComment(value.trailingComments, 0, true);
            }
            lines.push(line);
        });
    }

    lines.push(`${generateIndent(indentLevel)}}`);
    return lines;
};

const generateMessageSource = (
    message: Message,
    indentLevel: number,
    protoPackage: ProtoPackage,
    allTypes: Map<string, { pkg: ProtoPackage, item: Message | Enum, type: string } >,
    parentMessageName?: string
): string[] => {
    const lines = generateComments(message, indentLevel);
    lines.push(`${generateIndent(indentLevel)}message ${message.name} {`);

    const body: string[] = [];

    if (message.nestedEnums) {
        message.nestedEnums.forEach(nestedEnum => {
            body.push(...generateEnumSource(nestedEnum, indentLevel + 1));
        });
    }

    if (message.nestedMessages) {
        message.nestedMessages.forEach(nestedMessage => {
            body.push(...generateMessageSource(nestedMessage, indentLevel + 1, protoPackage, allTypes, message.name));
        });
    }

    if (message.fields) {
        message.fields.forEach((field: Field) => {
            body.push(...generateComments(field, indentLevel + 1));
            const repeated = field.isRepeated ? 'repeated ' : '';
            let fieldType = field.isMap ? `map<${field.keyType}, ${field.valueType}>` : field.type;

            if (!allTypes.get(fieldType) && parentMessageName) {
                const fqn = `${protoPackage.name}.${parentMessageName}.${fieldType}`;
                if (allTypes.has(fqn)) {
                    fieldType = fqn;
                }
            }

            let line = `${generateIndent(indentLevel + 1)}${repeated}${fieldType} ${field.name} = ${field.tag};`;
            if (field.trailingComments) {
                line += formatComment(field.trailingComments, 0, true);
            }
            body.push(line);
        });
    }

    // Logic to add a blank line between sections
    if (message.nestedEnums?.length && (message.nestedMessages?.length || message.fields?.length)) {
        const firstMessageIndex = body.findIndex(line => line.includes('message '));
        const firstFieldIndex = body.findIndex(line => line.includes(' = '));
        const lastEnumIndex = findLastIndex(body, (line: string) => line.includes('}'));

        if(lastEnumIndex !== -1) {
            if (firstMessageIndex > lastEnumIndex || firstFieldIndex > lastEnumIndex) {
                body.splice(lastEnumIndex + 1, 0, '');
            }
        }
    }
    if (message.nestedMessages?.length && message.fields?.length) {
        const lastMessageIndex = findLastIndex(body, (line: string) => line.includes('}'));
        if (lastMessageIndex !== -1) {
            body.splice(lastMessageIndex + 1, 0, '');
        }
    }

    lines.push(...body);
    lines.push(`${generateIndent(indentLevel)}}`);
    return lines;
}

export const generateSource = (
    item: Message | Service | Enum | Extension,
    type: string,
    protoPackage: ProtoPackage,
    allTypes: Map<string, { pkg: ProtoPackage, item: Message | Enum, type: string }>
): string => {
    if (!item) return '';

    let lines: string[] = [];

    if (type === 'messages') {
        lines = generateMessageSource(item as Message, 0, protoPackage, allTypes);
    } else if (type === 'enums') {
        lines = generateEnumSource(item as Enum, 0);
    } else {
        lines.push(...generateComments(item, 0));
        if (type === 'services') {
            const service = item as Service;
            lines.push(`service ${service.name} {`);
            if (service.rpcs) {
                service.rpcs.forEach(rpc => {
                    lines.push(...generateComments(rpc, 1));
                    const clientStream = rpc.isClientStream ? 'stream ' : '';
                    const serverStream = rpc.isServerStream ? 'stream ' : '';
                    let rpcLine = `${generateIndent(1)}rpc ${rpc.name} (${clientStream}${rpc.request}) returns (${serverStream}${rpc.response});`;
                    if (rpc.trailingComments) {
                        rpcLine += formatComment(rpc.trailingComments, 0, true);
                    }
                    lines.push(rpcLine);
                });
            }
            lines.push('}');
        } else if (type === 'extensions') {
            const ext = item as Extension;
            lines.push(`extend ${ext.extendee} {`);
            const repeated = ext.isRepeated ? 'repeated ' : '';
            let extLine = `${generateIndent(1)}${repeated}${ext.type} ${ext.name} = ${ext.tag};`;
            if (ext.trailingComments) {
                extLine += formatComment(ext.trailingComments, 0, true);
            }
            lines.push(extLine);
            lines.push('}');
        }
    }

    return lines.join('\n');
};