import React from 'react';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue, formatOptionKey } from '../lib/options-formatter-helpers';
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
  indent?: number;
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
  indent = 0,
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
    <div id={fqn} data-indent={indent} className={`proto-block ${nested ? 'mb-2' : 'mb-8'} font-mono text-sm rounded transition-colors p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text`}>
      {enumObj.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap font-mono">
          {cleanComment(enumObj.description).split('\n').map((line: string) => `${'  '.repeat(indent)}// ${line}`).join('\n')}
        </div>
      )}
      <div className="font-mono whitespace-pre-wrap text-app-textMain">
        {'  '.repeat(indent)}
        <KeywordLink keyword="enum" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
        <span
          data-indent={indent}
          className="proto-heading text-syn-type font-bold border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text"
          onMouseEnter={(e) => onMouseEnter(e, fqn, { text: cleanComment(enumObj.description || 'No documentation provided.') }, 'custom', enumObj.name)}
          onMouseLeave={onMouseLeave}
          onClick={(e) => onPinClick(e, fqn, { text: cleanComment(enumObj.description || 'No documentation provided.') }, 'custom', enumObj.name)}
        >
          {enumObj.name}
        </span>{' '}
        {'{'}
      </div>
      
      <div className="my-1">
        {enumObj.options && (() => {
          const optionEntries = Object.entries(enumObj.options).filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption');
          const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
          const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
          const customEntries = optionEntries.filter(([k]) => isCustom(k));
          standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
          customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

          const sortedEntries = [...standardEntries, ...customEntries];
          return sortedEntries.map(([k, v]) => (
            <div key={k} data-indent={indent + 1} className="proto-text text-app-textMuted px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
              {'  '.repeat(indent + 1)}
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
          ));
        })()}
        {enumObj.value?.map((v: any) => {
          const valueFqn = `${fqn}.${v.name}`;
          return (
            <div key={v.name} id={valueFqn} className="mb-2 last:mb-0">
              {v.description && (
                <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text font-mono">
                  {cleanComment(v.description).split('\n').map((line: string) => `${'  '.repeat(indent + 1)}// ${line}`).join('\n')}
                </div>
              )}
              <div data-indent={indent + 1} className="proto-text hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap text-app-textMuted">
                {'  '.repeat(indent + 1)}
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
      
      <div className="font-mono whitespace-pre-wrap text-app-textMain">
        {'  '.repeat(indent)}
        {'}'}
      </div>
    </div>
  );
}
