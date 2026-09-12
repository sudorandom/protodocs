import { cleanComment } from './proto-reconstructor';

export type GraphNodeKind = 'service' | 'message' | 'enum';

export interface GraphRpcMethod {
  name: string;
  inputType: string;
  inputTypeName: string;
  outputType: string;
  outputTypeName: string;
  clientStreaming?: boolean;
  serverStreaming?: boolean;
  description?: string;
}

export interface GraphField {
  name: string;
  number: number;
  type: number;
  typeName?: string;
  typeDisplay: string;
  isMessage?: boolean;
  isEnum?: boolean;
  isRepeated?: boolean;
  isOptional?: boolean;
  isMap?: boolean;
  description?: string;
}

export interface GraphEnumValue {
  name: string;
  number: number;
  description?: string;
}

export interface SchemaNodeData extends Record<string, unknown> {
  id: string; // FQN
  kind: GraphNodeKind;
  name: string;
  fullName: string;
  package: string;
  file: string;
  description?: string;
  methods?: GraphRpcMethod[];
  fields?: GraphField[];
  values?: GraphEnumValue[];
  isHighlighted?: boolean;
  isSelected?: boolean;
  isDimmed?: boolean;
  layoutDirection?: 'LR' | 'TB';
  onSelectType?: (fqn: string) => void;
  onSelectNode?: (id: string) => void;
  onGoToSource?: (file: string, symbol: string) => void;
}

export interface SchemaGraphEdgeData extends Record<string, unknown> {
  type: 'rpc-in' | 'rpc-out' | 'field-ref';
  label?: string;
  methodName?: string;
  fieldName?: string;
  isStreaming?: boolean;
}

export interface RawGraphNode {
  id: string;
  kind: GraphNodeKind;
  name: string;
  fullName: string;
  package: string;
  file: string;
  description?: string;
  methods?: GraphRpcMethod[];
  fields?: GraphField[];
  values?: GraphEnumValue[];
}

export interface RawGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'rpc-in' | 'rpc-out' | 'field-ref';
  methodName?: string;
  fieldName?: string;
  isStreaming?: boolean;
}

export interface SchemaGraphModel {
  nodes: RawGraphNode[];
  edges: RawGraphEdge[];
  nodesById: Map<string, RawGraphNode>;
  inboundEdges: Map<string, RawGraphEdge[]>;
  outboundEdges: Map<string, RawGraphEdge[]>;
  packages: string[];
  services: { fqn: string; name: string; file: string; package: string }[];
  files: string[];
}

const FIELD_TYPE_NAMES: Record<number, string> = {
  1: 'double',
  2: 'float',
  3: 'int64',
  4: 'uint64',
  5: 'int32',
  6: 'fixed64',
  7: 'fixed32',
  8: 'bool',
  9: 'string',
  10: 'group',
  11: 'message',
  12: 'bytes',
  13: 'uint32',
  14: 'enum',
  15: 'sfixed32',
  16: 'sfixed64',
  17: 'sint32',
  18: 'sint64',
};

// Normalize FQN so it always has a leading dot
export function normalizeFqn(fqn: string): string {
  if (!fqn) return '';
  return fqn.startsWith('.') ? fqn : `.${fqn}`;
}

export function getShortName(fqn: string): string {
  if (!fqn) return '';
  const clean = fqn.startsWith('.') ? fqn.slice(1) : fqn;
  const parts = clean.split('.');
  return parts[parts.length - 1] || clean;
}

/**
 * Parses all files in the descriptor set and builds a full directed graph of services,
 * messages, enums, and their relationships.
 */
