import { formatOptionValue, formatOptionKey } from './options-formatter-helpers';

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

  const formatComments = (desc?: string, indent: string = ''): string => {
    if (!desc) return '';
    const cleaned = cleanComment(desc);
    return cleaned.split('\n').map(line => `${indent}// ${line}`).join('\n') + '\n';
  };

  if (file.description) {
    out += formatComments(file.description);
  }
  
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
    const publicSet = new Set<number>(file.publicDependency || []);
    const weakSet = new Set<number>(file.weakDependency || []);
    const depsWithMetadata = file.dependency.map((dep: string, index: number) => ({
      name: dep,
      isPublic: publicSet.has(index),
      isWeak: weakSet.has(index)
    }));

    // Sort alphabetically by dependency name
    depsWithMetadata.sort((a: any, b: any) => a.name.localeCompare(b.name));

    depsWithMetadata.forEach((dep: any) => {
      const modifier = dep.isPublic ? 'public ' : dep.isWeak ? 'weak ' : '';
      out += `import ${modifier}"${dep.name}";\n`;
    });
    out += `\n`;
  }

  // File Options
  if (file.options) {
    const optionEntries: [string, any][] = [];
    Object.entries(file.options).forEach(([k, v]) => {
      if (k.startsWith('$') || k === 'uninterpretedOption') return;
      optionEntries.push([k, v]);
    });

    if (optionEntries.length > 0) {
      const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
      const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
      const customEntries = optionEntries.filter(([k]) => isCustom(k));
      standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
      customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

      const sortedEntries = [...standardEntries, ...customEntries];
      sortedEntries.forEach(([k, v]) => {
        const formattedKey = formatOptionKey(k);
        if (Array.isArray(v)) {
          v.forEach((item: any) => {
            out += `option ${formattedKey} = ${formatOptionValue(item, k, 'FileOptions', typeIndex)};\n`;
          });
        } else {
          out += `option ${formattedKey} = ${formatOptionValue(v, k, 'FileOptions', typeIndex)};\n`;
        }
      });
      out += `\n`;
    }
  }



  const formatField = (field: any, indent: string, mapEntries: Record<string, any>, inOneof = false): string => {
    let fieldLine = indent;

    const lastPart = field.typeName ? field.typeName.split('.').pop() : '';
    if ((field.type === 11 || field.type === 'TYPE_MESSAGE') && lastPart && mapEntries[lastPart]) {
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

    const optionEntries: [string, any][] = [];
    if (field.jsonName && field.jsonName !== field.name) {
      optionEntries.push(['json_name', field.jsonName]);
    }
    if (field.options) {
      Object.entries(field.options).forEach(([k, v]) => {
        if (k.startsWith('$') || k === 'uninterpretedOption') return;
        optionEntries.push([k, v]);
      });
    }

    if (optionEntries.length > 0) {
      const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
      const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
      const customEntries = optionEntries.filter(([k]) => isCustom(k));
      standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
      customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

      const sortedEntries = [...standardEntries, ...customEntries];
      const opts: string[] = [];
      sortedEntries.forEach(([k, v]) => {
        const formattedKey = formatOptionKey(k);
        if (Array.isArray(v)) {
          v.forEach((item: any) => {
            opts.push(`${formattedKey} = ${formatOptionValue(item, k, 'FieldOptions', typeIndex)}`);
          });
        } else {
          opts.push(`${formattedKey} = ${formatOptionValue(v, k, 'FieldOptions', typeIndex)}`);
        }
      });
      fieldLine += ` [${opts.join(', ')}]`;
    }

    fieldLine += ';\n';
    return fieldLine;
  };

  const formatEnum = (enm: any, indent: string): string => {
    let body = '';

    // 1. Enum options
    if (enm.options) {
      const optionEntries: [string, any][] = [];
      Object.entries(enm.options).forEach(([k, v]) => {
        if (k.startsWith('$') || k === 'uninterpretedOption') return;
        optionEntries.push([k, v]);
      });

      if (optionEntries.length > 0) {
        const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
        const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
        const customEntries = optionEntries.filter(([k]) => isCustom(k));
        standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
        customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

        const sortedEntries = [...standardEntries, ...customEntries];
        sortedEntries.forEach(([k, v]) => {
          const formattedKey = formatOptionKey(k);
          const currentIndentLevel = indent.length / 2 + 1;
          if (Array.isArray(v)) {
            v.forEach((item: any) => {
              body += `${indent}  option ${formattedKey} = ${formatOptionValue(item, k, 'EnumOptions', typeIndex, currentIndentLevel)};\n`;
            });
          } else {
            body += `${indent}  option ${formattedKey} = ${formatOptionValue(v, k, 'EnumOptions', typeIndex, currentIndentLevel)};\n`;
          }
        });
      }
    }

    // 2. Enum values
    if (enm.value && enm.value.length > 0) {
      if (body !== '') {
        body += '\n'; // Blank line after enum options
      }
      enm.value.forEach((val: any) => {
        body += formatComments(val.description, indent + '  ');
        let valLine = `${indent}  ${val.name} = ${val.number}`;

        const optionEntries: [string, any][] = [];
        if (val.options) {
          Object.entries(val.options).forEach(([k, v]) => {
            if (k.startsWith('$') || k === 'uninterpretedOption') return;
            optionEntries.push([k, v]);
          });
        }

        if (optionEntries.length > 0) {
          const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
          const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
          const customEntries = optionEntries.filter(([k]) => isCustom(k));
          standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
          customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

          const sortedEntries = [...standardEntries, ...customEntries];
          const opts: string[] = [];
          sortedEntries.forEach(([k, v]) => {
            const formattedKey = formatOptionKey(k);
            if (Array.isArray(v)) {
              v.forEach((item: any) => {
                opts.push(`${formattedKey} = ${formatOptionValue(item, k, 'EnumValueOptions', typeIndex)}`);
              });
            } else {
              opts.push(`${formattedKey} = ${formatOptionValue(v, k, 'EnumValueOptions', typeIndex)}`);
            }
          });
          valLine += ` [${opts.join(', ')}]`;
        }

        valLine += ';\n';
        body += valLine;
      });
    }

    let enumStr = '';
    enumStr += formatComments(enm.description, indent);
    enumStr += `${indent}enum ${enm.name} {\n`;
    enumStr += body;
    enumStr += `${indent}}\n\n`;
    return enumStr;
  };

  const formatMessage = (msg: any, indent: string): string => {
    let body = '';

    // 1. Message options
    if (msg.options) {
      const optionEntries: [string, any][] = [];
      Object.entries(msg.options).forEach(([k, v]) => {
        if (k.startsWith('$') || k === 'uninterpretedOption' || k === 'mapEntry' || k === 'map_entry') return;
        optionEntries.push([k, v]);
      });

      if (optionEntries.length > 0) {
        const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
        const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
        const customEntries = optionEntries.filter(([k]) => isCustom(k));
        standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
        customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

        const sortedEntries = [...standardEntries, ...customEntries];
        sortedEntries.forEach(([k, v]) => {
          const formattedKey = formatOptionKey(k);
          const currentIndentLevel = indent.length / 2 + 1;
          if (Array.isArray(v)) {
            v.forEach((item: any) => {
              body += `${indent}  option ${formattedKey} = ${formatOptionValue(item, k, 'MessageOptions', typeIndex, currentIndentLevel)};\n`;
            });
          } else {
            body += `${indent}  option ${formattedKey} = ${formatOptionValue(v, k, 'MessageOptions', typeIndex, currentIndentLevel)};\n`;
          }
        });
      }
    }

    // Map nested types to map entries to avoid printing them as standard nested messages
    const mapEntries: Record<string, { keyType: string, valueType: string }> = {};
    msg.nestedType?.forEach((nm: any) => {
      if (nm.options?.mapEntry || nm.options?.map_entry) {
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

    // 2. Nested Enums
    msg.enumType?.forEach((enm: any) => {
      if (body !== '' && !body.endsWith('\n\n')) body += '\n';
      body += formatEnum(enm, indent + '  ');
    });

    // 3. Nested Messages (filtering out map entry messages)
    msg.nestedType?.filter((nm: any) => !(nm.options?.mapEntry || nm.options?.map_entry)).forEach((nestedMsg: any) => {
      if (body !== '' && !body.endsWith('\n\n')) body += '\n';
      body += formatMessage(nestedMsg, indent + '  ');
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

    // 4. Normal fields
    if (normalFields.length > 0) {
      if (body !== '' && !body.endsWith('\n\n')) body += '\n';
      normalFields.forEach((field) => {
        body += formatComments(field.description, indent + '  ');
        body += formatField(field, indent + '  ', mapEntries);
      });
    }

    // 5. Oneofs
    msg.oneofDecl?.forEach((oneof: any, oneofIdx: number) => {
      const fields = oneofFields[oneofIdx] || [];
      if (fields.length === 0) return;
      if (body !== '' && !body.endsWith('\n\n')) body += '\n';

      body += formatComments(oneof.description, indent + '  ');
      body += `${indent}  oneof ${oneof.name} {\n`;

      let hasOneofOptions = false;
      let oneofBody = '';
      if (oneof.options) {
        const optionEntries: [string, any][] = [];
        Object.entries(oneof.options).forEach(([k, v]) => {
          if (k.startsWith('$') || k === 'uninterpretedOption') return;
          optionEntries.push([k, v]);
        });

        if (optionEntries.length > 0) {
          const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
          const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
          const customEntries = optionEntries.filter(([k]) => isCustom(k));
          standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
          customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

          const sortedEntries = [...standardEntries, ...customEntries];
          sortedEntries.forEach(([k, v]) => {
            const formattedKey = formatOptionKey(k);
            const currentIndentLevel = indent.length / 2 + 2;
            if (Array.isArray(v)) {
              v.forEach((item: any) => {
                oneofBody += `${indent}    option ${formattedKey} = ${formatOptionValue(item, k, 'OneofOptions', typeIndex, currentIndentLevel)};\n`;
              });
            } else {
              oneofBody += `${indent}    option ${formattedKey} = ${formatOptionValue(v, k, 'OneofOptions', typeIndex, currentIndentLevel)};\n`;
            }
          });
          hasOneofOptions = true;
        }
      }

      if (hasOneofOptions && fields.length > 0) {
        oneofBody += '\n';
      }

      fields.forEach((field) => {
        oneofBody += formatComments(field.description, indent + '    ');
        oneofBody += formatField(field, indent + '    ', mapEntries, true);
      });

      body += oneofBody;
      body += `${indent}  }\n`;
    });

    let msgStr = '';
    msgStr += formatComments(msg.description, indent);
    msgStr += `${indent}message ${msg.name} {\n`;
    msgStr += body;
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
    let body = '';

    // Service options
    if (svc.options) {
      const optionEntries: [string, any][] = [];
      Object.entries(svc.options).forEach(([k, v]) => {
        if (k.startsWith('$') || k === 'uninterpretedOption') return;
        optionEntries.push([k, v]);
      });

      if (optionEntries.length > 0) {
        const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
        const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
        const customEntries = optionEntries.filter(([k]) => isCustom(k));
        standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
        customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

        const sortedEntries = [...standardEntries, ...customEntries];
        sortedEntries.forEach(([k, v]) => {
          const formattedKey = formatOptionKey(k);
          if (Array.isArray(v)) {
            v.forEach((item: any) => {
              body += `  option ${formattedKey} = ${formatOptionValue(item, k, 'ServiceOptions', typeIndex, 1)};\n`;
            });
          } else {
            body += `  option ${formattedKey} = ${formatOptionValue(v, k, 'ServiceOptions', typeIndex, 1)};\n`;
          }
        });
      }
    }

    // Methods
    if (svc.method && svc.method.length > 0) {
      if (body !== '') {
        body += '\n'; // Blank line after service options
      }
      svc.method.forEach((method: any) => {
        body += formatComments(method.description, '  ');
        const streamInput = method.clientStreaming ? 'stream ' : '';
        const streamOutput = method.serverStreaming ? 'stream ' : '';
        const input = getFieldTypeName({ typeName: method.inputType }, file.package);
        const output = getFieldTypeName({ typeName: method.outputType }, file.package);

        let hasMethodOptions = false;
        let optionLines = '';
        if (method.options) {
          const optionEntries: [string, any][] = [];
          Object.entries(method.options).forEach(([k, v]) => {
            if (k.startsWith('$') || k === 'uninterpretedOption') return;
            optionEntries.push([k, v]);
          });

          if (optionEntries.length > 0) {
            const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
            const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
            const customEntries = optionEntries.filter(([k]) => isCustom(k));
            standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
            customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

            const sortedEntries = [...standardEntries, ...customEntries];
            sortedEntries.forEach(([k, v]) => {
              const formattedKey = formatOptionKey(k);
              if (Array.isArray(v)) {
                v.forEach((item: any) => {
                  optionLines += `    option ${formattedKey} = ${formatOptionValue(item, k, 'MethodOptions', typeIndex, 2)};\n`;
                });
              } else {
                optionLines += `    option ${formattedKey} = ${formatOptionValue(v, k, 'MethodOptions', typeIndex, 2)};\n`;
              }
            });
            hasMethodOptions = true;
          }
        }

        if (hasMethodOptions) {
          body += `  rpc ${method.name}(${streamInput}${input}) returns (${streamOutput}${output}) {\n`;
          body += optionLines;
          body += `  }\n`;
        } else {
          body += `  rpc ${method.name}(${streamInput}${input}) returns (${streamOutput}${output});\n`;
        }
      });
    }

    out += formatComments(svc.description, '');
    out += `service ${svc.name} {\n`;
    out += body;
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
