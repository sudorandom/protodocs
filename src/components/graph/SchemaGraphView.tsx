import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  buildFullSchemaGraph,
  filterSchemaGraph,
  computeDagreLayout,
  type GraphFilterOptions,
  type SchemaNodeData,
  normalizeFqn,
} from '../../lib/schema-graph';

import ServiceNode from './ServiceNode';
import MessageNode from './MessageNode';
import EnumNode from './EnumNode';
import GraphInspector from './GraphInspector';
import GraphToolbar from './GraphToolbar';

const NODE_TYPES = {
  serviceNode: ServiceNode,
  messageNode: MessageNode,
  enumNode: EnumNode,
};

export interface SchemaGraphViewProps {
  schema: { file: any[] };
  typeIndex?: Record<string, any>;
  activeFile: string;
  theme: 'dark' | 'light' | 'cyberpunk';
  initialSymbol?: string;
  initialService?: string;
  onGoToSource: (file: string, symbol: string) => void;
  onSelectFile?: (file: string) => void;
  onSelectService?: (service: string) => void;
}

function SchemaGraphFlow({
  schema,
  typeIndex = {},
  activeFile,
  theme,
  initialSymbol,
  initialService,
  onGoToSource,
  onSelectFile,
  onSelectService,
}: SchemaGraphViewProps) {
  const reactFlow = useReactFlow();

  // Build full schema graph model once when schema or typeIndex changes
  const fullGraph = useMemo(() => {
    return buildFullSchemaGraph(schema.file || [], typeIndex);
  }, [schema, typeIndex]);

  // Layout direction: LR (horizontal) or TB (vertical)
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');

  // Filter options state
  const [options, setOptions] = useState<GraphFilterOptions>(() => {
    // If an initial service was specified, default to service scope
    if (initialService) {
      return {
        scope: 'service',
        selectedService: normalizeFqn(initialService),
        showServices: true,
        showMessages: true,
        showEnums: true,
        excludeGoogleWkt: true,
        includeExternalDependencies: true,
        searchQuery: '',
        focusNodeId: null,
      };
    }
    // Otherwise if an active file exists, default to file scope
    if (activeFile) {
      return {
        scope: 'file',
        activeFile,
        showServices: true,
        showMessages: true,
        showEnums: true,
        excludeGoogleWkt: true,
        includeExternalDependencies: true,
        searchQuery: '',
        focusNodeId: null,
      };
    }
    // No target selected by default (forces user to select a service or file)
    return {
      scope: 'file',
      activeFile: '',
      selectedService: '',
      showServices: true,
      showMessages: true,
      showEnums: true,
      excludeGoogleWkt: true,
      includeExternalDependencies: true,
      searchQuery: '',
      focusNodeId: null,
    };
  });

  // Sync when activeFile or initialService changes from outside
  useEffect(() => {
    if (initialService) {
      const normalized = normalizeFqn(initialService);
      setOptions((prev) => ({
        ...prev,
        scope: 'service',
        selectedService: normalized,
        activeFile: '',
      }));
    }
  }, [initialService]);

  useEffect(() => {
    if (activeFile) {
      setOptions((prev) => ({
        ...prev,
        scope: 'file',
        activeFile,
        selectedService: '',
      }));
    }
  }, [activeFile]);

  useEffect(() => {
    if (!initialService && !activeFile) {
      setOptions((prev) => ({
        ...prev,
        selectedService: '',
        activeFile: '',
        focusNodeId: null,
      }));
    }
  }, [initialService, activeFile]);

  // Selection handlers
  const handleSelectService = useCallback(
    (serviceFqn: string) => {
      const normalized = normalizeFqn(serviceFqn);
      setOptions((prev) => ({
        ...prev,
        scope: 'service',
        selectedService: normalized,
        activeFile: '',
        focusNodeId: null,
      }));
      onSelectService?.(normalized);
    },
    [onSelectService]
  );

  const handleSelectFile = useCallback(
    (file: string) => {
      setOptions((prev) => ({
        ...prev,
        scope: 'file',
        activeFile: file,
        selectedService: '',
        focusNodeId: null,
      }));
      onSelectFile?.(file);
    },
    [onSelectFile]
  );


  // Selected node state for Inspector
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() => {
    return initialSymbol ? normalizeFqn(initialSymbol) : null;
  });

  // If initialSymbol changes from outside (e.g. hash changed), select it
  useEffect(() => {
    if (initialSymbol) {
      const normalized = normalizeFqn(initialSymbol);
      setSelectedNodeId(normalized);
    }
  }, [initialSymbol]);

  // Inspector sidebar toggle state
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);

  const handleOptionsChange = useCallback((newOpts: Partial<GraphFilterOptions>) => {
    setOptions((prev) => ({ ...prev, ...newOpts }));
  }, []);

  // Filter the full graph based on current options
  const filtered = useMemo(() => {
    return filterSchemaGraph(fullGraph, options);
  }, [fullGraph, options]);

  // Calculate connected neighbor node IDs for highlighting / dimming
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const ids = new Set<string>([selectedNodeId]);
    (fullGraph.inboundEdges.get(selectedNodeId) || []).forEach((e) => ids.add(e.source));
    (fullGraph.outboundEdges.get(selectedNodeId) || []).forEach((e) => ids.add(e.target));
    return ids;
  }, [selectedNodeId, fullGraph]);

  // Select node handler
  const handleSelectNode = useCallback(
    (id: string) => {
      const normalized = normalizeFqn(id);
      setSelectedNodeId(normalized);
      setIsInspectorOpen(true);

      // Smoothly pan to the selected node
      const node = reactFlow.getNode(normalized);
      if (node && node.position) {
        reactFlow.setCenter(
          node.position.x + (node.measured?.width || 300) / 2,
          node.position.y + (node.measured?.height || 150) / 2,
          { zoom: Math.max(reactFlow.getZoom(), 0.85), duration: 600 }
        );
      }
    },
    [reactFlow]
  );

  // Compute Dagre layout
  const { nodes: rawLaidOutNodes, edges: rawLaidOutEdges } = useMemo(() => {
    return computeDagreLayout(filtered.nodes, filtered.edges, layoutDirection);
  }, [filtered, layoutDirection]);

  // Enhance nodes with callbacks, selection, highlight, and dim states
  const decoratedNodes = useMemo(() => {
    return rawLaidOutNodes.map((n) => {
      const isSelected = n.id === selectedNodeId;
      const isConnected = connectedNodeIds ? connectedNodeIds.has(n.id) : true;
      const isDimmed = connectedNodeIds !== null && !isConnected;

      const enhancedData: SchemaNodeData = {
        ...n.data,
        isSelected,
        isHighlighted: isConnected && selectedNodeId !== null,
        isDimmed,
        layoutDirection,
        onSelectNode: handleSelectNode,
        onSelectType: handleSelectNode,
        onGoToSource,
      };

      return {
        ...n,
        selected: isSelected,
        data: enhancedData,
      } as Node;
    });
  }, [
    rawLaidOutNodes,
    selectedNodeId,
    connectedNodeIds,
    layoutDirection,
    handleSelectNode,
    onGoToSource,
  ]);

  // Enhance edges with styling
  const decoratedEdges = useMemo(() => {
    return rawLaidOutEdges.map((e) => {
      const isHighlighted =
        selectedNodeId !== null &&
        (e.source === selectedNodeId || e.target === selectedNodeId);

      const isDimmed =
        selectedNodeId !== null &&
        e.source !== selectedNodeId &&
        e.target !== selectedNodeId;

      let strokeColor = 'rgba(100, 116, 139, 0.5)'; // default slate
      if (e.data?.type === 'rpc-in') {
        strokeColor = 'rgba(168, 85, 247, 0.7)'; // purple
      } else if (e.data?.type === 'rpc-out') {
        strokeColor = 'rgba(52, 211, 153, 0.7)'; // emerald
      } else if (e.data?.type === 'field-ref') {
        strokeColor = 'rgba(59, 130, 246, 0.6)'; // blue
      }

      if (isHighlighted) {
        if (e.data?.type === 'rpc-out') {
          strokeColor = '#10b981'; // bright emerald
        } else if (e.data?.type === 'rpc-in') {
          strokeColor = '#c084fc'; // bright purple
        } else {
          strokeColor = '#60a5fa'; // bright blue
        }
      }

      return {
        ...e,
        animated: !!e.animated || isHighlighted,
        zIndex: isHighlighted ? 10 : 1,
        style: {
          stroke: strokeColor,
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          opacity: isDimmed ? 0.2 : 1,
        },
      } as Edge;
    });
  }, [rawLaidOutEdges, selectedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(decoratedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(decoratedEdges);

  // Sync state when layout / nodes / edges change
  useEffect(() => {
    setNodes(decoratedNodes);
    setEdges(decoratedEdges);
  }, [decoratedNodes, decoratedEdges, setNodes, setEdges]);

  // Fit view once on load or when scope changes
  const hasFitInitially = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlow.fitView({ padding: 0.2, duration: 400 });
      hasFitInitially.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, [options.scope, options.selectedService, options.activeFile, reactFlow]);

  // Fit view button handler
  const handleFitView = useCallback(() => {
    reactFlow.fitView({ padding: 0.2, duration: 500 });
  }, [reactFlow]);

  // Selected node details for Inspector
  const selectedNodeObj = useMemo(() => {
    if (!selectedNodeId) return null;
    return fullGraph.nodesById.get(selectedNodeId) || null;
  }, [selectedNodeId, fullGraph]);

  const selectedInbound = useMemo(() => {
    if (!selectedNodeId) return [];
    return fullGraph.inboundEdges.get(selectedNodeId) || [];
  }, [selectedNodeId, fullGraph]);

  const selectedOutbound = useMemo(() => {
    if (!selectedNodeId) return [];
    return fullGraph.outboundEdges.get(selectedNodeId) || [];
  }, [selectedNodeId, fullGraph]);

  // Scope label for inspector summary
  const scopeLabel = useMemo(() => {
    if (options.scope === 'file' && (options.activeFile || activeFile)) {
      return `File: ${options.activeFile || activeFile}`;
    }
    if (options.scope === 'service' && options.selectedService) {
      return `Service: ${options.selectedService}`;
    }
    return 'None';
  }, [options, activeFile]);

  // MiniMap node color based on kind
  const nodeColor = useCallback((node: any) => {
    const kind = node.data?.kind;
    if (kind === 'service') return '#a855f7';
    if (kind === 'message') return '#10b981';
    if (kind === 'enum') return '#f59e0b';
    return '#64748b';
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-app-code relative overflow-hidden select-none">
      {/* Top Toolbar */}
      <GraphToolbar
        options={options}
        onOptionsChange={handleOptionsChange}
        layoutDirection={layoutDirection}
        onLayoutDirectionChange={setLayoutDirection}
        services={fullGraph.services}
        files={fullGraph.files}
        activeFile={activeFile}
        onSelectService={handleSelectService}
        onSelectFile={handleSelectFile}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        onFitView={handleFitView}
        nodeCount={filtered.nodes.length}
        edgeCount={filtered.edges.length}
      />

      {/* Main Canvas & Inspector container */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 relative h-full">
          {filtered.nodes.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-app-textMuted font-mono">
              <svg className="w-12 h-12 mb-3 text-app-textMuted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm font-bold text-app-textBright">No graph nodes match current filters</div>
              <div className="text-xs mt-1 text-app-textMuted/80 max-w-sm">
                Try adjusting kind filters or clearing the search query in the toolbar above.
              </div>
              <button
                type="button"
                onClick={() =>
                  handleOptionsChange({
                    showServices: true,
                    showMessages: true,
                    showEnums: true,
                    searchQuery: '',
                    focusNodeId: null,
                  })
                }
                className="mt-4 px-3 py-1.5 rounded-lg bg-app-panel border border-app-border text-xs text-app-textBright hover:bg-app-hoverBg cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={NODE_TYPES}
              onNodeClick={(_, node) => handleSelectNode(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              minZoom={0.1}
              maxZoom={2.5}
              proOptions={{ hideAttribution: true }}
              className="touch-none"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1.2}
                color={
                  theme === 'light'
                    ? 'rgba(100, 116, 139, 0.25)'
                    : theme === 'cyberpunk'
                    ? 'rgba(234, 0, 217, 0.2)'
                    : 'rgba(148, 163, 184, 0.15)'
                }
              />
              <Controls
                position="bottom-left"
                className="!bg-app-panel !border-app-border !rounded-lg !shadow-lg [&>button]:!bg-app-panel [&>button]:!border-app-border [&>button]:!text-app-textBright hover:[&>button]:!bg-app-hoverBg"
              />
              <MiniMap
                position="bottom-right"
                nodeColor={nodeColor}
                nodeStrokeWidth={2}
                maskColor={
                  theme === 'light'
                    ? 'rgba(241, 245, 249, 0.7)'
                    : 'rgba(15, 23, 42, 0.75)'
                }
                className="!bg-app-panel !border !border-app-border !rounded-lg !shadow-xl !overflow-hidden hidden sm:block"
                style={{ width: 140, height: 90 }}
              />
            </ReactFlow>
          )}
        </div>

        {/* Protomap Inspector Sidebar */}
        <GraphInspector
          selectedNode={selectedNodeObj}
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          onSelectNode={handleSelectNode}
          onGoToSource={onGoToSource}
          inboundEdges={selectedInbound}
          outboundEdges={selectedOutbound}
          nodesById={fullGraph.nodesById}
          totalNodes={filtered.nodes.length}
          totalEdges={filtered.edges.length}
          scopeLabel={scopeLabel}
          isFocused={!!options.focusNodeId}
          onToggleFocus={(nodeId) => handleOptionsChange({ focusNodeId: nodeId })}
        />
      </div>
    </div>
  );
}

export default function SchemaGraphView(props: SchemaGraphViewProps) {
  return (
    <ReactFlowProvider>
      <SchemaGraphFlow {...props} />
    </ReactFlowProvider>
  );
}
