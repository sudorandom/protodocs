import { fromBinary, toJsonString, createFileRegistry } from '@bufbuild/protobuf';
import { FileDescriptorSetSchema, FileDescriptorProtoSchema } from '@bufbuild/protobuf/wkt';
import { resolveUrl } from './proxy';
import { getWellKnownTypes } from './wellknowntypes';

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
      if (loc.path) {
        locations.set(loc.path.join(','), loc);
      }
    }
  }

  const getCommentText = (path: number[]): string => {
    const loc = locations.get(path.join(','));
    if (!loc) return '';
    const parts: string[] = [];
    const detached = loc.leadingDetachedComments || loc.leading_detached_comments;
    if (detached && detached.length > 0) {
      parts.push(...detached);
    }
    if (loc.leadingComments) {
      parts.push(loc.leadingComments);
    }
    if (loc.trailingComments) {
      parts.push(loc.trailingComments);
    }
    return parts.join('\n\n').trim();
  };

  // File description (header comments)
  let fileComment = getCommentText([]);
  if (!fileComment) {
    fileComment = getCommentText([12]); // syntax
  }
  if (!fileComment && file.package) {
    fileComment = getCommentText([2]); // package
  }
  file.description = fileComment;

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

  // Initialize with inlined well-known types
  const wktFiles = getWellKnownTypes();
  for (const fd of wktFiles) {
    fileDescriptorsMap.set(fd.name, fd);
  }

  // Fetch and parse all files
  const fetchPromises = urls.map(async (url) => {
    try {
      const res = await fetch(resolveUrl(url));
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
      console.error('Error loading descriptor file from:', url, err);
      if (url.includes('wellknowntypes.binpb')) {
        console.warn('Non-fatal warning: Failed to load well-known types from descriptor URL. Continuing.', url);
      } else {
        throw err;
      }
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

/**
 * Parses a list of binary FileDescriptorSet byte buffers and combines them into a single schema.
 */
export async function loadDescriptorsFromBytesList(buffers: Uint8Array[]): Promise<UnifiedSchema> {
  const fileDescriptorsMap = new Map<string, any>();

  // Initialize with inlined well-known types
  const wktFiles = getWellKnownTypes();
  for (const fd of wktFiles) {
    fileDescriptorsMap.set(fd.name, fd);
  }

  // Parse all file descriptor sets in the buffers
  for (const bytes of buffers) {
    try {
      const descriptorSet = fromBinary(FileDescriptorSetSchema, bytes);
      for (const fd of descriptorSet.file) {
        fileDescriptorsMap.set(fd.name, fd);
      }
    } catch (err) {
      console.error('Failed to parse bytes as FileDescriptorSet:', err);
      throw new Error('Failed to parse descriptor. Ensure the file is a valid binary FileDescriptorSet.');
    }
  }

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
