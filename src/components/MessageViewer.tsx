import React, { useMemo } from 'react';
import TypeLink from './TypeLink';
import ExtensionGroupViewer from './ExtensionGroupViewer';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue } from '../lib/options-formatter-helpers';

interface MessageViewerProps {
  message: any;
  file: any;
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

export default function MessageViewer({
  message,
  file,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: MessageViewerProps) {
  const fqn = file.package ? `.${file.package}.${message.name}` : `.${message.name}`;

  // Group nested extensions by extendee
  const extensionGroups = useMemo(() => {
    if (!message.extension) return {};
    const groups: Record<string, any[]> = {};
    message.extension.forEach((ext: any) => {
      const key = ext.extendee;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ext);
    });
    return groups;
  }, [message.extension]);

  // Group oneof fields
  const renderableItems = useMemo(() => {
    interface RenderableField {
      type: 'field';
      field: any;
    }

    interface RenderableOneof {
      type: 'oneof';
      name: string;
      description?: string;
      fields: any[];
    }

    type RenderableItem = RenderableField | RenderableOneof;

    const items: RenderableItem[] = [];
    const oneofDecls = message.oneofDecl || [];

    const isOneofSynthetic = (idx: number) => {
      return message.field?.some((f: any) => f.oneofIndex === idx && f.proto3Optional);
    };

    if (message.field) {
      let i = 0;
      while (i < message.field.length) {
        const f = message.field[i];
        if (f.oneofIndex !== undefined && !isOneofSynthetic(f.oneofIndex)) {
          const oneofIdx = f.oneofIndex;
          const decl = oneofDecls[oneofIdx];
          const oneofName = decl?.name || `oneof_${oneofIdx}`;
          const oneofDescription = decl?.description;
          const oneofFields = [f];

          let j = i + 1;
          while (j < message.field.length && message.field[j].oneofIndex === oneofIdx) {
            oneofFields.push(message.field[j]);
            j++;
          }

          items.push({
            type: 'oneof',
            name: oneofName,
            description: oneofDescription,
            fields: oneofFields,
          });
          i = j;
        } else {
          items.push({
            type: 'field',
            field: f,
          });
          i++;
        }
      }
    }

    return items;
  }, [message.field, message.oneofDecl]);

  return (
    <div id={fqn} className="mb-8 font-mono text-sm rounded transition-colors group p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text">
      {message.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap">
          // {message.description}
        </div>
      )}
      <div>
        <span className="text-syn-keyword">message</span>{' '}
        <span
          className="text-syn-type font-bold border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text"
          onMouseEnter={(e) => onMouseEnter(e, fqn, { text: message.description || 'No documentation provided.' }, 'custom', message.name)}
          onMouseLeave={onMouseLeave}
          onClick={(e) => onPinClick(e, fqn, { text: message.description || 'No documentation provided.' }, 'custom', message.name)}
        >
          {message.name}
        </span>{' '}
        {'{'}
      </div>

      <div className="pl-8 my-1">
        {message.options &&
          Object.entries(message.options)
            .filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption')
            .map(([k, v]) => (
              <div key={k} className="text-app-textMuted px-2 py-0.5 rounded -ml-2">
                <span className="text-syn-keyword">option</span>{' '}
                <OptionLink
                  optionKey={k}
                  parentOptionsMessage="MessageOptions"
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                /> = {formatOptionValue(v, k, 'MessageOptions', typeIndex)};
              </div>
            ))}

        {renderableItems.map((item, idx) => {
          if (item.type === 'oneof') {
            return (
              <div key={`oneof-${idx}`} className="mb-4 mt-2">
                {item.description && (
                  <div className="text-syn-comment mb-1 whitespace-pre-wrap">// {item.description}</div>
                )}
                <div className="text-app-textMain">
                  <span className="text-syn-keyword">oneof</span>{' '}
                  <span className="text-app-textBright font-semibold">{item.name}</span> {'{'}
                </div>
                <div className="pl-6 border-l border-l-app-border/40 ml-2 my-1">
                  {item.fields.map((f: any) => {
                    const fieldFqn = `${fqn}.${f.name}`;
                    return (
                      <div key={f.name} id={fieldFqn} className="mb-2 last:mb-0">
                        {f.description && (
                          <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text">
                            {f.description.split('\n').map((line: string) => `// ${line}`).join('\n')}
                          </div>
                        )}
                        <div className="hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
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
                <div className="text-app-textMain">{'}'}</div>
              </div>
            );
          } else {
            const f = item.field;
            const isProto3 = file.syntax === 'proto3';
            const fieldFqn = `${fqn}.${f.name}`;
            return (
              <div key={f.name} id={fieldFqn} className="mb-2 last:mb-0">
                {f.description && (
                  <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text">
                    {f.description.split('\n').map((line: string) => `// ${line}`).join('\n')}
                  </div>
                )}
                <div className="hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
                  {f.label === 3 && <span className="text-syn-keyword">repeated </span>}
                  {((!isProto3 && f.label === 1) || f.proto3Optional) && (
                    <span className="text-syn-keyword">optional </span>
                  )}
                  {!isProto3 && f.label === 2 && (
                    <span className="text-syn-keyword">required </span>
                  )}
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
          }
        })}

        {Object.entries(extensionGroups).map(([extendee, fields]) => (
          <div key={extendee} className="mt-4 -ml-2">
            <ExtensionGroupViewer
              extendee={extendee}
              fields={fields}
              parentFqn={fqn}
              typeIndex={typeIndex}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
              onPinClick={onPinClick}
            />
          </div>
        ))}
      </div>
      <div>{'}'}</div>
    </div>
  );
}
