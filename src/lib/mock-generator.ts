export function generateMockJson(
  typeName: string,
  typeIndex: Record<string, any>,
  visited: Set<string> = new Set()
): any {
  // Prevent infinite loops on recursive definitions
  if (visited.has(typeName)) {
    return {};
  }
  visited.add(typeName);

  // Well-Known Type overrides
  if (typeName === '.google.protobuf.Timestamp') {
    return new Date().toISOString();
  }
  if (typeName === '.google.protobuf.Duration') {
    return "3.000s";
  }
  if (typeName === '.google.protobuf.Empty') {
    return {};
  }
  if (typeName === '.google.protobuf.Struct') {
    return { "example_key": "example_value" };
  }
  if (typeName === '.google.protobuf.Value') {
    return "example_value";
  }
  if (typeName === '.google.protobuf.ListValue') {
    return ["value1", "value2"];
  }

  const typeInfo = typeIndex[typeName];
  if (!typeInfo || typeInfo.kind !== 'message') {
    return {};
  }

  const msg = typeInfo.obj;
  const mock: Record<string, any> = {};
  const generatedOneofs = new Set<number>();

  msg.field?.forEach((f: any) => {
    if (f.oneofIndex !== undefined && f.oneofIndex !== null) {
      if (generatedOneofs.has(f.oneofIndex)) {
        // Skip subsequent fields in the same oneof to prevent duplicate-oneof JSON errors
        return;
      }
      generatedOneofs.add(f.oneofIndex);
    }

    const isRepeated = f.label === 3;
    let val: any = null;

    if (f.typeName) {
      // Message or Enum
      const ref = typeIndex[f.typeName];
      if (ref && ref.kind === 'enum') {
        // Enum: use first enum value name if available
        const firstVal = ref.obj.value?.[0];
        val = firstVal ? firstVal.name : 0;
      } else {
        // Recursively build nested message
        val = generateMockJson(f.typeName, typeIndex, new Set(visited));
      }
    } else {
      // Primitive field
      const typeNum = Number(f.type || 9);
      switch (typeNum) {
        case 1:  // double
        case 2:  // float
        case 5:  // int32
        case 7:  // fixed32
        case 13: // uint32
        case 15: // sfixed32
        case 17: // sint32
          val = 0;
          break;
        case 3:  // int64
        case 4:  // uint64
        case 6:  // fixed64
        case 16: // sfixed64
        case 18: // sint64
          val = "0";
          break;
        case 8:  // bool
          val = false;
          break;
        case 9:  // string
          val = "";
          break;
        case 12: // bytes
          val = "";
          break;
        default:
          val = "";
      }
    }

    mock[f.name] = isRepeated ? [val] : val;
  });

  return mock;
}
