import type { GraphFilterOptions } from '../../lib/schema-graph';

interface GraphToolbarProps {
  options: GraphFilterOptions;
  onOptionsChange: (newOptions: Partial<GraphFilterOptions>) => void;
  layoutDirection: 'LR' | 'TB';
  onLayoutDirectionChange: (dir: 'LR' | 'TB') => void;
  services: { fqn: string; name: string; package: string }[];
  files: string[];
  activeFile: string;
  onSelectService: (serviceFqn: string) => void;
  onSelectFile: (file: string) => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onFitView: () => void;
  nodeCount: number;
  edgeCount: number;
}

export default function GraphToolbar({
  options,
  onOptionsChange,
  layoutDirection,
  onLayoutDirectionChange,
  services,
  files,
  activeFile,
  onSelectService,
  onSelectFile,
  isInspectorOpen,
  onToggleInspector,
  onFitView,
  nodeCount,
  edgeCount,
}: GraphToolbarProps) {
  return (
    <div className="border-b border-app-border bg-app-base/95 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-sans z-10 shrink-0 select-none">
      {/* Left: Scope Selection & Search */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Scope Dropdown */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-app-textMuted">
            Scope:
          </span>
          <select
            value={
              options.scope === 'service' && options.selectedService
                ? `service:${options.selectedService}`
                : options.scope === 'file' && (options.activeFile || activeFile)
                ? `file:${options.activeFile || activeFile}`
                : ''
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val.startsWith('file:')) {
                onSelectFile(val.substring(5));
              } else if (val.startsWith('service:')) {
                onSelectService(val.substring(8));
              }
            }}
            className="bg-app-panel border border-app-border rounded-lg px-2.5 py-1 text-xs text-app-textBright focus:outline-none focus:border-app-accent cursor-pointer max-w-[240px] truncate"
          >
            {services.length > 0 && (
              <optgroup label="Services">
                {services.map((s) => (
                  <option key={s.fqn} value={`service:${s.fqn}`}>
                    Service: {s.name}
                  </option>
                ))}
              </optgroup>
            )}

            {files.length > 0 && (
              <optgroup label="Files">
                {files.map((f) => (
                  <option key={f} value={`file:${f}`}>
                    File: {f}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Search within Graph */}
        <div className="relative flex items-center">
          <svg className="w-3.5 h-3.5 absolute left-2.5 text-app-textMuted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={options.searchQuery || ''}
            onChange={(e) => onOptionsChange({ searchQuery: e.target.value })}
            placeholder="Filter nodes..."
            className="bg-app-panel border border-app-border rounded-lg pl-8 pr-7 py-1 text-xs text-app-textBright placeholder-app-textMuted/60 focus:outline-none focus:border-app-accent w-40 md:w-52"
          />
          {options.searchQuery && (
            <button
              type="button"
              onClick={() => onOptionsChange({ searchQuery: '' })}
              className="absolute right-2 text-app-textMuted hover:text-app-textBright cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Focused Node Chip (if active) */}
        {options.focusNodeId && (
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono">
            <span>Focused</span>
            <button
              type="button"
              onClick={() => onOptionsChange({ focusNodeId: null })}
              className="ml-1 hover:text-white font-bold cursor-pointer"
              title="Clear focus"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Right: Layout Toggle, Kind Filters, Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Kind Filters */}
        <div className="hidden sm:flex items-center gap-1 bg-app-panel border border-app-border rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => onOptionsChange({ showServices: !options.showServices })}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              options.showServices !== false
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
            title="Toggle Services"
          >
            Services
          </button>
          <button
            type="button"
            onClick={() => onOptionsChange({ showMessages: !options.showMessages })}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              options.showMessages !== false
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
            title="Toggle Messages"
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => onOptionsChange({ showEnums: !options.showEnums })}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              options.showEnums !== false
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
            title="Toggle Enums"
          >
            Enums
          </button>
          <button
            type="button"
            onClick={() => onOptionsChange({ excludeGoogleWkt: !options.excludeGoogleWkt })}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
              options.excludeGoogleWkt !== false
                ? 'text-app-textMuted hover:text-app-textBright'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
            }`}
            title="Include or hide Google Well-Known Types (Timestamp, Any, etc.)"
          >
            {options.excludeGoogleWkt !== false ? 'WKT: Off' : 'WKT: On'}
          </button>
        </div>

        {/* Layout Direction Toggle (LR ↔ TB) */}
        <button
          type="button"
          onClick={() => onLayoutDirectionChange(layoutDirection === 'LR' ? 'TB' : 'LR')}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-app-panel border border-app-border text-app-textBright hover:bg-app-hoverBg transition-colors cursor-pointer text-xs"
          title={`Switch layout to ${layoutDirection === 'LR' ? 'Vertical (Top to Bottom)' : 'Horizontal (Left to Right)'}`}
        >
          {layoutDirection === 'LR' ? (
            <>
              <svg className="w-3.5 h-3.5 text-app-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span>LR</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-app-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 17l-4 4m0 0l-4-4m4 4V3" />
              </svg>
              <span>TB</span>
            </>
          )}
        </button>

        {/* Fit View Button */}
        <button
          type="button"
          onClick={onFitView}
          className="p-1.5 rounded-lg bg-app-panel border border-app-border text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg transition-colors cursor-pointer"
          title="Fit Graph to View"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>

        {/* Toggle Inspector Button */}
        <button
          type="button"
          onClick={onToggleInspector}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
            isInspectorOpen
              ? 'bg-app-accent text-white border-transparent'
              : 'bg-app-panel border-app-border text-app-textBright hover:bg-app-hoverBg'
          }`}
          title="Toggle Inspector Sidebar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span className="hidden md:inline">Inspector</span>
        </button>

        {/* Node & Edge counts badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-app-base border border-app-border/40 text-[11px] font-mono text-app-textMuted">
          <span>{nodeCount} nodes</span>
          <span>•</span>
          <span>{edgeCount} edges</span>
        </div>
      </div>
    </div>
  );
}
