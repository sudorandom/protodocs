import React from 'react';
import { getOptionFqn } from '../lib/option-resolver';
import { formatOptionKey, STANDARD_OPTION_DESCRIPTIONS } from '../lib/options-formatter-helpers';

interface OptionLinkProps {
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
}

export default function OptionLink({
  optionKey,
  parentOptionsMessage,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
}: OptionLinkProps) {
  const fqn = getOptionFqn(parentOptionsMessage, optionKey);
  const ref = typeIndex[fqn];
  const shortName = formatOptionKey(optionKey);

  const fallbackKey = `${parentOptionsMessage}.${optionKey}`;
  const fallbackDescText = STANDARD_OPTION_DESCRIPTIONS[fallbackKey];

  if (!ref && !fallbackDescText) {
    return <span className="text-syn-option select-text font-mono">{shortName}</span>;
  }

  const desc = { text: ref ? (ref.obj.description || 'No documentation provided.') : fallbackDescText };

  return (
    <span
      className="text-syn-option border-b border-dotted border-syn-option/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 font-mono select-text"
      onMouseEnter={(e) => onMouseEnter(e, fqn, desc, 'option', shortName)}
      onMouseLeave={onMouseLeave}
      onClick={(e) => onPinClick(e, fqn, desc, 'option', shortName)}
    >
      {shortName}
    </span>
  );
}
