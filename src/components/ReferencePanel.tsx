export interface ReferenceResult {
  path: string;
  contextFqn: string;
  text: string;
}

export interface ReferencePanelState {
  token: string;
  results: ReferenceResult[];
}

interface ReferencePanelProps {
  state: ReferencePanelState | null;
  onClose: () => void;
  onReferenceClick: (file: string, elementId: string) => void;
}

export default function ReferencePanel({ state, onClose, onReferenceClick }: ReferencePanelProps) {
  if (!state) return null;

  return (
    <div className="absolute top-0 right-0 h-full w-96 bg-app-panel border-l border-app-border shadow-2xl flex flex-col z-20 transition-all duration-300">
      
      {/* Header */}
      <div className="h-14 border-b border-app-border flex items-center justify-between px-5 bg-app-panel/90 backdrop-blur shrink-0">
        <div className="font-semibold text-app-textBright text-sm">Symbol References</div>
        <button
          onClick={onClose}
          className="text-app-textMuted hover:text-app-textBright p-1.5 rounded hover:bg-app-hoverBg transition-colors"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Info Block */}
      <div className="p-4 bg-app-base border-b border-app-border shrink-0">
        <div className="text-[10px] text-app-textMuted uppercase tracking-wider font-bold mb-1">Symbol</div>
        <div className="text-syn-type code-font text-xs truncate font-bold" title={state.token}>
          {state.token.replace(/^\./, '')}
        </div>
        <div className="text-[10px] text-app-textMuted mt-1.5 font-medium">
          {state.results.length} reference{state.results.length === 1 ? '' : 's'} found
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {state.results.length === 0 ? (
          <div className="text-xs text-app-textMuted text-center py-8">No references found for this symbol.</div>
        ) : (
          state.results.map((res, i) => (
            <div
              key={i}
              onClick={() => onReferenceClick(res.path, res.contextFqn)}
              className="p-3 rounded border border-app-border bg-app-panel hover:border-app-accent cursor-pointer transition-all duration-200"
            >
              <div className="text-[10px] text-app-textMuted font-mono truncate mb-1" title={res.path}>
                {res.path}
              </div>
              <div className="code-font text-xs text-app-textBright font-semibold truncate mb-2">
                {res.contextFqn.replace(/^\./, '')}
              </div>
              <div className="code-font text-[11px] text-app-textMain truncate p-2 bg-app-code rounded border border-app-border/40 leading-normal">
                {res.text}
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