export function buildFullSchemaGraph(
  schemaFiles: any[],
  typeIndex: Record<string, any> = {}
): SchemaGraphModel {
  const nodes: RawGraphNode[] = [];
  const edges: RawGraphEdge[] = [];
  const nodesById = new Map<string, RawGraphNode>();
  const inboundEdges = new Map<string, RawGraphEdge[]>();
  const outboundEdges = new Map<string, RawGraphEdge[]>();
  const packageSet = new Set<string>();
  const fileSet = new Set<string>();
  const servicesList: { fqn: string; name: string; file: string; package: string }[] = [];

  // Helper to record map entries: FQN -> { keyType, valueType, valueTypeName }
  const mapEntries = new Map<string, { keyType: number; valueType: number; valueTypeName?: string }>();

  // Pass 1: find map entry synthetic messages
  schemaFiles.forEach((f) => {
    const pkgPrefix = f.package ? `.${f.package}.` : '.';
    const scanMapEntries = (messages: any[], parentFqn: string) => {
      messages?.forEach((m) => {
        const fqn = `${parentFqn}${m.name}`;
        if (m.options?.mapEntry === true) {
          const keyField = m.field?.find((fld: any) => fld.number === 1);
          const valueField = m.field?.find((fld: any) => fld.number === 2);
          if (keyField && valueField) {
            mapEntries.set(fqn, {
              keyType: keyField.type,
              valueType: valueField.type,
              valueTypeName: valueField.typeName ? normalizeFqn(valueField.typeName) : undefined,
            });
          }
        }
        if (m.nestedType) {
          scanMapEntries(m.nestedType, `${fqn}.`);
        }
      });
    };
    if (f.messageType) {
      scanMapEntries(f.messageType, pkgPrefix);
    }
  });

  // Pass 2: Extract services, messages, and enums
  schemaFiles.forEach((f) => {
    const pkg = f.package || '';
    if (pkg) packageSet.add(pkg);
    if (f.name) fileSet.add(f.name);
    const pkgPrefix = pkg ? `.${pkg}.` : '.';

    // Services
    f.service?.forEach((s: any) => {
      const fqn = `${pkgPrefix}${s.name}`;
      servicesList.push({ fqn, name: s.name, file: f.name, package: pkg });

      const methods: GraphRpcMethod[] = (s.method || []).map((m: any) => {
        const inputType = normalizeFqn(m.inputType);
        const outputType = normalizeFqn(m.outputType);
        return {
          name: m.name,
          inputType,
          inputTypeName: getShortName(inputType),
          outputType,
          outputTypeName: getShortName(outputType),
          clientStreaming: !!m.clientStreaming,
          serverStreaming: !!m.serverStreaming,
          description: m.description ? cleanComment(m.description) : undefined,
        };
      });

      const serviceNode: RawGraphNode = {
        id: fqn,
        kind: 'service',
        name: s.name,
        fullName: fqn,
        package: pkg,
        file: f.name,
        description: s.description ? cleanComment(s.description) : undefined,
        methods,
      };

      nodes.push(serviceNode);
      nodesById.set(fqn, serviceNode);
    });

    // Enums
    const addEnum = (e: any, parentFqn: string) => {
      const fqn = `${parentFqn}${e.name}`;
      const values: GraphEnumValue[] = (e.value || []).map((v: any) => ({
        name: v.name,
        number: v.number,
        description: v.description ? cleanComment(v.description) : undefined,
      }));

      const enumNode: RawGraphNode = {
        id: fqn,
        kind: 'enum',
        name: e.name,
        fullName: fqn,
        package: pkg,
        file: f.name,
        description: e.description ? cleanComment(e.description) : undefined,
        values,
      };

      nodes.push(enumNode);
      nodesById.set(fqn, enumNode);
    };

    f.enumType?.forEach((e: any) => addEnum(e, pkgPrefix));

    // Messages
    const addMessage = (m: any, parentFqn: string) => {
      const fqn = `${parentFqn}${m.name}`;

      // Skip synthetic mapEntry messages as standalone nodes
      if (m.options?.mapEntry === true) {
        return;
      }

      const fields: GraphField[] = (m.field || []).map((fld: any) => {
        const normalizedTypeName = fld.typeName ? normalizeFqn(fld.typeName) : undefined;
        let isMap = false;
        let displayType = FIELD_TYPE_NAMES[fld.type] || 'unknown';
        let refType = normalizedTypeName;

        if (normalizedTypeName && mapEntries.has(normalizedTypeName)) {
          isMap = true;
          const mapInfo = mapEntries.get(normalizedTypeName)!;
          const keyName = FIELD_TYPE_NAMES[mapInfo.keyType] || 'key';
          const valName = mapInfo.valueTypeName
            ? getShortName(mapInfo.valueTypeName)
            : FIELD_TYPE_NAMES[mapInfo.valueType] || 'value';
          displayType = `map<${keyName}, ${valName}>`;
          refType = mapInfo.valueTypeName;
        } else if (fld.type === 11 || fld.type === 14) {
          displayType = normalizedTypeName ? getShortName(normalizedTypeName) : displayType;
        }

        if (fld.label === 3 && !isMap) {
          displayType = `repeated ${displayType}`;
        } else if (fld.label === 1 && fld.proto3Optional) {
          displayType = `optional ${displayType}`;
        }

        const typeInfo = refType ? typeIndex[refType] : undefined;
        const isMsg = fld.type === 11 || typeInfo?.kind === 'message';
        const isEnm = fld.type === 14 || typeInfo?.kind === 'enum';

        return {
          name: fld.name,
          number: fld.number,
          type: fld.type,
          typeName: refType,
          typeDisplay: displayType,
          isMessage: isMsg,
          isEnum: isEnm,
          isRepeated: fld.label === 3,
          isOptional: fld.label === 1,
          isMap,
          description: fld.description ? cleanComment(fld.description) : undefined,
        };
      });

      const messageNode: RawGraphNode = {
        id: fqn,
        kind: 'message',
        name: m.name,
        fullName: fqn,
        package: pkg,
        file: f.name,
        description: m.description ? cleanComment(m.description) : undefined,
        fields,
      };

      nodes.push(messageNode);
      nodesById.set(fqn, messageNode);

      // Process nested messages and enums
      m.nestedType?.forEach((nested: any) => addMessage(nested, `${fqn}.`));
      m.enumType?.forEach((e: any) => addEnum(e, `${fqn}.`));
    };

    f.messageType?.forEach((m: any) => addMessage(m, pkgPrefix));
  });

  // Pass 3: Create Edges
  const edgeDedupe = new Set<string>();

  const addEdge = (edge: RawGraphEdge) => {
    const key = `${edge.source}|${edge.target}|${edge.type}|${edge.fieldName || edge.methodName || ''}`;
    if (edgeDedupe.has(key)) return;
    edgeDedupe.add(key);

    edges.push(edge);

    if (!outboundEdges.has(edge.source)) outboundEdges.set(edge.source, []);
    outboundEdges.get(edge.source)!.push(edge);

    if (!inboundEdges.has(edge.target)) inboundEdges.set(edge.target, []);
    inboundEdges.get(edge.target)!.push(edge);
  };

  nodes.forEach((node) => {
    if (node.kind === 'service' && node.methods) {
      node.methods.forEach((m) => {
        if (m.inputType) {
          addEdge({
            id: `${node.id}->${m.inputType}:${m.name}:in`,
            source: node.id,
            target: m.inputType,
            label: `${m.name} req`,
            type: 'rpc-in',
            methodName: m.name,
            isStreaming: m.clientStreaming,
          });
        }
        if (m.outputType) {
          addEdge({
            id: `${node.id}->${m.outputType}:${m.name}:out`,
            source: node.id,
            target: m.outputType,
            label: `${m.name} res`,
            type: 'rpc-out',
            methodName: m.name,
            isStreaming: m.serverStreaming,
          });
        }
      });
    } else if (node.kind === 'message' && node.fields) {
      node.fields.forEach((fld) => {
        if (fld.typeName) {
          addEdge({
            id: `${node.id}->${fld.typeName}:${fld.name}`,
            source: node.id,
            target: fld.typeName,
            label: fld.name,
            type: 'field-ref',
            fieldName: fld.name,
          });
        }
      });
    }
  });

  return {
    nodes,
    edges,
    nodesById,
    inboundEdges,
    outboundEdges,
    packages: Array.from(packageSet).sort(),
    services: servicesList.sort((a, b) => a.name.localeCompare(b.name)),
    files: Array.from(fileSet).sort(),
  };
}

