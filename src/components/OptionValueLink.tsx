import React from 'react';
import { getOptionFqn } from '../lib/option-resolver';
import { formatOptionValue, STANDARD_OPTION_ENUMS } from '../lib/options-formatter-helpers';

interface OptionValueLinkProps {
  val: any;
  optionKey: string;
  parentOptionsMessage: string;
  typeIndex: Record<string, any>;
  onMouseEnter: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  onMouseLeave: () => void;
  onPinClick: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  indent?: number;
  parentMessageFqn?: string;
}

const isValueComplex = (v: any): boolean => {
  if (v === null || typeof v !== 'object') {
    return false;
  }
  if (Array.isArray(v)) {
    if (v.length > 1) {
      return true;
    }
    if (v.length === 1 && typeof v[0] === 'object' && v[0] !== null) {
      return true;
    }
    return false;
  }
  const entries = Object.entries(v);
  if (entries.length > 1) {
    return true;
  }
  if (entries.length === 1 && typeof entries[0][1] === 'object' && entries[0][1] !== null) {
    return true;
  }
  return false;
};

export default function OptionValueLink({
  val,
  optionKey,
  parentOptionsMessage,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
  indent = 0,
  parentMessageFqn,
}: OptionValueLinkProps): React.JSX.Element {
  const currentIndent = '  '.repeat(indent);
  const nextIndent = '  '.repeat(indent + 1);

  // Resolve active message FQN for nested fields lookup
  let activeMessageFqn = parentMessageFqn;
  if (!activeMessageFqn) {
    const fqn = getOptionFqn(parentOptionsMessage, optionKey);
    const optionInfo = typeIndex[fqn];
    if (optionInfo && optionInfo.obj.typeName) {
      activeMessageFqn = optionInfo.obj.typeName;
    }
  }

  // Try resolving as an Enum value
  const fqn = getOptionFqn(parentOptionsMessage, optionKey);
  const optionInfo = typeIndex[fqn];

  const renderSingleValue = (v: any) => {
    // 1. Try standard fallback enums first
    const stdEnum = STANDARD_OPTION_ENUMS[fqn];
    if (stdEnum) {
      const num = Number(v);
      const matched = stdEnum.values[num];
      if (matched) {
        const valueFqn = `${stdEnum.enumFqn}.${matched.name}`;
        const desc = { text: matched.description };
        const displayName = matched.name;
        return (
          <span
            className="text-syn-type border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
            onMouseEnter={(e) => onMouseEnter(e, valueFqn, desc, 'enum_value', displayName)}
            onMouseLeave={onMouseLeave}
            onClick={(e) => onPinClick(e, valueFqn, desc, 'enum_value', displayName)}
          >
            {displayName}
          </span>
        );
      }
    }

    // 2. Try resolving dynamically via typeIndex
    if (optionInfo && optionInfo.kind === 'option') {
      const fieldProto = optionInfo.obj;
      if (fieldProto.typeName) {
        const enumTypeFqn = fieldProto.typeName;
        const enumInfo = typeIndex[enumTypeFqn];
        if (enumInfo && enumInfo.kind === 'enum') {
          const enumObj = enumInfo.obj;
          const num = Number(v);
          const matched = enumObj.value?.find((ev: any) => ev.number === num);
          if (matched) {
            const valueFqn = `${enumTypeFqn}.${matched.name}`;
            const desc = { text: matched.description || `Enum constant defined in ${enumObj.name}.` };
            const displayName = matched.name;
            return (
              <span
                className="text-syn-type border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
                onMouseEnter={(e) => onMouseEnter(e, valueFqn, desc, 'enum_value', displayName)}
                onMouseLeave={onMouseLeave}
                onClick={(e) => onPinClick(e, valueFqn, desc, 'enum_value', displayName)}
              >
                {displayName}
              </span>
            );
          }
        }
      }
    }
    // Fallback to formatted primitive string
    return <span className="text-syn-string">{formatOptionValue(v, optionKey, parentOptionsMessage, typeIndex, indent)}</span>;
  };

  // If array, map each item
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-syn-string">[]</span>;
    const isComplex = isValueComplex(val);

    if (isComplex) {
      return (
        <span className="text-syn-string">
          {"[\n"}
          {val.map((item, idx) => (
            <React.Fragment key={idx}>
              {nextIndent}
              <OptionValueLink
                val={item}
                optionKey={optionKey}
                parentOptionsMessage={parentOptionsMessage}
                typeIndex={typeIndex}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onPinClick={onPinClick}
                indent={indent + 1}
                parentMessageFqn={parentMessageFqn}
              />
              {idx < val.length - 1 ? ",\n" : "\n"}
            </React.Fragment>
          ))}
          {currentIndent + "]"}
        </span>
      );
    } else {
      return (
        <span className="text-syn-string">
          [
          {val.map((item, idx) => (
            <React.Fragment key={idx}>
              <OptionValueLink
                val={item}
                optionKey={optionKey}
                parentOptionsMessage={parentOptionsMessage}
                typeIndex={typeIndex}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onPinClick={onPinClick}
                indent={indent}
                parentMessageFqn={parentMessageFqn}
              />
              {idx < val.length - 1 && <span className="text-app-textMuted">, </span>}
            </React.Fragment>
          ))}
          ]
        </span>
      );
    }
  }

  // If object (e.g. submessages in options), format nested properties recursively
  if (typeof val === 'object' && val !== null) {
    const entries = Object.entries(val);
    if (entries.length === 0) return <span className="text-syn-string">{"{}"}</span>;
    const isComplex = isValueComplex(val);

    if (isComplex) {
      return (
        <span className="text-syn-string">
          {"{\n"}
          {entries.map(([k, v], idx) => {
            const fieldFqn = activeMessageFqn ? `${activeMessageFqn}.${k}` : '';
            const fieldInfo = fieldFqn ? typeIndex[fieldFqn] : undefined;
            const fieldDesc = { text: fieldInfo?.obj.description || 'No documentation provided.' };

            return (
              <React.Fragment key={k}>
                {nextIndent}
                {fieldInfo ? (
                  <span
                    className="text-syn-option border-b border-dotted border-syn-option/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
                    onMouseEnter={(e) => onMouseEnter(e, fieldFqn, fieldDesc, 'option', k)}
                    onMouseLeave={onMouseLeave}
                    onClick={(e) => onPinClick(e, fieldFqn, fieldDesc, 'option', k)}
                  >
                    {k}
                  </span>
                ) : (
                  <span className="text-app-textMain">{k}</span>
                )}
                <span className="text-app-textMuted">: </span>
                <OptionValueLink
                  val={v}
                  optionKey={`${optionKey}.${k}`} // nested key representation
                  parentOptionsMessage={parentOptionsMessage}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                  indent={indent + 1}
                  parentMessageFqn={fieldInfo?.obj.typeName}
                />
                {idx < entries.length - 1 ? ",\n" : "\n"}
              </React.Fragment>
            );
          })}
          {currentIndent + "}"}
        </span>
      );
    } else {
      return (
        <span className="text-syn-string">
          {"{ "}
          {entries.map(([k, v], idx) => {
            const fieldFqn = activeMessageFqn ? `${activeMessageFqn}.${k}` : '';
            const fieldInfo = fieldFqn ? typeIndex[fieldFqn] : undefined;
            const fieldDesc = { text: fieldInfo?.obj.description || 'No documentation provided.' };

            return (
              <React.Fragment key={k}>
                {fieldInfo ? (
                  <span
                    className="text-syn-option border-b border-dotted border-syn-option/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
                    onMouseEnter={(e) => onMouseEnter(e, fieldFqn, fieldDesc, 'option', k)}
                    onMouseLeave={onMouseLeave}
                    onClick={(e) => onPinClick(e, fieldFqn, fieldDesc, 'option', k)}
                  >
                    {k}
                  </span>
                ) : (
                  <span className="text-app-textMain">{k}</span>
                )}
                <span className="text-app-textMuted">: </span>
                <OptionValueLink
                  val={v}
                  optionKey={`${optionKey}.${k}`} // nested key representation
                  parentOptionsMessage={parentOptionsMessage}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                  indent={indent}
                  parentMessageFqn={fieldInfo?.obj.typeName}
                />
                {idx < entries.length - 1 && <span className="text-app-textMuted">, </span>}
              </React.Fragment>
            );
          })}
          {" }"}
        </span>
      );
    }
  }

  return renderSingleValue(val);
}
