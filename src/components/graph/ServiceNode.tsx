import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchemaNodeData } from '../../lib/schema-graph';

function ServiceNodeComponent({ data, selected }: NodeProps) {
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
          ? 'ring-2 ring-purple-500 border-purple-500/80 shadow-purple-500/20 shadow-lg'
          : isHighlighted
          ? 'ring-2 ring-purple-400/60 border-purple-400'
          : 'border-app-border hover:border-purple-400/50 hover:shadow-lg'
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
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-app-panel transition-transform hover:!scale-125 z-10"
      />

      {/* Node Header */}
      <div className="rounded-t-xl bg-gradient-to-r from-purple-900/40 via-purple-900/20 to-transparent border-b border-app-border px-3.5 py-2.5 flex items-center justify-between gap-2 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
            SERVICE
          </span>
          <span className="text-xs font-bold text-app-textBright truncate" title={nodeData.name}>
            {nodeData.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {nodeData.methods && (
            <span className="text-[10px] font-mono text-purple-300/80 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
              {nodeData.methods.length} {nodeData.methods.length === 1 ? 'rpc' : 'rpcs'}
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
              className="p-1 rounded text-app-textMuted hover:text-purple-300 hover:bg-purple-500/20 transition-colors"
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

      {/* Methods List */}
      <div className="p-2 space-y-2">
        {!nodeData.methods || nodeData.methods.length === 0 ? (
          <div className="text-[11px] text-app-textMuted px-2 py-1 italic">No methods defined</div>
        ) : (
          nodeData.methods.map((method) => (
            <div
              key={method.name}
              className="relative rounded-lg bg-app-base/60 border border-app-border/40 p-2 text-xs hover:border-purple-500/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <svg className="w-3 h-3 text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-semibold text-app-textBright truncate" title={method.name}>
                    {method.name}
                  </span>
                </div>
                {(method.clientStreaming || method.serverStreaming) && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300 shrink-0">
                    stream
                  </span>
                )}
              </div>

              {/* In / Out Pills with dedicated handles right on each row */}
              <div className="flex flex-col gap-1.5 text-[10px] font-mono pl-3">
                {/* Request Row */}
                <div className="relative flex items-center justify-between text-app-textMuted group/in">
                  <div className="flex items-center gap-1 truncate pr-3">
                    <span className="text-purple-400 font-bold shrink-0">in:</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        nodeData.onSelectType?.(method.inputType);
                      }}
                      className="truncate hover:text-purple-300 hover:underline cursor-pointer text-left"
                      title={method.inputType}
                    >
                      {method.inputTypeName}
                    </button>
                  </div>
                  {/* Dedicated Source Handle for this method's Request */}
                  <Handle
                    type="source"
                    position={sourcePos}
                    id={`method-${method.name}-in`}
                    style={isHorizontal ? { right: -21, top: '50%', transform: 'translateY(-50%)' } : undefined}
                    className="!w-2.5 !h-2.5 !bg-purple-400 !border-2 !border-app-panel hover:!scale-125 transition-transform z-10"
                  />
                </div>

                {/* Response Row */}
                <div className="relative flex items-center justify-between text-app-textMuted group/out">
                  <div className="flex items-center gap-1 truncate pr-3">
                    <span className="text-emerald-400 font-bold shrink-0">out:</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        nodeData.onSelectType?.(method.outputType);
                      }}
                      className="truncate hover:text-emerald-300 hover:underline cursor-pointer text-left"
                      title={method.outputType}
                    >
                      {method.outputTypeName}
                    </button>
                  </div>
                  {/* Dedicated Source Handle for this method's Response */}
                  <Handle
                    type="source"
                    position={sourcePos}
                    id={`method-${method.name}-out`}
                    style={isHorizontal ? { right: -21, top: '50%', transform: 'translateY(-50%)' } : undefined}
                    className="!w-2.5 !h-2.5 !bg-emerald-400 !border-2 !border-app-panel hover:!scale-125 transition-transform z-10"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fallback central source handle */}
      <Handle
        type="source"
        position={sourcePos}
        id={isHorizontal ? 'source-right' : 'source-bottom'}
        className="!w-2.5 !h-2.5 !bg-purple-500 !border-2 !border-app-panel transition-transform hover:!scale-125 opacity-0 pointer-events-none"
      />
    </div>
  );
}

export const ServiceNode = memo(ServiceNodeComponent);
export default ServiceNode;