export interface GraphFilterOptions {
  scope: 'file' | 'service';
  activeFile?: string;
  selectedService?: string;
  showServices?: boolean;
  showMessages?: boolean;
  showEnums?: boolean;
  excludeGoogleWkt?: boolean;
  includeExternalDependencies?: boolean;
  searchQuery?: string;
  focusNodeId?: string | null;
}

/**
 * Filters the schema graph according to user options (active file, service tree, search, etc.)
 */
export function filterSchemaGraph(
  graph: SchemaGraphModel,
  options: GraphFilterOptions
): { nodes: RawGraphNode[]; edges: RawGraphEdge[] } {
  const {
    scope,
    activeFile,
    selectedService,
    showServices = true,
    showMessages = true,
    showEnums = true,
    excludeGoogleWkt = true,
    includeExternalDependencies = true,
    searchQuery = '',
    focusNodeId = null,
  } = options;

  const candidateNodeIds = new Set<string>();

  // 1. Determine base node set from scope
  if (focusNodeId && graph.nodesById.has(focusNodeId)) {
    // Focus mode: node + all direct incoming & outgoing neighbors
    candidateNodeIds.add(focusNodeId);
    (graph.inboundEdges.get(focusNodeId) || []).forEach((e) => candidateNodeIds.add(e.source));
    (graph.outboundEdges.get(focusNodeId) || []).forEach((e) => candidateNodeIds.add(e.target));
  } else if (scope === 'service' && selectedService) {
    // Service scope: service + transitive closure of referenced messages/enums
    const queue = [selectedService];
    candidateNodeIds.add(selectedService);
    const visited = new Set<string>([selectedService]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const outEdges = graph.outboundEdges.get(currentId) || [];
      for (const e of outEdges) {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          candidateNodeIds.add(e.target);
          queue.push(e.target);
        }
      }
    }
  } else if (scope === 'file' && activeFile) {
    // File scope: all nodes defined in the active file
    const fileNodeIds = new Set<string>();
    graph.nodes.forEach((n) => {
      if (n.file === activeFile) {
        fileNodeIds.add(n.id);
        candidateNodeIds.add(n.id);
      }
    });

    // Optionally include 1-hop external dependencies referenced by these file nodes
    if (includeExternalDependencies) {
      fileNodeIds.forEach((id) => {
        (graph.outboundEdges.get(id) || []).forEach((e) => candidateNodeIds.add(e.target));
      });
    }
  } else {
    // Neither a valid service nor a valid file is selected.
    // Disallow showing every file or arbitrary fallbacks.
    return { nodes: [], edges: [] };
  }

  // 2. Filter candidate nodes by kinds, WKT, and search
  const isGoogleWkt = (id: string) => {
    return (
      id.startsWith('.google.protobuf.') &&
      !id.startsWith('.google.protobuf.FileOptions') &&
      !id.startsWith('.google.protobuf.DescriptorProto')
    );
  };

  const filteredNodes: RawGraphNode[] = [];
  const validNodeIds = new Set<string>();

  const lowerQuery = searchQuery.trim().toLowerCase();

  candidateNodeIds.forEach((id) => {
    const node = graph.nodesById.get(id);
    if (!node) return;

    // Filter by kind
    if (node.kind === 'service' && !showServices) return;
    if (node.kind === 'message' && !showMessages) return;
    if (node.kind === 'enum' && !showEnums) return;

    // Filter WKT if requested and not explicitly focused
    if (excludeGoogleWkt && isGoogleWkt(node.id) && focusNodeId !== node.id) {
      return;
    }

    // Filter by search query if provided
    if (lowerQuery) {
      const matchName = node.name.toLowerCase().includes(lowerQuery);
      const matchFqn = node.fullName.toLowerCase().includes(lowerQuery);
      const matchField = node.fields?.some((fld) => fld.name.toLowerCase().includes(lowerQuery));
      const matchMethod = node.methods?.some((m) => m.name.toLowerCase().includes(lowerQuery));
      if (!matchName && !matchFqn && !matchField && !matchMethod) {
        return;
      }
    }

    filteredNodes.push(node);
    validNodeIds.add(node.id);
  });

  // 3. Keep only edges between valid nodes
  const filteredEdges = graph.edges.filter(
    (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target)
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}

