import { describe, it, expect } from 'vitest';
import {
  buildFullSchemaGraph,
  filterSchemaGraph,
  computeDagreLayout,
  normalizeFqn,
  getShortName,
} from './schema-graph';

describe('schema-graph', () => {
  it('normalizes FQNs and gets short names', () => {
    expect(normalizeFqn('foo.bar.Baz')).toBe('.foo.bar.Baz');
    expect(normalizeFqn('.foo.bar.Baz')).toBe('.foo.bar.Baz');
    expect(getShortName('.foo.bar.Baz')).toBe('Baz');
    expect(getShortName('Baz')).toBe('Baz');
  });

  const mockFiles = [
    {
      name: 'test/service.proto',
      package: 'test',
      service: [
        {
          name: 'TestService',
          method: [
            {
              name: 'DoSomething',
              inputType: '.test.TestRequest',
              outputType: '.test.TestResponse',
              clientStreaming: false,
              serverStreaming: true,
            },
          ],
        },
      ],
      messageType: [
        {
          name: 'TestRequest',
          field: [
            {
              name: 'query',
              number: 1,
              type: 9, // string
            },
            {
              name: 'options',
              number: 2,
              type: 11, // message
              typeName: '.test.TestOptions',
            },
          ],
        },
        {
          name: 'TestResponse',
          field: [
            {
              name: 'status',
              number: 1,
              type: 14, // enum
              typeName: '.test.Status',
            },
          ],
        },
        {
          name: 'TestOptions',
          field: [
            {
              name: 'limit',
              number: 1,
              type: 5, // int32
            },
            {
              name: 'metadata',
              number: 2,
              type: 11,
              typeName: '.test.TestOptions.MetadataEntry',
            },
          ],
          nestedType: [
            {
              name: 'MetadataEntry',
              options: { mapEntry: true },
              field: [
                { name: 'key', number: 1, type: 9 },
                { name: 'value', number: 2, type: 9 },
              ],
            },
          ],
        },
      ],
      enumType: [
        {
          name: 'Status',
          value: [
            { name: 'UNKNOWN', number: 0 },
            { name: 'OK', number: 1 },
          ],
        },
      ],
    },
    {
      name: 'other/other.proto',
      package: 'other',
      messageType: [
        {
          name: 'OtherMessage',
          field: [{ name: 'desc', number: 1, type: 9 }],
        },
      ],
    },
  ];

  it('builds full graph from services and messages with map entries', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    // 1 service + 3 messages + 1 enum in test.proto, + 1 message in other.proto = 6 nodes
    expect(graph.nodes.length).toBe(6);
    expect(graph.packages).toEqual(['other', 'test']);
    expect(graph.services.length).toBe(1);

    const serviceNode = graph.nodesById.get('.test.TestService');
    expect(serviceNode).toBeDefined();
    expect(serviceNode?.kind).toBe('service');
    expect(serviceNode?.methods?.length).toBe(1);
    expect(serviceNode?.methods?.[0].serverStreaming).toBe(true);

    const optionsNode = graph.nodesById.get('.test.TestOptions');
    expect(optionsNode).toBeDefined();
    // Map field should display as map<string, string>
    const mapField = optionsNode?.fields?.find((f) => f.name === 'metadata');
    expect(mapField?.typeDisplay).toBe('map<string, string>');
    expect(mapField?.isMap).toBe(true);
  });

  it('filters by service transitively', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const serviceFilter = filterSchemaGraph(graph, {
      scope: 'service',
      selectedService: '.test.TestService',
    });
    // Should include TestService, TestRequest, TestResponse, TestOptions, Status (5 nodes)
    // and NOT OtherMessage
    expect(serviceFilter.nodes.length).toBe(5);
    expect(serviceFilter.nodes.some((n) => n.id === '.other.OtherMessage')).toBe(false);
  });

  it('filters by file', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const fileFilter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: 'other/other.proto',
    });
    expect(fileFilter.nodes.length).toBe(1);
    expect(fileFilter.nodes[0].id).toBe('.other.OtherMessage');
  });

  it('filters by kind toggles', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const filter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: 'test/service.proto',
      showServices: false,
      showEnums: false,
      showMessages: true,
    });
    expect(filter.nodes.every((n) => n.kind === 'message')).toBe(true);
    expect(filter.nodes.length).toBe(3); // TestRequest, TestResponse, TestOptions
  });

  it('filters by search query within scope', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const searchFilter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: 'test/service.proto',
      searchQuery: 'Status',
    });
    // Should match Status enum, and TestResponse which has a field with Status
    expect(searchFilter.nodes.some((n) => n.name === 'Status')).toBe(true);
  });

  it('isolates neighborhood in focus mode', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const focusFilter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: 'test/service.proto',
      focusNodeId: '.test.TestRequest',
    });
    // TestRequest is connected to TestService (inbound) and TestOptions (outbound)
    const nodeIds = focusFilter.nodes.map((n) => n.id);
    expect(nodeIds).toContain('.test.TestRequest');
    expect(nodeIds).toContain('.test.TestService');
    expect(nodeIds).toContain('.test.TestOptions');
    expect(nodeIds).not.toContain('.other.OtherMessage');
  });

  it('disallows dumping all files and isolates file scope', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const filter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: 'test/service.proto',
      includeExternalDependencies: false,
    });
    expect(filter.nodes.some((n) => n.id === '.other.OtherMessage')).toBe(false);
  });

  it('returns empty graph when neither service nor file is selected', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const fileFilter = filterSchemaGraph(graph, {
      scope: 'file',
      activeFile: '',
    });
    expect(fileFilter.nodes.length).toBe(0);
    expect(fileFilter.edges.length).toBe(0);

    const serviceFilter = filterSchemaGraph(graph, {
      scope: 'service',
      selectedService: '',
    });
    expect(serviceFilter.nodes.length).toBe(0);
    expect(serviceFilter.edges.length).toBe(0);
  });

  it('computes Dagre layout for horizontal and vertical directions', () => {
    const graph = buildFullSchemaGraph(mockFiles);
    const lrLayout = computeDagreLayout(graph.nodes, graph.edges, 'LR');
    expect(lrLayout.nodes.length).toBe(6);
    lrLayout.nodes.forEach((n) => {
      expect(n.position.x).toBeTypeOf('number');
      expect(n.position.y).toBeTypeOf('number');
      expect(n.data.layoutDirection).toBe('LR');
    });

    const tbLayout = computeDagreLayout(graph.nodes, graph.edges, 'TB');
    expect(tbLayout.nodes.length).toBe(6);
    tbLayout.nodes.forEach((n) => {
      expect(n.data.layoutDirection).toBe('TB');
    });
  });

  it('strictly orders Layer 1 matching service method sequence and pins direct RPC types', () => {
    const multiMethodService = [
      {
        name: 'gnmi/gnmi.proto',
        package: 'gnmi',
        service: [
          {
            name: 'gNMI',
            method: [
              { name: 'Capabilities', inputType: '.gnmi.CapabilityRequest', outputType: '.gnmi.CapabilityResponse' },
              { name: 'Get', inputType: '.gnmi.GetRequest', outputType: '.gnmi.GetResponse' },
              { name: 'Set', inputType: '.gnmi.SetRequest', outputType: '.gnmi.SetResponse' },
              { name: 'Subscribe', inputType: '.gnmi.SubscribeRequest', outputType: '.gnmi.SubscribeResponse' },
            ],
          },
        ],
        messageType: [
          // Notice: GetResponse references CapabilityRequest to test that CapabilityRequest is NOT pushed to Layer 2
          { name: 'CapabilityRequest', field: [] },
          { name: 'CapabilityResponse', field: [] },
          { name: 'GetRequest', field: [] },
          { name: 'GetResponse', field: [{ name: 'cap', number: 1, type: 11, typeName: '.gnmi.CapabilityRequest' }] },
          { name: 'SetRequest', field: [] },
          { name: 'SetResponse', field: [] },
          { name: 'SubscribeRequest', field: [] },
          { name: 'SubscribeResponse', field: [] },
        ],
      },
    ];

    const graph = buildFullSchemaGraph(multiMethodService);
    const layout = computeDagreLayout(graph.nodes, graph.edges, 'LR');

    // Check that gNMI is in Layer 0 (x = 0)
    const serviceNode = layout.nodes.find((n) => n.id === '.gnmi.gNMI');
    expect(serviceNode).toBeDefined();
    expect(serviceNode?.position.x).toBe(0);

    // Filter Layer 1 nodes (x = 480) and sort by y
    const layer1Nodes = layout.nodes
      .filter((n) => n.id !== '.gnmi.gNMI')
      .sort((a, b) => a.position.y - b.position.y);

    // Every direct RPC message must be in Layer 1 (x = 480)
    layer1Nodes.forEach((n) => {
      expect(n.position.x).toBe(480);
    });

    // Order must strictly match method declaration: CapReq, CapRes, GetReq, GetRes, SetReq, SetRes, SubReq, SubRes
    const expectedOrder = [
      '.gnmi.CapabilityRequest',
      '.gnmi.CapabilityResponse',
      '.gnmi.GetRequest',
      '.gnmi.GetResponse',
      '.gnmi.SetRequest',
      '.gnmi.SetResponse',
      '.gnmi.SubscribeRequest',
      '.gnmi.SubscribeResponse',
    ];
    expect(layer1Nodes.map((n) => n.id)).toEqual(expectedOrder);

    // Verify handles and edge configuration
    const capInEdge = layout.edges.find((e) => e.id === '.gnmi.gNMI->.gnmi.CapabilityRequest:Capabilities:in');
    expect(capInEdge).toBeDefined();
    expect(capInEdge?.sourceHandle).toBe('method-Capabilities-in');
    expect(capInEdge?.targetHandle).toBe('target-in');
    expect(capInEdge?.type).toBe('bezier');
    expect(capInEdge?.label).toBeUndefined(); // RPC in/out edges omit floating text labels to prevent overlap

    const capOutEdge = layout.edges.find((e) => e.id === '.gnmi.gNMI->.gnmi.CapabilityResponse:Capabilities:out');
    expect(capOutEdge).toBeDefined();
    expect(capOutEdge?.sourceHandle).toBe('method-Capabilities-out');
    expect(capOutEdge?.targetHandle).toBe('target-out');

    // Field reference edge should connect field handle to target-left without cluttering line label
    const fieldEdge = layout.edges.find((e) => e.id === '.gnmi.GetResponse->.gnmi.CapabilityRequest:cap');
    expect(fieldEdge).toBeDefined();
    expect(fieldEdge?.sourceHandle).toBe('field-cap');
    expect(fieldEdge?.targetHandle).toBe('target-left');
    expect(fieldEdge?.label).toBeUndefined();
  });
});
