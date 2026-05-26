/**
 * Resolves the fully-qualified name (FQN) of an option.
 *
 * Custom options are bracketed (e.g., "[google.api.http]") in the raw options JSON.
 * Standard options are plain names (e.g., "goPackage").
 */
export function getOptionFqn(parentOptionsMessage: string, optionKey: string): string {
  if (optionKey.startsWith('[') && optionKey.endsWith(']')) {
    const stripped = optionKey.slice(1, -1);
    return stripped.startsWith('.') ? stripped : `.${stripped}`;
  }
  if (optionKey.includes('.')) {
    return optionKey.startsWith('.') ? optionKey : `.${optionKey}`;
  }
  return `.google.protobuf.${parentOptionsMessage}.${optionKey}`;
}

/**
 * Traverses all file descriptors in the schema to discover and index:
 * 1. Top-level and nested extensions (custom options)
 * 2. Standard option fields defined in google.protobuf option messages (e.g. FileOptions)
 *
 * Populates their info directly into the global typeIndex.
 */
export function populateTypeIndexWithOptions(schema: { file: any[] }, index: Record<string, any>) {
  // Helper to recursively index nested extensions inside messages
  const indexNestedExtensions = (msg: any, parentFqn: string, fileName: string) => {
    const msgFqn = `${parentFqn}.${msg.name}`;
    
    msg.extension?.forEach((ext: any) => {
      const extFqn = `${msgFqn}.${ext.name}`;
      index[extFqn] = {
        kind: 'option',
        obj: ext,
        file: fileName,
        defFqn: extFqn,
      };
    });

    msg.nestedType?.forEach((nested: any) => {
      indexNestedExtensions(nested, msgFqn, fileName);
    });
  };

  schema.file.forEach((f) => {
    const pkgPrefix = f.package ? `.${f.package}` : '';

    // 1. Index top-level extensions
    f.extension?.forEach((ext: any) => {
      const extFqn = `${pkgPrefix}.${ext.name}`;
      index[extFqn] = {
        kind: 'option',
        obj: ext,
        file: f.name,
        defFqn: extFqn,
      };
    });

    // 2. Index nested extensions inside messages
    f.messageType?.forEach((m: any) => {
      indexNestedExtensions(m, pkgPrefix, f.name);
    });

    // 3. Index standard option fields from descriptor.proto
    if (f.package === 'google.protobuf') {
      const optionMessageNames = [
        'FileOptions',
        'MessageOptions',
        'FieldOptions',
        'OneofOptions',
        'EnumOptions',
        'EnumValueOptions',
        'ServiceOptions',
        'MethodOptions',
      ];
      f.messageType?.forEach((m: any) => {
        if (optionMessageNames.includes(m.name)) {
          const msgFqn = `${pkgPrefix}.${m.name}`;
          m.field?.forEach((fld: any) => {
            const fieldFqnName = `${msgFqn}.${fld.name}`;
            const entry = {
              kind: 'option',
              obj: fld,
              file: f.name,
              defFqn: fieldFqnName,
            };
            // Index both the snake_case and camelCase FQNs
            index[fieldFqnName] = entry;
            if (fld.jsonName && fld.jsonName !== fld.name) {
              const fieldFqnJson = `${msgFqn}.${fld.jsonName}`;
              index[fieldFqnJson] = entry;
            }
          });
        }
      });
    }
  });
}

/**
 * Recursively normalizes a JSON file descriptor object so that all expected array
 * properties are present (defaulting to empty arrays `[]`) and syntax defaults to `""`.
 * This prevents TypeErrors when passed directly to `createFileRegistry`.
 */
export function normalizeFileDescriptor(f: any) {
  f.syntax = f.syntax || "";
  f.dependency = f.dependency || [];
  f.publicDependency = f.publicDependency || [];
  f.weakDependency = f.weakDependency || [];
  f.messageType = f.messageType || [];
  f.enumType = f.enumType || [];
  f.service = f.service || [];
  f.extension = f.extension || [];

  f.messageType.forEach(normalizeMessage);
  f.enumType.forEach(normalizeEnum);
  f.service.forEach(normalizeService);
}

function normalizeMessage(m: any) {
  m.field = m.field || [];
  m.nestedType = m.nestedType || [];
  m.enumType = m.enumType || [];
  m.extensionRange = m.extensionRange || [];
  m.extension = m.extension || [];
  m.oneofDecl = m.oneofDecl || [];
  m.reservedRange = m.reservedRange || [];
  m.reservedName = m.reservedName || [];

  m.nestedType.forEach(normalizeMessage);
  m.enumType.forEach(normalizeEnum);
}

function normalizeEnum(e: any) {
  e.value = e.value || [];
  e.reservedRange = e.reservedRange || [];
  e.reservedName = e.reservedName || [];
}

function normalizeService(s: any) {
  s.method = s.method || [];
}

