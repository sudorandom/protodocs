import React from 'react';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue } from '../lib/options-formatter-helpers';
import KeywordLink from './KeywordLink';
import { cleanComment } from '../lib/proto-reconstructor';

interface EnumViewerProps {
  enumObj: any;
  file: any;
  typeIndex: Record<string, any>;
  /** FQN of the parent message (for nested enums). Omit for top-level enums. */
  parentFqn?: string;
  /** When true, renders with reduced bottom margin (for nesting inside a parent message). */
  nested?: boolean;
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

export default function EnumViewer({
  enumObj,
  file,
  typeIndex,
  parentFqn,
  nested,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: EnumViewerProps) {
  const fqn = parentFqn
    ? `${parentFqn}.${enumObj.name}`
    : file.package
    ? `.${file.package}.${enumObj.name}`
    : `.${enumObj.name}`;

  return (
    <div id={fqn} className={`${nested ? 'mb-2' : 'mb-8'} font-mono text-sm rounded transition-colors p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text`}>
      {enumObj.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap">
          {cleanComment(enumObj.description).split('\n').map((line: string) => `// ${line}`).join('\n')}
        </div>
      )}
      <div>
        <KeywordLink keyword="enum" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
        <span className="text-syn-type font-bold">{enumObj.name}</span> {'{'}
      </div>
      
      <div className="pl-8 my-1">
        {enumObj.options &&
          Object.entries(enumObj.options)
            .filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption')
            .map(([k, v]) => (
              <div key={k} className="text-app-textMuted px-2 py-0.5 rounded -ml-2">
                <KeywordLink keyword="option" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
                <OptionLink
                  optionKey={k}
                  parentOptionsMessage="EnumOptions"
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                /> = {formatOptionValue(v, k, 'EnumOptions', typeIndex)};
              </div>
            ))}
        {enumObj.value?.map((v: any) => {
          const valueFqn = `${fqn}.${v.name}`;
          return (
            <div key={v.name} id={valueFqn} className="mb-2 last:mb-0">
              {v.description && (
                <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text">
                  {cleanComment(v.description).split('\n').map((line: string) => `// ${line}`).join('\n')}
                </div>
              )}
              <div className="hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
                <span className="text-app-textMain">{v.name}</span>
                {' '}
                <span className="text-app-textMuted">=</span>
                {' '}
                <span className="text-syn-number">{v.number}</span>
                <FormatOptions
                  options={v.options}
                  parentOptionsMessage="EnumValueOptions"
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />
                <span className="text-app-textMain">;</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div>{'}'}</div>
    </div>
  );
}
