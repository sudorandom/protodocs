export interface TooltipState {
  x: number;
  y: number;
  fqn: string;
  description: any;
  category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value';
  shortName: string;
  isPinned: boolean;
}

interface TooltipProps {
  activeTooltip: TooltipState | null;
  onClose: () => void;
  onGoToDefinition: (fqn: string) => void;
  onFindReferences: (fqn: string) => void;
}

export default function Tooltip({
  activeTooltip,
  onClose,
  onGoToDefinition,
  onFindReferences,
}: TooltipProps) {
  if (!activeTooltip) return null;

  const descText = activeTooltip.description?.text || activeTooltip.description || 'No documentation provided.';
  const descUrl = activeTooltip.description?.url;

  return (
    <div
      className={`fixed z-50 bg-app-panel border border-app-border rounded-lg shadow-2xl p-4 w-72 transition-all duration-150 ease-out ${
        activeTooltip.isPinned ? 'pointer-events-auto opacity-100 scale-100' : 'pointer-events-none opacity-95 scale-98'
      }`}
      style={{ top: activeTooltip.y, left: activeTooltip.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2.5 pb-2 border-b border-app-border">
        <div>
          <div
            className={`font-mono text-sm font-semibold truncate max-w-[200px] ${
              activeTooltip.category === 'primitive' ? 'text-syn-primitive' : 'text-syn-type'
            }`}
            title={activeTooltip.fqn}
          >
            {activeTooltip.shortName}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-app-textMuted font-bold bg-app-base px-1.5 py-0.5 rounded border border-app-border inline-block mt-1">
            {activeTooltip.category === 'primitive'
              ? 'Primitive Type'
              : activeTooltip.category === 'wkt'
              ? 'Well-Known Type'
              : activeTooltip.category === 'option'
              ? 'Option Field'
              : activeTooltip.category === 'enum_value'
              ? 'Enum Value'
              : 'Custom Type'}
          </div>
        </div>
        {activeTooltip.isPinned && (
          <button
            onClick={onClose}
            className="text-app-textMuted hover:text-app-textBright rounded p-1 transition-colors hover:bg-app-hoverBg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="text-xs text-app-textMain leading-relaxed break-words font-sans max-h-32 overflow-y-auto hide-scrollbar">
        {descText}
        {descUrl && (
          <a
            href={descUrl}
            target="_blank"
            rel="noreferrer"
            className="text-app-accent hover:underline block mt-2 text-[10px] uppercase font-bold tracking-wider"
            onClick={(e) => e.stopPropagation()}
          >
            View Docs ↗
          </a>
        )}
      </div>

      {activeTooltip.isPinned && activeTooltip.category !== 'primitive' && (
        <div className="mt-3.5 pt-3 border-t border-app-border flex flex-col gap-1.5">
          <button
            onClick={() => onGoToDefinition(activeTooltip.fqn)}
            className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors"
          >
            Go to Definition
          </button>
          <button
            onClick={() => onFindReferences(activeTooltip.fqn)}
            className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors"
          >
            Find References
          </button>
        </div>
      )}
    </div>
  );
}
