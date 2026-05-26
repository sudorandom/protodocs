import React from 'react';
import OptionLink from './OptionLink';
import OptionValueLink from './OptionValueLink';

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
}

export function FormatOptions({
  options,
  parentOptionsMessage,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: FormatOptionsProps) {
  if (!options || Object.keys(options).length === 0) return null;

  const entries = Object.entries(options).filter(
    ([k]) => !k.startsWith('$') && k !== 'uninterpretedOption'
  );
  if (entries.length === 0) return null;

  // Multi-line formatting if there are multiple options
  if (entries.length > 1) {
    return (
      <span className="text-syn-comment ml-2 select-text font-mono whitespace-pre-wrap">
        {`[\n`}
        {entries.map(([k, v], idx) => (
          <span key={k}>
            {'  '}
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
              indent={1}
            />
            {idx < entries.length - 1 ? `,\n` : `\n`}
          </span>
        ))}
        ]
      </span>
    );
  }

  // Single-line formatting if there is only one option (adds whitespace-pre-wrap to support nested wrapping)
  return (
    <span className="text-syn-comment ml-2 select-text font-mono whitespace-pre-wrap">
      [
      {entries.map(([k, v]) => (
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
            indent={0}
          />
        </React.Fragment>
      ))}
      ]
    </span>
  );
}

