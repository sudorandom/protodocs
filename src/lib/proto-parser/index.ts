/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRegistry, ScalarType, fromBinary } from '@bufbuild/protobuf';
import { FileDescriptorSetSchema } from '@bufbuild/protobuf/wkt';
import { type Field, type Extension, type Message, type EnumValue, type Enum, type Rpc, type Service, type ProtoFile, type Commentable } from '../../types';

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

    const getComment = (path: number[]): Commentable => {
        const loc = locations.get(path.join(','));
        if (!loc) return { description: '' };
        return {
            description: (loc.leadingComments || loc.trailingComments || '').trim(),
            leadingComments: loc.leadingComments,
            trailingComments: loc.trailingComments,
            leadingDetachedComments: loc.leadingDetachedComments,
        };
    };

    const transformEnums = (enumDescriptors: any[], path: number[]): Enum[] => {
        if (!enumDescriptors) return [];
        return enumDescriptors.map((enumType, i) => {
            const enumPath = path.concat(i);
            const values: EnumValue[] = (enumType.value || []).map((val: any, j: number) => ({
                name: val.name || '',
                value: val.number || 0,
                ...getComment(enumPath.concat(2, j)), // 2 is for values
            }));
            return {
                name: enumType.name || '',
                values,
                ...getComment(enumPath),
            };
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
                if (field.label === 'LABEL_REPEATED' && field.type === 11 && fieldMessageType?.options?.mapEntry) {
                    isMap = true;
                    const valueField = fieldMessageType.field.find((f:any) => f.number === 2);
                    const keyField = fieldMessageType.field.find((f:any) => f.number === 1);
                    
                    if(keyField?.type) {
                        const keyTypeName = ScalarType[keyField.type];
                        keyType = keyTypeName.toLowerCase();
                    }

                    if (valueField?.typeName) {
                        valueType = valueField.typeName.startsWith('.') ? valueField.typeName.substring(1) : valueField.typeName;
                    } else if (valueField?.type) {
                        const valueTypeName = ScalarType[valueField.type];
                        valueType = valueTypeName.toLowerCase();
                    }
                    typeName = field.typeName.startsWith('.') ? field.typeName.substring(1) : field.typeName;
                } else {
                    if (field.typeName) {
                        typeName = field.typeName.startsWith('.') ? field.typeName.substring(1) : field.typeName;
                    }
                    else if (typeof field.type === 'number') {
                        const scalarTypeName = ScalarType[field.type];
                        typeName = scalarTypeName.toLowerCase();
                    }
                    else {
                        typeName = 'unknown';
                    }
                }

                return {
                    name: field.name || '',
                    type: typeName,
                    tag: field.number || 0,
                    isRepeated: field.label === 'LABEL_REPEATED' && !isMap,
                    isMap,
                    keyType,
                    valueType,
                    ...getComment(msgPath.concat(2, j)), // 2 is for fields
                };
            });

            const nestedMessages = transformMessages(msg.nestedType, messageName, msgPath.concat(3));
            const nestedEnums = transformEnums(msg.enumType, msgPath.concat(4));

            return {
                name: msg.name,
                fields,
                isMapEntry: msg.options?.mapEntry,
                nestedMessages: nestedMessages.length > 0 ? nestedMessages : undefined,
                nestedEnums: nestedEnums.length > 0 ? nestedEnums : undefined,
                ...getComment(msgPath),
            };
        });
    }

    const messages: Message[] = transformMessages(fileDescriptor.messageType, fileDescriptor.package, [4]);
    const enums: Enum[] = transformEnums(fileDescriptor.enumType, [5]);

    const services: Service[] = (fileDescriptor.service || []).map((service: any, i: number) => {
        const servicePath = [6, i];
        const rpcs: Rpc[] = (service.method || []).map((method: any, j: number) => ({
            name: method.name || '',
            request: method.inputType?.startsWith('.') ? method.inputType.substring(1) : method.inputType,
            response: method.outputType?.startsWith('.') ? method.outputType.substring(1) : method.outputType,
            isClientStream: method.clientStreaming || false,
            isServerStream: method.serverStreaming || false,
            ...getComment(servicePath.concat(2, j)),
        }));
        return {
            name: service.name || '',
            rpcs,
            ...getComment(servicePath),
        };
    });

    const extensions: Extension[] = (fileDescriptor.extension || []).map((ext: any, i: number) => {
        const extPath = [7, i];
        let typeName = '';
        if (ext.typeName) {
            typeName = ext.typeName.startsWith('.') ? ext.typeName.substring(1) : ext.typeName;
        } else if (typeof ext.type === 'number') {
            const scalarTypeName = ScalarType[ext.type];
            typeName = scalarTypeName.toLowerCase();
        } else {
            typeName = 'unknown';
        }
        return {
            name: ext.name || '',
            type: typeName,
            tag: ext.number || 0,
            extendee: ext.extendee.startsWith('.') ? ext.extendee.substring(1) : ext.extendee,
            isRepeated: ext.label === 'LABEL_REPEATED',
            ...getComment(extPath),
        };
    });

    return {
        fileName: fileDescriptor.name || '',
        package: fileDescriptor.package || '',
        messages,
        services,
        enums,
        extensions,
        edition: fileDescriptor.edition,
        options: fileDescriptor.options,
        ...getComment([2]),
    };
  };

  export const loadDescriptors = async (
    buffer: ArrayBuffer,
    setFiles: React.Dispatch<React.SetStateAction<ProtoFile[]>>,
    setError: (error: string | null) => void,
    setShowSourceInfoWarning: (show: boolean) => void
) => {
    try {
        
        const fileDescriptorSet = fromBinary(FileDescriptorSetSchema, new Uint8Array(buffer));
        
        createFileRegistry(fileDescriptorSet);

        const allMessageDescriptors = new Map<string, any>();
        for (const file of fileDescriptorSet.file) {
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
        }

        const protoFiles = fileDescriptorSet.file.map((file: any) => {
          return transformToProtoFile(file, allMessageDescriptors, setShowSourceInfoWarning);
        });

        setFiles(prevFiles => {
            const existingFileNames = new Set(prevFiles.map(f => f.fileName));
            const newFiles = protoFiles.filter((pf: ProtoFile) => !existingFileNames.has(pf.fileName));
            return [...prevFiles, ...newFiles];
        });
        setError(null);
    } catch (err) {
        setError('Failed to parse descriptor file. Please ensure it is a valid FileDescriptorSet.');
        console.error(err);
    }
  };