export interface LaidOutNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: SchemaNodeData;
  width: number;
  height: number;
}

export interface LaidOutEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  animated?: boolean;
  label?: string;
  data?: SchemaGraphEdgeData;
}

/**
 * Computes estimated node dimensions for graph layout
 */
export function calculateNodeDimensions(node: RawGraphNode): { width: number; height: number } {
  const width = 300;
  let height = 65; // header base height

  if (node.kind === 'service' && node.methods) {
    height += node.methods.length * 86 + 15;
  } else if (node.kind === 'message' && node.fields) {
    const displayedFields = Math.min(node.fields.length, 20);
    height += displayedFields * 28 + (node.fields.length > 20 ? 30 : 15);
  } else if (node.kind === 'enum' && node.values) {
    const displayedValues = Math.min(node.values.length, 15);
    height += displayedValues * 26 + (node.values.length > 15 ? 30 : 15);
  }

  return { width, height };
}

/**
 * Computes directed graph layout ensuring:
 * 1. Request and response messages are ordered in Layer 1 strictly matching the service method order.
 * 2. Dedicated port handles for each method row and message field prevent overlapping lines.
 * 3. Layered spacing ensures edges do not pass under other nodes.
 */
export function computeDagreLayout(
  nodes: RawGraphNode[],
  edges: RawGraphEdge[],
  direction: 'LR' | 'TB' = 'LR'
): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeMap = new Map<string, RawGraphNode>(nodes.map((n) => [n.id, n]));
  const nodeDimMap = new Map<string, { width: number; height: number }>();
  nodes.forEach((n) => {
    nodeDimMap.set(n.id, calculateNodeDimensions(n));
  });

  const inEdges = new Map<string, RawGraphEdge[]>();
  const outEdges = new Map<string, RawGraphEdge[]>();
  edges.forEach((e) => {
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target)!.push(e);
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push(e);
  });

  // Collect all direct service RPC input & output types so they are pinned to Layer 1
  const serviceRpcTypes = new Set<string>();
  nodes.forEach((n) => {
    if (n.kind === 'service' && n.methods) {
      n.methods.forEach((m) => {
        if (m.inputType && nodeMap.has(m.inputType)) serviceRpcTypes.add(m.inputType);
        if (m.outputType && nodeMap.has(m.outputType)) serviceRpcTypes.add(m.outputType);
      });
    }
  });

  // 1. Assign topological ranks (layers)
  const ranks = new Map<string, number>();
  nodes.forEach((n) => {
    // Services or nodes without incoming edges are root layer 0
    if (n.kind === 'service' || !inEdges.has(n.id) || inEdges.get(n.id)!.length === 0) {
      ranks.set(n.id, 0);
    }
  });

  // Direct RPC messages are pinned to Layer 1 so they always sit immediately adjacent to their service
  serviceRpcTypes.forEach((typeId) => {
    if (ranks.get(typeId) !== 0) {
      ranks.set(typeId, 1);
    }
  });

  // Forward relaxation for target layers (with cycle limit)
  let changed = true;
  let iters = 0;
  while (changed && iters < 25) {
    changed = false;
    iters++;
    edges.forEach((e) => {
      // If target is a direct RPC message, pin it to Layer 1 to prevent crossing intermediate layers
      if (serviceRpcTypes.has(e.target)) return;

      const srcRank = ranks.get(e.source);
      if (srcRank !== undefined) {
        const tgtRank = ranks.get(e.target);
        const minRank = srcRank + 1;
        if (tgtRank === undefined || tgtRank < minRank) {
          // Prevent back-edges from blowing up ranks indefinitely
          if (tgtRank === undefined || tgtRank <= srcRank) {
            ranks.set(e.target, minRank);
            changed = true;
          }
        }
      }
    });
  }

  // Fallback for any unassigned nodes
  nodes.forEach((n) => {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  });

  // Group nodes by layer
  const maxRank = Math.max(...ranks.values(), 0);
  const layers: RawGraphNode[][] = Array.from({ length: maxRank + 1 }, () => []);
  nodes.forEach((n) => {
    const r = ranks.get(n.id) ?? 0;
    layers[r].push(n);
  });

  // 2. Order Layer 0: Services first in their definition order, then root messages/enums
  layers[0].sort((a, b) => {
    if (a.kind === 'service' && b.kind !== 'service') return -1;
    if (b.kind === 'service' && a.kind !== 'service') return 1;
    return a.name.localeCompare(b.name);
  });

  // 3. Order Layer 1: Strictly match the order of methods in the service(s)
  if (layers.length > 1) {
    const layer1Nodes = new Set<string>(layers[1].map((n) => n.id));
    const orderedLayer1: RawGraphNode[] = [];
    const addedToLayer1 = new Set<string>();

    layers[0].forEach((rootNode) => {
      if (rootNode.kind === 'service' && rootNode.methods) {
        rootNode.methods.forEach((m) => {
          // Input message comes first
          if (m.inputType && layer1Nodes.has(m.inputType) && !addedToLayer1.has(m.inputType)) {
            const n = nodeMap.get(m.inputType);
            if (n) {
              orderedLayer1.push(n);
              addedToLayer1.add(m.inputType);
            }
          }
          // Output message comes second
          if (m.outputType && layer1Nodes.has(m.outputType) && !addedToLayer1.has(m.outputType)) {
            const n = nodeMap.get(m.outputType);
            if (n) {
              orderedLayer1.push(n);
              addedToLayer1.add(m.outputType);
            }
          }
        });
      } else if (rootNode.fields) {
        rootNode.fields.forEach((f) => {
          if (f.typeName && layer1Nodes.has(f.typeName) && !addedToLayer1.has(f.typeName)) {
            const n = nodeMap.get(f.typeName);
            if (n) {
              orderedLayer1.push(n);
              addedToLayer1.add(f.typeName);
            }
          }
        });
      }
    });

    // Append any remaining layer 1 nodes not connected to services
    layers[1].forEach((n) => {
      if (!addedToLayer1.has(n.id)) {
        orderedLayer1.push(n);
      }
    });
    layers[1] = orderedLayer1;
  }

  // 4. Order subsequent layers (Layer 2..maxRank) by parent barycenters
  for (let r = 2; r <= maxRank; r++) {
    const prevLayerIndex = new Map<string, number>(layers[r - 1].map((n, idx) => [n.id, idx]));
    layers[r].sort((a, b) => {
      const getBarycenter = (node: RawGraphNode) => {
        const ins = inEdges.get(node.id) || [];
        let sum = 0;
        let count = 0;
        ins.forEach((e) => {
          if (prevLayerIndex.has(e.source)) {
            sum += prevLayerIndex.get(e.source)!;
            count++;
          }
        });
        return count > 0 ? sum / count : 9999;
      };
      const baryA = getBarycenter(a);
      const baryB = getBarycenter(b);
      if (baryA !== baryB) return baryA - baryB;
      return a.name.localeCompare(b.name);
    });
  }

  // 5. Position nodes with comfortable spacing preventing line overlap and collisions
  const positions = new Map<string, { x: number; y: number }>();
  const rankSpacing = 180;
  const nodeSpacing = 50;

  if (direction === 'LR') {
    // Lay out layer 1 first (immediately adjacent to layer 0)
    if (layers.length > 1) {
      let currentY = 0;
      const x = 1 * (300 + rankSpacing);
      layers[1].forEach((node) => {
        const dims = nodeDimMap.get(node.id) || { width: 300, height: 100 };
        positions.set(node.id, { x, y: currentY });
        currentY += dims.height + nodeSpacing;
      });
    }

    // Lay out layer 0 centered against its children in layer 1
    let currentL0Y = 0;
    layers[0].forEach((root) => {
      const dims = nodeDimMap.get(root.id) || { width: 300, height: 100 };
      const outs = outEdges.get(root.id) || [];
      const childBounds = outs
        .map((e) => {
          const pos = positions.get(e.target);
          const cdims = nodeDimMap.get(e.target);
          if (!pos || !cdims) return null;
          return { top: pos.y, bottom: pos.y + cdims.height };
        })
        .filter((b): b is { top: number; bottom: number } => b !== null);

      let targetY = currentL0Y;
      if (childBounds.length > 0) {
        const minChildY = Math.min(...childBounds.map((b) => b.top));
        const maxChildBottom = Math.max(...childBounds.map((b) => b.bottom));
        const childCenter = (minChildY + maxChildBottom) / 2;
        targetY = Math.max(currentL0Y, childCenter - dims.height / 2);
      }

      positions.set(root.id, { x: 0, y: Math.round(targetY) });
      currentL0Y = targetY + dims.height + nodeSpacing;
    });

    // Lay out layers 2 through maxRank centered relative to their incoming parents
    for (let r = 2; r <= maxRank; r++) {
      // Sort nodes in layer r by average Y center of their parents in previous layers
      layers[r].sort((a, b) => {
        const getParentCenterY = (nodeId: string) => {
          const ins = inEdges.get(nodeId) || [];
          const parentCenters: number[] = [];
          ins.forEach((e) => {
            const parentPos = positions.get(e.source);
            const parentDim = nodeDimMap.get(e.source);
            if (parentPos && parentDim) {
              parentCenters.push(parentPos.y + parentDim.height / 2);
            }
          });
          if (parentCenters.length === 0) return 999999;
          return parentCenters.reduce((sum, val) => sum + val, 0) / parentCenters.length;
        };
        const centerA = getParentCenterY(a.id);
        const centerB = getParentCenterY(b.id);
        if (centerA !== centerB) return centerA - centerB;
        return a.name.localeCompare(b.name);
      });

      // Compute total height of layer r
      const layerTotalHeight =
        layers[r].reduce((sum, n) => {
          const dims = nodeDimMap.get(n.id) || { width: 300, height: 100 };
          return sum + dims.height;
        }, 0) + Math.max(0, layers[r].length - 1) * nodeSpacing;

      // Find average center of all parents of layer r
      const parentYs: number[] = [];
      layers[r].forEach((n) => {
        const ins = inEdges.get(n.id) || [];
        ins.forEach((e) => {
          const parentPos = positions.get(e.source);
          const parentDim = nodeDimMap.get(e.source);
          if (parentPos && parentDim) {
            parentYs.push(parentPos.y + parentDim.height / 2);
          }
        });
      });

      let startY = 0;
      if (parentYs.length > 0) {
        const avgParentCenter = parentYs.reduce((sum, y) => sum + y, 0) / parentYs.length;
        startY = Math.max(0, Math.round(avgParentCenter - layerTotalHeight / 2));
      }

      let currentY = startY;
      const x = r * (300 + rankSpacing);
      layers[r].forEach((node) => {
        const dims = nodeDimMap.get(node.id) || { width: 300, height: 100 };
        positions.set(node.id, { x, y: currentY });
        currentY += dims.height + nodeSpacing;
      });
    }
  } else {
    // Vertical layout (TB)
    const layerHeights = layers.map((layer) =>
      Math.max(...layer.map((n) => nodeDimMap.get(n.id)?.height || 100), 100)
    );

    let currentY = 0;
    layers.forEach((layer, r) => {
      const rowHeight = layerHeights[r];
      let currentX = 0;
      layer.forEach((node) => {
        const dims = nodeDimMap.get(node.id) || { width: 300, height: 100 };
        positions.set(node.id, { x: currentX, y: currentY });
        currentX += dims.width + nodeSpacing;
      });
      currentY += rowHeight + rankSpacing;
    });
  }

  // 6. Build laid out nodes
  const laidOutNodes: LaidOutNode[] = nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    const dims = nodeDimMap.get(n.id) || { width: 300, height: 100 };

    return {
      id: n.id,
      type: n.kind === 'service' ? 'serviceNode' : n.kind === 'enum' ? 'enumNode' : 'messageNode',
      position: pos,
      width: dims.width,
      height: dims.height,
      data: {
        ...n,
        layoutDirection: direction,
      },
    };
  });

  // 7. Build laid out edges with exact method/field source handles
  const laidOutEdges: LaidOutEdge[] = edges.map((e) => {
    let sourceHandle = direction === 'LR' ? 'source-right' : 'source-bottom';
    if (direction === 'LR') {
      if (e.type === 'rpc-in' && e.methodName) {
        sourceHandle = `method-${e.methodName}-in`;
      } else if (e.type === 'rpc-out' && e.methodName) {
        sourceHandle = `method-${e.methodName}-out`;
      } else if (e.type === 'field-ref' && e.fieldName) {
        sourceHandle = `field-${e.fieldName}`;
      }
    }

    let targetHandle = direction === 'LR' ? 'target-left' : 'target-top';
    if (direction === 'LR') {
      if (e.type === 'rpc-in') {
        targetHandle = 'target-in';
      } else if (e.type === 'rpc-out') {
        targetHandle = 'target-out';
      }
    }

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle,
      targetHandle,
      type: 'bezier',
      animated: !!e.isStreaming,
      label: undefined,
      data: {
        type: e.type,
        label: e.label,
        methodName: e.methodName,
        fieldName: e.fieldName,
        isStreaming: e.isStreaming,
      },
    };
  });

  return { nodes: laidOutNodes, edges: laidOutEdges };
}
