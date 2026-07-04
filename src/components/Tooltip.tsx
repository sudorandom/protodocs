import { useLayoutEffect, useState, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ExternalLink from './ExternalLink';

const BUILTIN_PRIMITIVES = new Set([
  'double', 'float', 'int64', 'uint64', 'int32', 'fixed64', 'fixed32',
  'bool', 'string', 'bytes', 'uint32', 'sfixed32', 'sfixed64', 'sint32',
  'sint64', 'map'
]);

export interface TooltipState {
  x: number;
  y: number;
  fqn: string;
  description: any;
  category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value';
  shortName: string;
  isPinned: boolean;
  hasDefinition?: boolean;
  targetRect?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

interface TooltipProps {
  activeTooltip: TooltipState | null;
  onClose: () => void;
  onGoToDefinition: (fqn: string) => void;
  onFindReferences: (fqn: string) => void;
  onOpenDecoderDrawer?: (fqn: string) => void;
  typeIndex: Record<string, any>;
}

export default function Tooltip({
  activeTooltip,
  onClose,
  onGoToDefinition,
  onFindReferences,
  onOpenDecoderDrawer,
  typeIndex,
}: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isMessage = useMemo(() => {
    if (!activeTooltip || !typeIndex) return false;
    const typeInfo = typeIndex[activeTooltip.fqn];
    return typeInfo && typeInfo.kind === 'message';
  }, [activeTooltip, typeIndex]);

  const [copiedFqn, setCopiedFqn] = useState(false);

  const handleCopyFqn = (fqn: string) => {
    navigator.clipboard.writeText(fqn);
    setCopiedFqn(true);
    setTimeout(() => setCopiedFqn(false), 2000);
  };

  // Track coordinates state
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [prevTooltip, setPrevTooltip] = useState<TooltipState | null>(null);

  // Derive state from activeTooltip prop if it changes
  if (activeTooltip !== prevTooltip) {
    setPrevTooltip(activeTooltip);
    setCoords({
      top: activeTooltip?.y ?? 0,
      left: activeTooltip?.x ?? 0,
    });
  }

  useLayoutEffect(() => {
    if (!activeTooltip || !tooltipRef.current) return;

    const tooltipEl = tooltipRef.current;
    const height = tooltipEl.offsetHeight;
    const width = tooltipEl.offsetWidth || 512; // w-[32rem] is 512px

    let top = activeTooltip.y;
    let left = activeTooltip.x;

    if (activeTooltip.targetRect) {
      const rect = activeTooltip.targetRect;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      // If space below is not enough for the tooltip (height + padding), position above the element
      if (spaceBelow < height + 10) {
        top = rect.top - height - 6;
      } else {
        top = rect.bottom + 6;
      }

      // Constrain horizontal position (left) to the viewport
      left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    } else {
      // Fallback alignment if targetRect is not present
      const spaceBelow = window.innerHeight - activeTooltip.y;
      if (spaceBelow < height + 10) {
        // Approximate flip relative to the cursor/click y
        top = activeTooltip.y - height - 12;
      }
      left = Math.max(8, Math.min(activeTooltip.x, window.innerWidth - width - 8));
    }

    setCoords({ top, left });
  }, [activeTooltip]);

  if (!activeTooltip) return null;

  const descText = activeTooltip.description?.text || activeTooltip.description || 'No documentation provided.';
  const descUrl = activeTooltip.description?.url;

  return (
    <div
      ref={tooltipRef}
      className={`fixed z-50 bg-app-panel border border-app-border rounded-lg shadow-2xl p-4 max-w-[calc(100vw-16px)] w-[32rem] transition-all duration-150 ease-out ${
        activeTooltip.isPinned ? 'pointer-events-auto opacity-100 scale-100' : 'pointer-events-none opacity-95 scale-98'
      }`}
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between mb-2.5 pb-2 border-b border-app-border gap-2">
        <div className="min-w-0 flex-1">
          <div
            className={`font-mono text-sm font-semibold truncate max-w-[calc(100vw-96px)] md:max-w-[440px] ${
              activeTooltip.category === 'primitive' ? 'text-syn-primitive' : 'text-syn-type'
            }`}
            title={activeTooltip.fqn}
          >
            {activeTooltip.shortName}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-app-textMuted font-bold bg-app-base px-1.5 py-0.5 rounded border border-app-border inline-block mt-1">
            {['message', 'option', 'enum', 'optional', 'oneof', 'syntax', 'edition', 'package', 'import', 'extend', 'repeated', 'required', 'service', 'rpc', 'stream', 'returns'].includes(activeTooltip.fqn)
              ? 'Protobuf Keyword'
              : activeTooltip.category === 'primitive'
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

      <div className="text-xs text-app-textMain leading-relaxed break-words font-sans max-h-80 overflow-y-auto hide-scrollbar prose dark:prose-invert prose-tooltip max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
          {descText}
        </ReactMarkdown>
        {descUrl && (
          <ExternalLink
            href={descUrl}
            className="text-app-accent hover:underline block mt-2 text-[10px] uppercase font-bold tracking-wider"
          >
            View Docs ↗
          </ExternalLink>
        )}
      </div>

      {activeTooltip.isPinned && (activeTooltip.category !== 'primitive' || BUILTIN_PRIMITIVES.has(activeTooltip.fqn)) && (
        <div className="mt-3.5 pt-3 border-t border-app-border flex flex-col gap-1.5">
          {activeTooltip.hasDefinition && (
            <button
              onClick={() => onGoToDefinition(activeTooltip.fqn)}
              className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <span>Go to Definition</span>
            </button>
          )}
          <button
            onClick={() => onFindReferences(activeTooltip.fqn)}
            className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
            </svg>
            <span>Find References</span>
          </button>
          <button
            onClick={() => handleCopyFqn(activeTooltip.fqn)}
            className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6" />
              </svg>
              <span>Copy Full Name</span>
            </div>
            {copiedFqn && <span className="text-[10px] text-green-400 font-semibold select-none mr-1">Copied!</span>}
          </button>
          {isMessage && onOpenDecoderDrawer && (
            <button
              onClick={() => {
                onOpenDecoderDrawer(activeTooltip.fqn);
                onClose();
              }}
              className="text-left px-2.5 py-1.5 text-xs font-medium text-app-textBright hover:bg-app-accentBg hover:text-app-accent rounded transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              Decode/Encode
            </button>
          )}
        </div>
      )}
    </div>
  );
}
