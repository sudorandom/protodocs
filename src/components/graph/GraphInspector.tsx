import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ExternalLink from '../ExternalLink';
import type { RawGraphNode, RawGraphEdge } from '../../lib/schema-graph';

interface GraphInspectorProps {
  selectedNode: RawGraphNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (id: string) => void;
  onGoToSource: (file: string, symbol: string) => void;
  inboundEdges: RawGraphEdge[];
  outboundEdges: RawGraphEdge[];
  nodesById: Map<string, RawGraphNode>;
  totalNodes: number;
  totalEdges: number;
  scopeLabel: string;
  isFocused: boolean;
  onToggleFocus: (nodeId: string | null) => void;
}

export default function GraphInspector({
  selectedNode,
  isOpen,
  onClose,
  onSelectNode,
  onGoToSource,
  inboundEdges,
  outboundEdges,
  nodesById,
  totalNodes,
  totalEdges,
  scopeLabel,
  isFocused,
  onToggleFocus,
}: GraphInspectorProps) {
  if (!isOpen) {
    return null;
  }

  const getKindBadgeClass = (kind?: string) => {
    switch (kind) {
      case 'service':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'message':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'enum':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <aside
      className="w-80 md:w-96 border-l border-app-border bg-app-panel flex flex-col h-full shrink-0 shadow-2xl z-20 font-sans select-text overflow-hidden"
      aria-label="Schema Inspector"
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-app-border flex items-center justify-between shrink-0 bg-app-base/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-app-textMuted">
            Inspector
          </span>
          {selectedNode && (
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getKindBadgeClass(
                selectedNode.kind
              )}`}
            >
              {selectedNode.kind}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg transition-colors"
          title="Close Inspector"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {selectedNode ? (
          <>
            {/* Title & Metadata */}
            <div>
              <h2 className="text-lg font-bold text-app-textBright break-all font-mono leading-tight">
                {selectedNode.name}
              </h2>
              <div className="text-xs text-app-textMuted font-mono mt-1 break-all select-all">
                {selectedNode.fullName}
              </div>
              <div className="text-[11px] text-app-textMuted/70 font-mono mt-0.5 truncate">
                File: {selectedNode.file}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3.5">
                <button
                  type="button"
                  onClick={() => onGoToSource(selectedNode.file, selectedNode.fullName)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-app-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                  title="Open source definition in Document View"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>View in Proto</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleFocus(isFocused ? null : selectedNode.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isFocused
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-app-base border-app-border text-app-textBright hover:bg-app-hoverBg'
                  }`}
                  title={isFocused ? 'Exit focused neighborhood' : 'Isolate this node and immediate neighbors'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <span>{isFocused ? 'Unfocus' : 'Focus'}</span>
                </button>
              </div>
            </div>

            {/* Description / Comments */}
            {selectedNode.description && (
              <div className="rounded-lg bg-app-base/70 border border-app-border/40 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-app-textMuted mb-1.5">
                  Description
                </div>
                <div className="prose dark:prose-invert prose-sm max-w-none text-app-textMain text-xs leading-relaxed break-words font-sans [&_code]:text-app-textBright [&_code]:bg-app-panel [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_a]:text-app-accent [&_a]:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
                    {selectedNode.description}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Service Methods */}
            {selectedNode.kind === 'service' && selectedNode.methods && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-app-textMuted">
                    RPC Methods ({selectedNode.methods.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedNode.methods.map((method) => (
                    <div
                      key={method.name}
                      className="rounded-lg bg-app-base/60 border border-app-border/40 p-2.5 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-1 font-semibold text-app-textBright">
                        <span>{method.name}</span>
                        {(method.clientStreaming || method.serverStreaming) && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
                            stream
                          </span>
                        )}
                      </div>
                      {method.description && (
                        <div className="prose dark:prose-invert prose-xs max-w-none text-app-textMuted text-[11px] leading-relaxed break-words font-sans [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-app-textBright [&_code]:bg-app-base [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_a]:text-app-accent [&_a]:underline">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
                            {method.description}
                          </ReactMarkdown>
                        </div>
                      )}
                      <div className="space-y-1 font-mono text-[11px] pt-1 border-t border-app-border/30">
                        <div className="flex items-center gap-1.5 text-app-textMuted truncate">
                          <span className="text-purple-400 font-bold shrink-0">Input:</span>
                          <button
                            type="button"
                            onClick={() => onSelectNode(method.inputType)}
                            className="text-purple-300 hover:underline truncate cursor-pointer"
                            title={method.inputType}
                          >
                            {method.inputTypeName}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-app-textMuted truncate">
                          <span className="text-emerald-400 font-bold shrink-0">Output:</span>
                          <button
                            type="button"
                            onClick={() => onSelectNode(method.outputType)}
                            className="text-emerald-300 hover:underline truncate cursor-pointer"
                            title={method.outputType}
                          >
                            {method.outputTypeName}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Fields */}
            {selectedNode.kind === 'message' && selectedNode.fields && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-app-textMuted">
                    Fields ({selectedNode.fields.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedNode.fields.map((field) => (
                    <div
                      key={field.name}
                      className="rounded-lg bg-app-base/60 border border-app-border/40 p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-app-textMuted/60">#{field.number}</span>
                          <span className="font-semibold text-app-textBright truncate" title={field.name}>
                            {field.name}
                          </span>
                        </div>
                        {field.typeName && (field.isMessage || field.isEnum) ? (
                          <button
                            type="button"
                            onClick={() => onSelectNode(field.typeName!)}
                            className="text-emerald-400 hover:text-emerald-300 hover:underline truncate cursor-pointer font-semibold"
                            title={field.typeName}
                          >
                            {field.typeDisplay}
                          </button>
                        ) : (
                          <span className="text-app-textMuted truncate" title={field.typeDisplay}>
                            {field.typeDisplay}
                          </span>
                        )}
                      </div>
                      {field.description && (
                        <div className="prose dark:prose-invert prose-xs max-w-none text-app-textMuted text-[11px] leading-relaxed break-words font-sans [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-app-textBright [&_code]:bg-app-base [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_a]:text-app-accent [&_a]:underline">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
                            {field.description}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enum Values */}
            {selectedNode.kind === 'enum' && selectedNode.values && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-app-textMuted">
                    Enum Values ({selectedNode.values.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {selectedNode.values.map((v) => (
                    <div
                      key={v.name}
                      className="rounded-lg bg-app-base/60 border border-app-border/40 p-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-app-textBright truncate" title={v.name}>
                          {v.name}
                        </span>
                        <span className="text-amber-400 text-[11px] font-mono shrink-0">
                          = {v.number}
                        </span>
                      </div>
                      {v.description && (
                        <div className="prose dark:prose-invert prose-xs max-w-none text-app-textMuted text-[11px] leading-relaxed break-words font-sans [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:text-app-textBright [&_code]:bg-app-base [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[10px] [&_a]:text-app-accent [&_a]:underline">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
                            {v.description}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships: Inbound & Outbound */}
            <div className="space-y-3 pt-2 border-t border-app-border/40">
              <div className="text-xs font-bold uppercase tracking-wider text-app-textMuted">
                Relationships
              </div>

              {/* Inbound (Used by) */}
              <div>
                <div className="text-[11px] text-app-textMuted mb-1 font-semibold flex items-center gap-1">
                  <span>Used By (Inbound)</span>
                  <span className="text-app-textMuted/60">({inboundEdges.length})</span>
                </div>
                {inboundEdges.length === 0 ? (
                  <div className="text-[11px] text-app-textMuted/70 italic px-1">
                    No inbound references
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {inboundEdges.map((e) => {
                      const srcNode = nodesById.get(e.source);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onSelectNode(e.source)}
                          className="w-full text-left flex items-center justify-between px-2 py-1 rounded bg-app-base/40 hover:bg-app-hoverBg border border-app-border/30 text-xs font-mono transition-colors cursor-pointer"
                        >
                          <span className="text-app-textBright truncate font-semibold">
                            {srcNode?.name || e.source}
                          </span>
                          <span className="text-[10px] text-app-textMuted shrink-0 ml-2">
                            {e.label || e.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Outbound (References) */}
              <div>
                <div className="text-[11px] text-app-textMuted mb-1 font-semibold flex items-center gap-1">
                  <span>References (Outbound)</span>
                  <span className="text-app-textMuted/60">({outboundEdges.length})</span>
                </div>
                {outboundEdges.length === 0 ? (
                  <div className="text-[11px] text-app-textMuted/70 italic px-1">
                    No outbound references
                  </div>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {outboundEdges.map((e) => {
                      const tgtNode = nodesById.get(e.target);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => onSelectNode(e.target)}
                          className="w-full text-left flex items-center justify-between px-2 py-1 rounded bg-app-base/40 hover:bg-app-hoverBg border border-app-border/30 text-xs font-mono transition-colors cursor-pointer"
                        >
                          <span className="text-app-textBright truncate font-semibold">
                            {tgtNode?.name || e.target}
                          </span>
                          <span className="text-[10px] text-app-textMuted shrink-0 ml-2">
                            {e.label || e.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty / Default Summary State */
          <div className="space-y-6 text-sm">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-app-textMuted mb-1">
                Active Map
              </div>
              <h3 className="text-base font-bold text-app-textBright font-mono">{scopeLabel}</h3>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-3 rounded-lg bg-app-base/60 border border-app-border/40">
                <div className="text-xl font-bold text-app-accent">{totalNodes}</div>
                <div className="text-[10px] text-app-textMuted uppercase mt-0.5">Nodes</div>
              </div>
              <div className="p-3 rounded-lg bg-app-base/60 border border-app-border/40">
                <div className="text-xl font-bold text-emerald-400">{totalEdges}</div>
                <div className="text-[10px] text-app-textMuted uppercase mt-0.5">Connections</div>
              </div>
            </div>

            <div className="rounded-lg bg-app-base/40 border border-app-border/40 p-3 space-y-2 text-xs text-app-textMuted">
              <div className="font-semibold text-app-textBright text-xs">How to use the Graph:</div>
              <ul className="space-y-1.5 list-disc pl-4 text-[11px] leading-relaxed">
                <li><strong className="text-app-textBright">Click</strong> any node or field to inspect details and documentation.</li>
                <li><strong className="text-app-textBright">Double-click</strong> or click Focus to isolate a node and its direct neighbors.</li>
                <li><strong className="text-app-textBright">Scroll</strong> to zoom, and click + drag canvas to pan around.</li>
                <li>Use the top toolbar to switch between services and files.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
