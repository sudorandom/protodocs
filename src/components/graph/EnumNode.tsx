import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchemaNodeData } from '../../lib/schema-graph';

function EnumNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as SchemaNodeData;
  const isHorizontal = (nodeData.layoutDirection || 'LR') === 'LR';
  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;

  const isDimmed = nodeData.isDimmed;
  const isHighlighted = nodeData.isHighlighted;

  return (
    <div
      className={`w-[280px] rounded-xl border bg-app-panel shadow-md transition-all duration-150 font-sans select-none relative ${
        selected
          ? 'ring-2 ring-amber-500 border-amber-500/80 shadow-amber-500/20 shadow-lg'
          : isHighlighted
          ? 'ring-2 ring-amber-400/60 border-amber-400'
          : 'border-app-border hover:border-amber-400/50 hover:shadow-lg'
      } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
      onClick={(e) => {
        e.stopPropagation();
        nodeData.onSelectNode?.(nodeData.id);
      }}
    >
      {/* Input Connection Handle */}
      <Handle
        type="target"
        position={targetPos}
        id={isHorizontal ? 'target-left' : 'target-top'}
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />

      {/* Node Header */}
      <div className="rounded-t-xl bg-gradient-to-r from-amber-900/40 via-amber-900/20 to-transparent border-b border-app-border px-3.5 py-2.5 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
            ENUM
          </span>
          <span className="text-xs font-bold text-app-textBright truncate" title={nodeData.name}>
            {nodeData.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {nodeData.values && (
            <span className="text-[10px] font-mono text-amber-300/80 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
              {nodeData.values.length} {nodeData.values.length === 1 ? 'val' : 'vals'}
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
              className="p-1 rounded text-app-textMuted hover:text-amber-300 hover:bg-amber-500/20 transition-colors"
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

      {/* Enum Values List */}
      <div className="p-2 space-y-1 overflow-visible">
        {!nodeData.values || nodeData.values.length === 0 ? (
          <div className="text-[11px] text-app-textMuted px-2 py-1 italic">No values defined</div>
        ) : (
          <>
            {nodeData.values.slice(0, 15).map((v) => (
              <div
                key={v.name}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-app-base/50 text-[11px] font-mono border border-app-border/20"
              >
                <span className="text-app-textBright font-semibold truncate" title={v.name}>
                  {v.name}
                </span>
                <span className="text-amber-400/90 font-mono text-[10px] shrink-0">
                  = {v.number}
                </span>
              </div>
            ))}
            {nodeData.values.length > 15 && (
              <div className="text-[10px] text-app-textMuted/70 text-center py-1 font-mono italic">
                + {nodeData.values.length - 15} more values
              </div>
            )}
          </>
        )}
      </div>

      {/* Output Connection Handle */}
      <Handle
        type="source"
        position={sourcePos}
        id={isHorizontal ? 'source-right' : 'source-bottom'}
        className="!w-2.5 !h-2.5 !bg-amber-500 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />
    </div>
  );
}

export const EnumNode = memo(EnumNodeComponent);
export default EnumNode;
