import React, { useMemo } from 'react';
import TypeLink from './TypeLink';
import ExtensionGroupViewer from './ExtensionGroupViewer';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue, formatOptionKey } from '../lib/options-formatter-helpers';
import EnumViewer from './EnumViewer';
import KeywordLink from './KeywordLink';
import { cleanComment } from '../lib/proto-reconstructor';
import PayloadDecoder from './PayloadDecoder';

interface MessageViewerProps {
  message: any;
  file: any;
  typeIndex: Record<string, any>;
  /** FQN of the parent message (for nested types). Omit for top-level messages. */
  parentFqn?: string;
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
  /** When true, renders with reduced bottom margin (for nesting inside a parent message). */
  nested?: boolean;
  indent?: number;
  onOpenDecoderModal?: (fqn: string | null) => void;
  registry?: any;
  allowedProtocols?: string[];
  expandedDecoderFqn?: string | null;
}

export default function MessageViewer({
  message,
  file,
  typeIndex,
  parentFqn,
  nested,
  indent = 0,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
  onOpenDecoderModal,
  registry,
  allowedProtocols,
  expandedDecoderFqn,
}: MessageViewerProps) {
  const fqn = parentFqn
    ? `${parentFqn}.${message.name}`
    : file.package
    ? `.${file.package}.${message.name}`
    : `.${message.name}`;

  const mapEntries = useMemo(() => {
    const entries: Record<string, { keyField: any; valField: any }> = {};
    message.nestedType?.forEach((nm: any) => {
      if (nm.options?.mapEntry || nm.options?.map_entry) {
        const keyField = nm.field?.find((f: any) => f.number === 1);
        const valField = nm.field?.find((f: any) => f.number === 2);
        if (keyField && valField) {
          entries[nm.name] = { keyField, valField };
        }
      }
    });
    return entries;
  }, [message.nestedType]);

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
    <div
      id={fqn}
      data-indent={indent}
      className={`proto-block relative ${nested ? 'mb-2' : 'mb-8'} font-mono text-sm rounded transition-colors group p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text`}
    >
      {message.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap font-mono">
          {cleanComment(message.description).split('\n').map((line: string) => `${'  '.repeat(indent)}// ${line}`).join('\n')}
        </div>
      )}
      <div className="font-mono whitespace-pre-wrap text-app-textMain">
        {'  '.repeat(indent)}
        <KeywordLink keyword="message" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
        <span
          data-indent={indent}
          className="proto-heading text-syn-type font-bold border-b border-dotted border-syn-type/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text"
          onMouseEnter={(e) => onMouseEnter(e, fqn, { text: cleanComment(message.description || 'No documentation provided.') }, 'custom', message.name)}
          onMouseLeave={onMouseLeave}
          onClick={(e) => onPinClick(e, fqn, { text: cleanComment(message.description || 'No documentation provided.') }, 'custom', message.name)}
        >
          {message.name}
        </span>
        {' '}
        {'{'}
      </div>

      {expandedDecoderFqn === fqn && (
        <div id={`${fqn}-decoder-panel`} className="mt-3 mb-5 select-text">
          <PayloadDecoder
            typeIndex={typeIndex}
            registry={registry}
            preselectedFqn={fqn}
            onClose={() => onOpenDecoderModal?.(null)}
            allowedProtocols={allowedProtocols}
          />
        </div>
      )}



      <div className="my-1">
        {message.options && (() => {
          const optionEntries = Object.entries(message.options).filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption' && k !== 'mapEntry' && k !== 'map_entry');
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
                parentOptionsMessage="MessageOptions"
                typeIndex={typeIndex}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onPinClick={onPinClick}
              /> = {formatOptionValue(v, k, 'MessageOptions', typeIndex)};
            </div>
          ));
        })()}

        {renderableItems.map((item, idx) => {
          if (item.type === 'oneof') {
            return (
              <div key={`oneof-${idx}`} className="mb-4 mt-2">
                {item.description && (
                  <div className="text-syn-comment mb-1 whitespace-pre-wrap font-mono">
                    {cleanComment(item.description).split('\n').map((line: string) => `${'  '.repeat(indent + 1)}// ${line}`).join('\n')}
                  </div>
                )}
                <div data-indent={indent + 1} className="proto-text font-mono whitespace-pre-wrap text-app-textMain">
                  {'  '.repeat(indent + 1)}
                  <KeywordLink keyword="oneof" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick} />{' '}
                  <span className="text-app-textBright font-semibold">{item.name}</span> {'{'}
                </div>
                <div className="border-l border-l-app-border/40 ml-4 my-1">
                  {item.fields.map((f: any) => {
                    const fieldFqn = `${fqn}.${f.name}`;
                    return (
                      <div key={f.name} id={fieldFqn} className="mb-2 last:mb-0">
                        {f.description && (
                          <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text font-mono">
                            {cleanComment(f.description).split('\n').map((line: string) => `${'  '.repeat(indent + 2)}// ${line}`).join('\n')}
                          </div>
                        )}
                        <div data-indent={indent + 2} className="proto-text hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap text-app-textMuted">
                          {'  '.repeat(indent + 2)}
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
                            indent={indent + 2}
                          />
                          <span className="text-app-textMain">;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="font-mono whitespace-pre-wrap text-app-textMain">
                  {'  '.repeat(indent + 1)}
                  {'}'}
                </div>
              </div>
            );
          } else {
            const f = item.field;
            const isProto3 = file.syntax === 'proto3';
            const fieldFqn = `${fqn}.${f.name}`;
            const lastPart = f.typeName ? f.typeName.split('.').pop() : '';
            const isMap = (f.type === 11 || f.type === 'TYPE_MESSAGE') && lastPart && mapEntries[lastPart];

            return (
              <div key={f.name} id={fieldFqn} className="mb-2 last:mb-0">
                {f.description && (
                  <div className="text-syn-comment whitespace-pre-wrap mb-0.5 select-text font-mono">
                    {cleanComment(f.description).split('\n').map((line: string) => `${'  '.repeat(indent + 1)}// ${line}`).join('\n')}
                  </div>
                )}
                <div data-indent={indent + 1} className="proto-text hover:bg-app-hoverBg px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap text-app-textMuted">
                  {'  '.repeat(indent + 1)}
                  {isMap ? (
                    <>
                      <KeywordLink keyword="map" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>map</KeywordLink>
                      {'<'}
                      <TypeLink
                        typeName={mapEntries[lastPart].keyField.typeName}
                        typeId={mapEntries[lastPart].keyField.type}
                        typeIndex={typeIndex}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onPinClick={onPinClick}
                      />
                      {', '}
                      <TypeLink
                        typeName={mapEntries[lastPart].valField.typeName}
                        typeId={mapEntries[lastPart].valField.type}
                        typeIndex={typeIndex}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onPinClick={onPinClick}
                      />
                      {'>'}
                    </>
                  ) : (
                    <>
                      {f.label === 3 && <><KeywordLink keyword="repeated" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>repeated</KeywordLink>{' '}</>}
                      {((!isProto3 && f.label === 1) || f.proto3Optional) && (
                        <><KeywordLink keyword="optional" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>optional</KeywordLink>{' '}</>
                      )}
                      {!isProto3 && f.label === 2 && (
                        <><KeywordLink keyword="required" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onPinClick={onPinClick}>required</KeywordLink>{' '}</>
                      )}
                      <TypeLink
                        typeName={f.typeName}
                        typeId={f.type}
                        typeIndex={typeIndex}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onPinClick={onPinClick}
                      />
                    </>
                  )}
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
                    indent={indent + 1}
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

      {/* Nested enums */}
      {message.enumType?.map((enm: any) => (
        <div key={enm.name} className="-ml-3">
          <EnumViewer
            enumObj={enm}
            file={file}
            typeIndex={typeIndex}
            parentFqn={fqn}
            nested
            indent={indent + 1}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onPinClick={onPinClick}
          />
        </div>
      ))}

      {/* Nested messages (skip synthetic map-entry messages) */}
      {message.nestedType?.filter((nested: any) => !(nested.options?.mapEntry || nested.options?.map_entry)).map((nested: any) => (
        <div key={nested.name} className="-ml-3">
          <MessageViewer
            message={nested}
            file={file}
            typeIndex={typeIndex}
            parentFqn={fqn}
            nested
            indent={indent + 1}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onPinClick={onPinClick}
            onOpenDecoderModal={onOpenDecoderModal}
            registry={registry}
            allowedProtocols={allowedProtocols}
            expandedDecoderFqn={expandedDecoderFqn}
          />
        </div>
      ))}

      <div className="font-mono whitespace-pre-wrap text-app-textMain">
        {'  '.repeat(indent)}
        {'}'}
      </div>
    </div>
  );
}
