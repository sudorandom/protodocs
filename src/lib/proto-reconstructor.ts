import { formatOptionValue } from './options-formatter-helpers';

/**
 * Helper to clean type name based on package scoping.
 */
function getFieldTypeName(field: any, currentPackage?: string): string {
  if (field.typeName) {
    let name = field.typeName.startsWith('.') ? field.typeName.substring(1) : field.typeName;
    if (currentPackage && name.startsWith(currentPackage + '.')) {
      name = name.substring(currentPackage.length + 1);
    }
    return name;
  }

  const typeMap: Record<number | string, string> = {
    1: 'double', 2: 'float', 3: 'int64', 4: 'uint64', 5: 'int32',
    6: 'fixed64', 7: 'fixed32', 8: 'bool', 9: 'string', 12: 'bytes',
    13: 'uint32', 15: 'sfixed32', 16: 'sfixed64', 17: 'sint32', 18: 'sint64',
    'TYPE_DOUBLE': 'double', 'TYPE_FLOAT': 'float', 'TYPE_INT64': 'int64',
    'TYPE_UINT64': 'uint64', 'TYPE_INT32': 'int32', 'TYPE_FIXED64': 'fixed64',
    'TYPE_FIXED32': 'fixed32', 'TYPE_BOOL': 'bool', 'TYPE_STRING': 'string',
    'TYPE_BYTES': 'bytes', 'TYPE_UINT32': 'uint32', 'TYPE_SFIXED32': 'sfixed32',
    'TYPE_SFIXED64': 'sfixed64', 'TYPE_SINT32': 'sint32', 'TYPE_SINT64': 'sint64'
  };
  return typeMap[field.type] || 'string';
}

export function getEditionString(edition: any): string | null {
  if (!edition) return null;
  if (edition === 'EDITION_2023' || edition === 1000 || edition === '1000' || edition === 1) {
    return '2023';
  }
  if (edition === 'EDITION_LEGACY' || edition === 900 || edition === '900') {
    return 'legacy';
  }
  if (typeof edition === 'string' && edition.startsWith('EDITION_')) {
    return edition.substring(8).toLowerCase();
  }
  return String(edition);
}

/**
 * Reconstructs a clean .proto text definition from a FileDescriptorProto JSON object.
 */
