import React from 'react';
import OptionLink from './OptionLink';
import OptionValueLink from './OptionValueLink';
import { formatOptionKey } from '../lib/options-formatter-helpers';

interface FormatOptionsProps {
  options: any;
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
}

export function FormatOptions({
  options,
  parentOptionsMessage,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
  indent = 0,
}: FormatOptionsProps) {
  if (!options || Object.keys(options).length === 0) return null;

  const entries = Object.entries(options).filter(
    ([k]) => !k.startsWith('$') && k !== 'uninterpretedOption'
  );
  if (entries.length === 0) return null;

  const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
  const standardEntries = entries.filter(([k]) => !isCustom(k));
  const customEntries = entries.filter(([k]) => isCustom(k));
  standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
  customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));
  const sortedEntries = [...standardEntries, ...customEntries];

  // Multi-line formatting if there are multiple options
  if (sortedEntries.length > 1) {
    const parentIndent = '  '.repeat(indent);
    const optionIndent = '  '.repeat(indent + 1);
    return (
      <span className="text-syn-comment ml-2 select-text font-mono whitespace-pre-wrap">
        {`[\n`}
        {sortedEntries.map(([k, v], idx) => (
          <span key={k}>
            {optionIndent}
            <OptionLink
              optionKey={k}
              parentOptionsMessage={parentOptionsMessage}
              typeIndex={typeIndex}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onPinClick={onPinClick}
            />
            <span className="text-app-textMuted"> = </span>
            <OptionValueLink
              val={v}
              optionKey={k}
              parentOptionsMessage={parentOptionsMessage}
              typeIndex={typeIndex}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onPinClick={onPinClick}
              indent={indent + 1}
            />
            {idx < sortedEntries.length - 1 ? `,\n` : `\n`}
          </span>
        ))}
        {parentIndent}]
      </span>
    );
  }

  // Single-line formatting if there is only one option (adds whitespace-pre-wrap to support nested wrapping)
  return (
    <span className="text-syn-comment ml-2 select-text font-mono whitespace-pre-wrap">
      [
      {sortedEntries.map(([k, v]) => (
        <React.Fragment key={k}>
          <OptionLink
            optionKey={k}
            parentOptionsMessage={parentOptionsMessage}
            typeIndex={typeIndex}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onPinClick={onPinClick}
          />
          <span className="text-app-textMuted"> = </span>
          <OptionValueLink
            val={v}
            optionKey={k}
            parentOptionsMessage={parentOptionsMessage}
            typeIndex={typeIndex}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onPinClick={onPinClick}
            indent={indent}
          />
        </React.Fragment>
      ))}
      ]
    </span>
  );
}
