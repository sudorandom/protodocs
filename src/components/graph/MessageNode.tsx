import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchemaNodeData } from '../../lib/schema-graph';

function MessageNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as SchemaNodeData;
  const isHorizontal = (nodeData.layoutDirection || 'LR') === 'LR';
  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;

  const isDimmed = nodeData.isDimmed;
  const isHighlighted = nodeData.isHighlighted;

  return (
    <div
      className={`w-[300px] rounded-xl border bg-app-panel shadow-md transition-all duration-150 font-sans select-none relative ${
        selected
          ? 'ring-2 ring-emerald-500 border-emerald-500/80 shadow-emerald-500/20 shadow-lg'
          : isHighlighted
          ? 'ring-2 ring-emerald-400/60 border-emerald-400'
          : 'border-app-border hover:border-emerald-400/50 hover:shadow-lg'
      } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
      onClick={(e) => {
        e.stopPropagation();
        nodeData.onSelectNode?.(nodeData.id);
      }}
    >
      {/* Target handle for RPC Request edges (upper) */}
      <Handle
        type="target"
        position={targetPos}
        id="target-in"
        style={isHorizontal ? { top: '35%' } : undefined}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />

      {/* Target handle for RPC Response edges (lower) */}
      <Handle
        type="target"
        position={targetPos}
        id="target-out"
        style={isHorizontal ? { top: '65%' } : undefined}
        className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />

      {/* Default Target handle (center) for Field References */}
      <Handle
        type="target"
        position={targetPos}
        id={isHorizontal ? 'target-left' : 'target-top'}
        style={isHorizontal ? { top: '50%' } : undefined}
        className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />

      {/* Node Header */}
      <div className="rounded-t-xl bg-gradient-to-r from-emerald-900/40 via-emerald-900/20 to-transparent border-b border-app-border px-3.5 py-2.5 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
            MESSAGE
          </span>
          <span className="text-xs font-bold text-app-textBright truncate" title={nodeData.name}>
            {nodeData.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {nodeData.fields && (
            <span className="text-[10px] font-mono text-emerald-300/80 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              {nodeData.fields.length} {nodeData.fields.length === 1 ? 'field' : 'fields'}
            </span>
          )}
          {nodeData.onGoToSource && (
            <button
              type="button"
              title="View in Document View"
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onGoToSource?.(nodeData.file, nodeData.fullName);
              }}
              className="p-1 rounded text-app-textMuted hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Package & File subheader */}
      <div className="px-3.5 py-1 text-[10px] text-app-textMuted/70 font-mono truncate border-b border-app-border/40 bg-app-base/40">
        {nodeData.package || nodeData.file}
      </div>

      {/* Fields List */}
      <div className="p-2 space-y-1 overflow-visible">
        {!nodeData.fields || nodeData.fields.length === 0 ? (
          <div className="text-[11px] text-app-textMuted px-2 py-1 italic">Empty message</div>
        ) : (
          <>
            {nodeData.fields.slice(0, 20).map((field) => {
              const hasLink = !!field.typeName && (field.isMessage || field.isEnum);
              return (
                <div
                  key={field.name}
                  className="relative flex items-center justify-between gap-2 px-2 py-1 rounded bg-app-base/50 text-[11px] font-mono border border-app-border/20 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-app-textMuted/60 shrink-0">#{field.number}</span>
                    <span className="text-app-textBright font-semibold truncate" title={field.name}>
                      {field.name}
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-1 max-w-[50%]">
                    {hasLink ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          nodeData.onSelectType?.(field.typeName!);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer truncate text-right text-[10px] font-semibold"
                        title={field.typeName}
                      >
                        {field.typeDisplay}
                      </button>
                    ) : (
                      <span className="text-app-textMuted text-[10px] truncate" title={field.typeDisplay}>
                        {field.typeDisplay}
                      </span>
                    )}
                  </div>

                  {/* Handle for this referenced field */}
                  {hasLink && (
                    <Handle
                      type="source"
                      position={sourcePos}
                      id={`field-${field.name}`}
                      style={isHorizontal ? { right: -17, top: '50%', transform: 'translateY(-50%)' } : undefined}
                      className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-app-panel hover:!scale-125 transition-transform z-10"
                    />
                  )}
                </div>
              );
            })}
            {nodeData.fields.length > 20 && (
              <div className="text-[10px] text-app-textMuted/70 text-center py-1 font-mono italic">
                + {nodeData.fields.length - 20} more fields
              </div>
            )}
          </>
        )}
      </div>

      {/* Fallback central output handle */}
      <Handle
        type="source"
        position={sourcePos}
        id={isHorizontal ? 'source-right' : 'source-bottom'}
        className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-app-panel transition-transform hover:!scale-125 opacity-0 pointer-events-none"
      />
    </div>
  );
}

export const MessageNode = memo(MessageNodeComponent);
export default MessageNode;
