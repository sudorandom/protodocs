import { MouseEvent } from 'react';
import TypeLink from './TypeLink';
import { FormatOptions } from './options-formatter';
import KeywordLink from './KeywordLink';
import { cleanComment } from '../lib/proto-reconstructor';

interface ExtensionGroupViewerProps {
  extendee: string;
  fields: any[];
  parentFqn?: string;
  typeIndex: Record<string, any>;
  onMouseEnter: (
    e: MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  onMouseLeave: () => void;
  onPinClick: (
    e: MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
}

export default function ExtensionGroupViewer({
  extendee,
  fields,
  parentFqn,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: ExtensionGroupViewerProps) {
  // Strip leading dot from extendee for display
  const displayExtendee = extendee.startsWith('.') ? extendee.substring(1) : extendee;

  return (
    <div className="mb-8 font-mono text-sm rounded transition-colors p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text">
      <div>
        <KeywordLink keyword="extend" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
        <span className="text-syn-type font-bold">{displayExtendee}</span> {'{'}
      </div>
      
      <div className="pl-8 my-1">
        {fields.map((f: any) => {
          const extensionFqn = parentFqn ? `${parentFqn}.${f.name}` : `.${f.name}`;
          return (
            <div key={f.name} id={extensionFqn} className="mb-2 last:mb-0">
              {f.description && (
                <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text">
                  {cleanComment(f.description).split('\n').map((line: string) => `// ${line}`).join('\n')}
                </div>
              )}
              <div className="hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
                {f.label === 3 && <><KeywordLink keyword="repeated" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>repeated</KeywordLink>{' '}</>}
                {f.label === 1 && <><KeywordLink keyword="optional" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>optional</KeywordLink>{' '}</>}
                <TypeLink
                  typeName={f.typeName}
                  typeId={f.type}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />
                {' '}
                <span className="text-app-textMain">{f.name}</span>
                {' '}
                <span className="text-app-textMuted">=</span>
                {' '}
                <span className="text-syn-number">{f.number}</span>
                <FormatOptions
                  options={f.options}
                  parentOptionsMessage="FieldOptions"
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
