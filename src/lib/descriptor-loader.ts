import { fromBinary, toJsonString, createFileRegistry } from '@bufbuild/protobuf';
import { FileDescriptorSetSchema, FileDescriptorProtoSchema } from '@bufbuild/protobuf/wkt';

export interface UnifiedSchema {
  file: any[];
}

/**
 * Extracts comments from the sourceCodeInfo of a file descriptor and attaches them
 * directly to the schema objects (.description property).
 */
export function attachComments(file: any) {
  const locations = new Map<string, any>();
  if (file.sourceCodeInfo && file.sourceCodeInfo.location) {
    for (const loc of file.sourceCodeInfo.location) {
      if (loc.path && loc.path.length > 0) {
        locations.set(loc.path.join(','), loc);
      }
    }
  }

  const getCommentText = (path: number[]): string => {
    const loc = locations.get(path.join(','));
    if (!loc) return '';
    return (loc.leadingComments || loc.trailingComments || '').trim();
  };

  // Package description
  if (file.package) {
    file.description = getCommentText([2]);
  }

  // Message descriptions
  file.messageType?.forEach((msg: any, msgIdx: number) => {
    const msgPath = [4, msgIdx];
    msg.description = getCommentText(msgPath);

    // Fields
    msg.field?.forEach((field: any, fieldIdx: number) => {
      field.description = getCommentText([...msgPath, 2, fieldIdx]);
    });

    // Nested Enums
    msg.enumType?.forEach((nestedEnum: any, nestedEnumIdx: number) => {
      const nestedEnumPath = [...msgPath, 4, nestedEnumIdx];
      nestedEnum.description = getCommentText(nestedEnumPath);
      nestedEnum.value?.forEach((val: any, valIdx: number) => {
        val.description = getCommentText([...nestedEnumPath, 2, valIdx]);
      });
    });

    // Nested Extensions (path index is 6)
    msg.extension?.forEach((ext: any, extIdx: number) => {
      ext.description = getCommentText([...msgPath, 6, extIdx]);
    });

    // Oneof declarations (path index is 8)
    msg.oneofDecl?.forEach((oneof: any, oneofIdx: number) => {
      oneof.description = getCommentText([...msgPath, 8, oneofIdx]);
    });
  });

  // Top-level Enums
  file.enumType?.forEach((enm: any, enmIdx: number) => {
    const enumPath = [5, enmIdx];
    enm.description = getCommentText(enumPath);
    enm.value?.forEach((val: any, valIdx: number) => {
      val.description = getCommentText([...enumPath, 2, valIdx]);
    });
  });

  // Top-level Extensions (path index is 7)
  file.extension?.forEach((ext: any, extIdx: number) => {
    ext.description = getCommentText([7, extIdx]);
  });

  // Services
  file.service?.forEach((svc: any, svcIdx: number) => {
    const svcPath = [6, svcIdx];
    svc.description = getCommentText(svcPath);
    svc.method?.forEach((method: any, methodIdx: number) => {
      method.description = getCommentText([...svcPath, 2, methodIdx]);
    });
  });
}

/**
 * Loads one or more binary FileDescriptorSet files and combines them into a single schema.
 */
export async function loadDescriptorsFromUrls(urls: string[]): Promise<UnifiedSchema> {
  const fileDescriptorsMap = new Map<string, any>();

  // Fetch and parse all files
  const fetchPromises = urls.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch descriptor from ${url}: HTTP ${res.status}`);
      }
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      
      const descriptorSet = fromBinary(FileDescriptorSetSchema, bytes);
      
      for (const fd of descriptorSet.file) {
        fileDescriptorsMap.set(fd.name, fd);
      }
    } catch (err) {
      console.error(`Error loading descriptor file from ${url}:`, err);
      throw err;
    }
  });

  await Promise.all(fetchPromises);

  if (fileDescriptorsMap.size === 0) {
    throw new Error('No files found in any of the loaded descriptor sets');
  }

  // Create a unified registry from all loaded file descriptors to resolve custom options
  const unifiedFds = {
    $typeName: 'google.protobuf.FileDescriptorSet',
    file: Array.from(fileDescriptorsMap.values())
  };
  const registry = createFileRegistry(unifiedFds as any);

  // Convert parsed FileDescriptorProto messages to JSON representation and attach comments
  const fileList = Array.from(fileDescriptorsMap.values()).map((fd) => {
    const jsonStr = toJsonString(FileDescriptorProtoSchema, fd, { registry, enumAsInteger: true });
    const fileObj = JSON.parse(jsonStr);
    attachComments(fileObj);
    return fileObj;
  });

  return { file: fileList };
}
