/* eslint-disable @typescript-eslint/no-explicit-any */
import * as protobuf from 'protobufjs';
import { type Field, type Extension, type Message, type EnumValue, type Enum, type Rpc, type Service, type ProtoFile } from '../../types';

const transformToProtoFile = (fileDescriptor: any, allMessageDescriptors: Map<string, any>, setShowSourceInfoWarning: (show: boolean) => void): ProtoFile => {
    const locations = new Map<string, any>();
    if (fileDescriptor.sourceCodeInfo) {
        for (const loc of fileDescriptor.sourceCodeInfo.location) {
            if (loc.path) {
                locations.set(loc.path.join(','), loc);
            }
        }
    } else {
        setShowSourceInfoWarning(true);
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

    const transformEnums = (enumDescriptors: any[], path: number[]): Enum[] => {
        if (!enumDescriptors) return [];
        return enumDescriptors.map((enumType, i) => {
            const enumPath = path.concat(i);
            const values: EnumValue[] = (enumType.value || []).map((val: any, j: number) => ({
                name: val.name || '',
                value: val.number || 0,
                description: getComment(enumPath.concat(2, j)), // 2 is for values
            }));
            return { name: enumType.name || '', description: getComment(enumPath), values };
        });
    };

    const transformMessages = (messageDescriptors: any[], prefix: string, path: number[]): Message[] => {
        if (!messageDescriptors) return [];
        return messageDescriptors.map((msg, i) => {
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
                    }
                    else {
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

            const nestedMessages = transformMessages(msg.nestedType, messageName, msgPath.concat(3)); // 3 is for nested types
            const nestedEnums = transformEnums(msg.enumType, msgPath.concat(4)); // 4 is for enums in messages

            return {
                name: msg.name,
                description: getComment(msgPath),
                fields,
                isMapEntry: msg.options?.mapEntry,
                nestedMessages: nestedMessages.length > 0 ? nestedMessages : undefined,
                nestedEnums: nestedEnums.length > 0 ? nestedEnums : undefined,
            };
        });
    }

    const messages: Message[] = transformMessages(fileDescriptor.messageType, fileDescriptor.package, [4]); // 4 is for messages
    const enums: Enum[] = transformEnums(fileDescriptor.enumType, [5]); // 5 is for enums

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

    const extensions: Extension[] = (fileDescriptor.extension || []).map((ext: any, i: number) => {
        const extPath = [7, i]; // 7 is for extensions in FileDescriptorProto
        let typeName = '';
        if (ext.typeName) {
            typeName = ext.typeName.startsWith('.') ? ext.typeName.substring(1) : ext.typeName;
        } else if (typeof ext.type === 'string' && ext.type.startsWith('TYPE_')) {
            typeName = ext.type.substring('TYPE_'.length).toLowerCase();
        } else {
            typeName = typeStringMap[ext.type] || '';
        }
        return {
            name: ext.name || '',
            type: typeName,
            tag: ext.number || 0,
            description: getComment(extPath),
            extendee: ext.extendee.startsWith('.') ? ext.extendee.substring(1) : ext.extendee,
            isRepeated: ext.label === 3,
        };
    });

    return {
        fileName: fileDescriptor.name || '',
        package: fileDescriptor.package || '',
        description: getComment([2]), // 2 is for package
        messages,
        services,
        enums,
        extensions,
        edition: fileDescriptor.edition,
        options: fileDescriptor.options,
    };
  };

  export const loadDescriptors = async (
    buffer: ArrayBuffer,
    setFiles: React.Dispatch<React.SetStateAction<ProtoFile[]>>,
    setError: (error: string | null) => void,
    setShowSourceInfoWarning: (show: boolean) => void
) => {
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
          return transformToProtoFile(file, allMessageDescriptors, setShowSourceInfoWarning);
        });

        setFiles(prevFiles => {
            const existingFileNames = new Set(prevFiles.map(f => f.fileName));
            const newFiles = protoFiles.filter((pf: ProtoFile) => !existingFileNames.has(pf.fileName));
            return [...prevFiles, ...newFiles];
        });
    } catch (err) {
        setError('Failed to parse descriptor file.');
        console.error(err);
    }
  };