export function reconstructProto(file: any, typeIndex?: Record<string, any>): string {
  let out = '';
  
  const editionStr = getEditionString(file.edition);
  if (editionStr) {
    out += `edition = "${editionStr}";\n\n`;
  } else if (file.syntax) {
    out += `syntax = "${file.syntax}";\n\n`;
  } else {
    out += `syntax = "proto2";\n\n`;
  }

  if (file.package) {
    out += `package ${file.package};\n\n`;
  }

  if (file.dependency && file.dependency.length > 0) {
    file.dependency.forEach((dep: string) => {
      out += `import "${dep}";\n`;
    });
    out += `\n`;
  }

  // File Options
  if (file.options) {
    let hasOptions = false;
    Object.entries(file.options).forEach(([k, v]) => {
      if (k.startsWith('$') || k === 'uninterpretedOption') return;
      // Repeated option values must be emitted as separate `option` statements
      if (Array.isArray(v)) {
        v.forEach((item: any) => {
          out += `option ${k} = ${formatOptionValue(item, k, 'FileOptions', typeIndex)};\n`;
        });
      } else {
        out += `option ${k} = ${formatOptionValue(v, k, 'FileOptions', typeIndex)};\n`;
      }
      hasOptions = true;
    });
    if (hasOptions) out += `\n`;
  }

  const formatComments = (desc?: string, indent: string = ''): string => {
    if (!desc) return '';
    const cleaned = cleanComment(desc);
    return cleaned.split('\n').map(line => `${indent}// ${line}`).join('\n') + '\n';
  };

  const formatField = (field: any, indent: string, mapEntries: Record<string, any>, inOneof = false): string => {
    let fieldLine = indent;

    const lastPart = field.typeName ? field.typeName.split('.').pop() : '';
    if (field.type === 11 && lastPart && mapEntries[lastPart]) {
      const entry = mapEntries[lastPart];
      fieldLine += `map<${entry.keyType}, ${entry.valueType}> ${field.name} = ${field.number}`;
    } else {
      if (!inOneof) {
        if (field.label === 'LABEL_REPEATED' || field.label === 3) {
          fieldLine += 'repeated ';
        } else if (field.label === 'LABEL_REQUIRED' || field.label === 2) {
          fieldLine += 'required ';
        } else if (field.label === 'LABEL_OPTIONAL' || field.label === 1) {
          // proto2 always needs explicit `optional`; proto3 only needs it for proto3optional fields;
          // editions don't use labels at all
          const isEditions = !!file.edition;
          const isProto3 = file.syntax === 'proto3';
          if (!isEditions && (!isProto3 || field.proto3Optional)) {
            fieldLine += 'optional ';
          }
        }
      }

      const typeName = getFieldTypeName(field, file.package);
      fieldLine += `${typeName} ${field.name} = ${field.number}`;
    }

    const opts: string[] = [];
    if (field.jsonName && field.jsonName !== field.name) {
      opts.push(`json_name = "${field.jsonName}"`);
    }
    if (field.options) {
      Object.entries(field.options).forEach(([k, v]) => {
        if (k.startsWith('$') || k === 'uninterpretedOption') return;
        // Repeated option values must be emitted as separate key=value pairs inside []
        if (Array.isArray(v)) {
          v.forEach((item: any) => {
            opts.push(`${k} = ${formatOptionValue(item, k, 'FieldOptions', typeIndex)}`);
          });
        } else {
          opts.push(`${k} = ${formatOptionValue(v, k, 'FieldOptions', typeIndex)}`);
        }
      });
    }
    if (opts.length > 0) {
      fieldLine += ` [${opts.join(', ')}]`;
    }

    fieldLine += ';\n';
    return fieldLine;
  };

  const formatEnum = (enm: any, indent: string): string => {
    let enumStr = '';
    enumStr += formatComments(enm.description, indent);
    enumStr += `${indent}enum ${enm.name} {\n`;
    enm.value?.forEach((val: any) => {
      enumStr += formatComments(val.description, indent + '  ');
      enumStr += `${indent}  ${val.name} = ${val.number};\n`;
    });
    enumStr += `${indent}}\n\n`;
    return enumStr;
  };

  const formatMessage = (msg: any, indent: string): string => {
    let msgStr = '';
    msgStr += formatComments(msg.description, indent);
    msgStr += `${indent}message ${msg.name} {\n`;

    // Map nested types to map entries to avoid printing them as standard nested messages
    const mapEntries: Record<string, { keyType: string, valueType: string }> = {};
    msg.nestedType?.forEach((nm: any) => {
      if (nm.options?.mapEntry) {
        const keyField = nm.field?.find((f: any) => f.number === 1);
        const valField = nm.field?.find((f: any) => f.number === 2);
        if (keyField && valField) {
          mapEntries[nm.name] = {
            keyType: getFieldTypeName(keyField, file.package),
            valueType: getFieldTypeName(valField, file.package),
          };
        }
      }
    });

    // Nested Enums
    msg.enumType?.forEach((enm: any) => {
      msgStr += formatEnum(enm, indent + '  ');
    });

    // Nested Messages (filtering out map entry messages)
    msg.nestedType?.filter((nm: any) => !nm.options?.mapEntry).forEach((nestedMsg: any) => {
      msgStr += formatMessage(nestedMsg, indent + '  ');
    });

    // Group fields by oneof index
    const normalFields: any[] = [];
    const oneofFields: Record<number, any[]> = {};

    msg.field?.forEach((field: any) => {
      if (field.oneofIndex !== undefined && !field.proto3Optional) {
        if (!oneofFields[field.oneofIndex]) {
          oneofFields[field.oneofIndex] = [];
        }
        oneofFields[field.oneofIndex].push(field);
      } else {
        normalFields.push(field);
      }
    });

    // Render normal fields
    normalFields.forEach((field) => {
      msgStr += formatComments(field.description, indent + '  ');
      msgStr += formatField(field, indent + '  ', mapEntries);
    });

    // Render oneofs
    msg.oneofDecl?.forEach((oneof: any, oneofIdx: number) => {
      const fields = oneofFields[oneofIdx] || [];
      if (fields.length === 0) return;
      msgStr += formatComments(oneof.description, indent + '  ');
      msgStr += `${indent}  oneof ${oneof.name} {\n`;
      fields.forEach((field) => {
        msgStr += formatComments(field.description, indent + '    ');
        msgStr += formatField(field, indent + '    ', mapEntries, true);
      });
      msgStr += `${indent}  }\n\n`;
    });

    msgStr += `${indent}}\n\n`;
    return msgStr;
  };

  // Top level Enums
  file.enumType?.forEach((enm: any) => {
    out += formatEnum(enm, '');
  });

  // Top level Messages
  file.messageType?.forEach((msg: any) => {
    out += formatMessage(msg, '');
  });

  // Services
  file.service?.forEach((svc: any) => {
    out += formatComments(svc.description, '');
    out += `service ${svc.name} {\n`;
    svc.method?.forEach((method: any) => {
      out += formatComments(method.description, '  ');
      const streamInput = method.clientStreaming ? 'stream ' : '';
      const streamOutput = method.serverStreaming ? 'stream ' : '';
      const input = getFieldTypeName({ typeName: method.inputType }, file.package);
      const output = getFieldTypeName({ typeName: method.outputType }, file.package);
      out += `  rpc ${method.name}(${streamInput}${input}) returns (${streamOutput}${output});\n`;
    });
    out += `}\n\n`;
  });

  return out.trim() + '\n';
}

export function cleanComment(desc: string): string {
  if (!desc) return '';
  const lines = desc.split('\n');
  if (lines.length <= 1) return desc;

  let hasExtraLeadingSpace = true;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && !line.startsWith(' ')) {
      hasExtraLeadingSpace = false;
      break;
    }
  }

  if (hasExtraLeadingSpace) {
    return lines
      .map((line, idx) => {
        if (idx === 0) return line;
        if (line.startsWith(' ')) return line.substring(1);
        return line;
      })
      .join('\n');
  }

  return desc;
}
