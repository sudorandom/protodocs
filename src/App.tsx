import React, { useState, useEffect, useRef } from 'react';

// --- Data Types ---
interface Annotation extends String {}

interface Field {
  name: string;
  type: string;
  tag: number;
  description: string;
  annotations?: Annotation[];
  isRepeated?: boolean;
}

interface Message {
  name: string;
  description: string;
  fields: Field[];
}

interface EnumValue {
  name: string;
  value: number;
}

interface Enum {
  name: string;
  description: string;
  values: EnumValue[];
}

interface Rpc {
  name: string;
  request: string;
  response: string;
  description: string;
  isServerStream?: boolean;
  isClientStream?: boolean;
  isBidi?: boolean;
}

interface Service {
  name: string;
  description: string;
  rpcs: Rpc[];
}

interface ProtoFile {
  fileName: string;
  package: string;
  description: string;
  messages: Message[];
  services: Service[];
  enums: Enum[];
}


// --- Data for the E-commerce Module ---
const ecommerceProto: ProtoFile = {
  fileName: "ecommerce.proto",
  package: "ecommerce",
  description: "This file defines the core messages and services for an e-commerce platform, including product management, shopping cart operations, and the checkout process.",
  messages: [
    {
      name: "Product",
      description: "Represents a single product in the catalog.",
      fields: [
        { name: "id", type: "string", tag: 1, description: "Unique identifier for the product." },
        { name: "name", type: "string", tag: 2, description: "The product's name." },
        {
          name: "sku",
          type: "string",
          tag: 3,
          description: "Stock Keeping Unit.",
          annotations: [
            "(buf.validate.field).string.min_len = 10",
            "(buf.validate.field).string.max_len = 50",
            "(google.api.field_behavior) = REQUIRED",
            "deprecated = true"
          ]
        },
        { name: "price_usd_cents", type: "int64", tag: 4, description: "Price in cents for USD." },
        { name: "description", type: "string", tag: 5, description: "A detailed product description." },
        { name: "category", type: "Category", tag: 6, description: "The product's category." },
        { name: "is_available", type: "bool", tag: 7, description: "Indicates if the product is currently available." }
      ]
    },
    { name: "CartItem", description: "An item added to the shopping cart.", fields: [{ name: "product_id", type: "string", tag: 1, description: "The ID of the product." },{ name: "quantity", type: "int32", tag: 2, description: "The number of this item in the cart." }] },
    { name: "CheckoutRequest", description: "Request to process a checkout.", fields: [{ name: "items", type: "CartItem", tag: 1, isRepeated: true, description: "The list of items to be purchased." },{ name: "currency_code", type: "string", tag: 2, description: "The currency for the transaction (e.g., USD)." }] },
    { name: "CheckoutResponse", description: "Response after a checkout is processed.", fields: [{ name: "order_id", type: "string", tag: 1, description: "The ID of the new order." }] },
    { name: "GetProductRequest", description: "Request to get a product.", fields: [{ name: "product_id", type: "string", tag: 1, description: "The ID of the product to retrieve." }] },
    { name: "ListProductsRequest", description: "Request to list all products.", fields: [{ name: "page_token", type: "string", tag: 1, description: "A token for pagination." }] },
    { name: "ChatMessage", description: "A message sent in the chat.", fields: [{ name: "sender", type: "string", tag: 1, description: "The name of the sender." },{ name: "message", type: "string", tag: 2, description: "The text of the message." },{ name: "timestamp", type: "int64", tag: 3, description: "Timestamp of the message creation." }] },
    { name: "LogEvent", description: "A single log event to be streamed to the server.", fields: [{ name: "severity", type: "string", tag: 1, description: "The log severity level." },{ name: "message", type: "string", tag: 2, description: "The log message." },{ name: "timestamp", type: "int64", tag: 3, description: "Timestamp of the event." }] },
    { name: "LogResponse", description: "Response after logs have been received.", fields: [{ name: "received_count", type: "int32", tag: 1, description: "The number of log events received." }] }
  ],
  services: [
    { name: "ProductService", description: "Manages product catalog and inventory.", rpcs: [{ name: "GetProduct", request: "GetProductRequest", response: "Product", description: "Retrieves a product by its ID." },{ name: "ListProducts", request: "ListProductsRequest", response: "Product", isServerStream: true, description: "Lists all available products." }] },
    { name: "CheckoutService", description: "Handles the checkout process.", rpcs: [{ name: "Checkout", request: "CheckoutRequest", response: "CheckoutResponse", description: "Processes the purchase of all items in the cart." }] },
    { name: "CommunicationService", description: "Handles real-time communication.", rpcs: [{ name: "Chat", request: "ChatMessage", response: "ChatMessage", isBidi: true, description: "A bidirectional streaming chat." }] },
    { name: "AnalyticsService", description: "Manages streaming log data.", rpcs: [{ name: "LogEvents", request: "LogEvent", response: "LogResponse", isClientStream: true, description: "Streams log events to the server." }] }
  ],
  enums: [
    { name: "Category", description: "Defines the product categories.", values: [{ name: "CATEGORY_UNSPECIFIED", value: 0 },{ name: "ELECTRONICS", value: 1 },{ name: "BOOKS", value: 2 },{ name: "HOME_GOODS", value: 3 }] }
  ]
};

// --- Data for the Orders Module ---
const ordersProto: ProtoFile = {
  fileName: "orders.proto",
  package: "ecommerce",
  description: "Defines messages and services related to order management.",
  messages: [
    { name: "Order", description: "Represents a customer order.", fields: [
        { name: "order_id", type: "string", tag: 1, description: "Unique identifier for the order." },
        { name: "user_id", type: "string", tag: 2, description: "The ID of the user who placed the order." },
        { name: "items", type: "CartItem", tag: 3, isRepeated: true, description: "The items included in the order." },
        { name: "total_price_usd_cents", type: "int64", tag: 4, description: "Total price of the order in USD cents." }
    ]},
    { name: "GetOrderRequest", description: "Request to retrieve an order.", fields: [
        { name: "order_id", type: "string", tag: 1, description: "The ID of the order to retrieve." }
    ]}
  ],
  services: [
    { name: "OrderService", description: "Manages customer orders.", rpcs: [
        { name: "GetOrder", request: "GetOrderRequest", response: "Order", description: "Retrieves an order by its ID." }
    ]}
  ],
  enums: []
};

// --- Data for the Identity Module ---
const identityProto: ProtoFile = {
  fileName: "identity.proto",
  package: "identity",
  description: "This file handles user authentication, authorization, and profile management within the system.",
  messages: [
    { name: "User", description: "Represents a user account.", fields: [{ name: "id", type: "string", tag: 1, description: "Unique user ID." },{ name: "email", type: "string", tag: 2, description: "User's email address." }] },
    { name: "LoginRequest", description: "Request to log in.", fields: [{ name: "email", type: "string", tag: 1, description: "User's email." },{ name: "password", type: "string", tag: 2, description: "User's password." }] },
    { name: "LoginResponse", description: "Response for a login request.", fields: [{ name: "auth_token", type: "string", tag: 1, description: "JWT authentication token." }] }
  ],
  services: [
    { name: "AuthService", description: "Handles user authentication.", rpcs: [{ name: "Login", request: "LoginRequest", response: "LoginResponse", description: "Authenticates a user and returns a token." }] }
  ],
  enums: []
};

// --- List of all available proto files ---
const mockFiles: ProtoFile[] = [ecommerceProto, identityProto, ordersProto];

const getAnchorId = (type: string, name: string) => `#${type}-${name}`;
const getFieldAnchorId = (type: string, name: string, fieldName: string) => `#${type}-${name}--${fieldName}`;

const scalarDocUrls: Record<string, string> = {
  'double': 'https://protobuf.dev/programming-guides/proto3/#scalar-double', 'float': 'https://protobuf.dev/programming-guides/proto3/#scalar-float', 'int32': 'https://protobuf.dev/programming-guides/proto3/#scalar-int32', 'int64': 'https://protobuf.dev/programming-guides/proto3/#scalar-int64', 'uint32': 'https://protobuf.dev/programming-guides/proto3/#scalar-uint32', 'uint64': 'https://protobuf.dev/programming-guides/proto3/#scalar-uint64', 'sint32': 'https://protobuf.dev/programming-guides/proto3/#scalar-sint32', 'sint64': 'https://protobuf.dev/programming-guides/proto3/#scalar-sint64', 'fixed32': 'https://protobuf.dev/programming-guides/proto3/#scalar-fixed32', 'fixed64': 'https://protobuf.dev/programming-guides/proto3/#scalar-fixed64', 'sfixed32': 'https://protobuf.dev/programming-guides/proto3/#scalar-sfixed32', 'sfixed64': 'https://protobuf.dev/programming-guides/proto3/#scalar-sfixed64', 'bool': 'https://protobuf.dev/programming-guides/proto3/#scalar-bool', 'string': 'https://protobuf.dev/programming-guides/proto3/#scalar-string', 'bytes': 'https://protobuf.dev/programming-guides/proto3/#scalar-bytes'
};

interface CompactMessageViewProps {
  message: Message;
  title: string;
}

const CompactMessageView = ({ message, title }: CompactMessageViewProps) => {
  if (!message) return null;
  return (
    <div className="mt-4">
      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">{title}: <span className="font-mono text-purple-500">{message.name}</span></h4>
      <ul className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
        {message.fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <p className="font-mono text-purple-600 dark:text-purple-400 font-medium">
                {field.name}
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.isRepeated ? 'repeated ' : ''}
                {scalarDocUrls[field.type] ? (
                  <a href={scalarDocUrls[field.type]} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-blue-500 hover:underline">
                    {field.type}
                  </a>
                ) : (
                  <span className="font-semibold">{field.type}</span>
                )}
              </span>
            </div>
            {field.description && <p className="text-gray-600 dark:text-gray-300 mt-1 text-xs">{field.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface ProtoDetailViewProps {
    item: Message | Service | Enum | null;
    type: string | null;
    onSelect: (item: Message | Service | Enum, type: string) => void;
    proto: ProtoFile;
}

const ProtoDetailView = ({ item, type, onSelect, proto }: ProtoDetailViewProps) => {
  const [expandedRpc, setExpandedRpc] = useState<string | null>(null);

  if (!item) {
    return (
      <div className="flex items-start justify-center h-full text-center text-gray-500 dark:text-gray-400 p-8 pt-16">
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2 font-mono">{proto.fileName}</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{proto.description}</p>
            <p className="text-xl font-semibold">Select a definition from the sidebar to view its details.</p>
        </div>
      </div>
    );
  }

  const findAndSelect = (typeName: string) => {
    let target: Message | Enum | null = null;
    let targetType = '';
    target = proto.messages.find((msg: Message) => msg.name === typeName);
    if (target) { targetType = 'messages'; }
    else {
      target = proto.enums.find((enm: Enum) => enm.name === typeName);
      if (target) { targetType = 'enums'; }
    }
    if (target) {
      onSelect(target, targetType);
      window.location.hash = getAnchorId(targetType, target.name);
    }
  };

  const renderFields = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Fields</h3>
      <ul className="space-y-2">
        {(item as Message).fields.map((field: Field) => (
          <li key={field.tag} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, field.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 font-semibold"><a href={getFieldAnchorId(type!, item.name, field.name)} className="hover:underline">{field.tag}. {field.name}</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {field.isRepeated ? 'repeated ' : ''}
                {scalarDocUrls[field.type] ? (<a href={scalarDocUrls[field.type]} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:underline">{field.type}</a>) : (<span className="font-semibold">{field.type}</span>)}
              </span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm">{field.description}</p>
            {field.annotations && field.annotations.length > 0 && (
              <div className="mt-3 p-2 bg-gray-200 dark:bg-gray-700 rounded-md">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-200">Annotations:</span>
                <ul className="font-mono text-xs text-gray-800 dark:text-gray-100 mt-1 space-y-1">
                  {field.annotations.map((annotation: Annotation, index: number) => (<li key={index} className="break-words">{annotation}</li>))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderEnums = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Values</h3>
      <ul className="space-y-2">
        {(item as Enum).values.map((value: EnumValue) => (
          <li key={value.value} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, value.name)}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm text-purple-600 font-semibold"><a href={getFieldAnchorId(type!, item.name, value.name)} className="hover:underline">{value.name}</a></p>
              <span className="text-xs text-gray-500 dark:text-gray-400"> = {value.value}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderRpcs = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">RPCs</h3>
      <ul className="space-y-2">
        {(item as Service).rpcs.map((rpc: Rpc) => {
          const isExpanded = expandedRpc === rpc.name;
          const requestMessage = proto.messages.find((m: Message) => m.name === rpc.request);
          const responseMessage = proto.messages.find((m: Message) => m.name === rpc.response);

          return (
            <li key={rpc.name} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm" id={getFieldAnchorId(type!, item.name, rpc.name)}>
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() => setExpandedRpc(isExpanded ? null : rpc.name)}
              >
                <div>
                  <div className="font-bold text-lg text-blue-600 dark:text-blue-400">
                    <a href={getFieldAnchorId(type!, item.name, rpc.name)} className="hover:underline" onClick={(e) => e.stopPropagation()}>{rpc.name}</a>
                  </div>
                </div>
                <svg className={`h-6 w-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                  {rpc.isClientStream ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 hover:text-purple-400 underline transition-colors duration-200 ml-1">{rpc.request}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.request); }} className="font-mono text-purple-600 hover:text-purple-400 underline transition-colors duration-200">{rpc.request}</button>)}
                  <span className="mx-2">&rarr;</span>
                  {rpc.isServerStream || rpc.isBidi ? (<><span className="font-mono text-gray-500 dark:text-gray-400">stream</span><button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200 ml-1">{rpc.response}</button></>) : (<button onClick={(e) => { e.stopPropagation(); findAndSelect(rpc.response); }} className="font-mono text-green-600 hover:text-green-400 underline transition-colors duration-200">{rpc.response}</button>)}
              </div>
              <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">{rpc.description}</p>

              <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] mt-4 pt-4 border-t border-gray-200 dark:border-gray-700' : 'max-h-0'}`}>
                  {requestMessage && <CompactMessageView message={requestMessage} title="Request"/>}
                  {responseMessage && <CompactMessageView message={responseMessage} title="Response"/>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="p-8 space-y-6">
      <div className="border-b dark:border-gray-700 pb-4" id={getAnchorId(type!, item.name)}>
        <h2 className="text-4xl font-extrabold text-gray-900 dark:text-gray-100">{item.name}</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{item.description}</p>
      </div>
      {type === 'messages' && renderFields()}
      {type === 'enums' && renderEnums()}
      {type === 'services' && renderRpcs()}
    </div>
  );
};

interface SectionProps {
    title: string;
    items: (Message | Service | Enum)[];
    selectedItem: Message | Service | Enum | null;
    onSelect: (item: Message | Service | Enum, type: string) => void;
    itemType: string;
}

const Section = ({ title, items, selectedItem, onSelect, itemType }: SectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="w-full">
      <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center justify-between w-full py-2 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none rounded-lg">
        <span>{title}</span>
        <svg className={`h-5 w-5 transform transition-transform duration-200 ${isCollapsed ? 'rotate-0' : '-rotate-90'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div className={`transition-max-h duration-300 ease-in-out overflow-hidden ${isCollapsed ? 'max-h-0' : 'max-h-screen'}`}>
        <ul className="space-y-1 mt-2">
          {items.map(item => (
            <li key={item.name}><a href={getAnchorId(itemType, item.name)}><button onClick={() => onSelect(item, itemType)} className={`w-full text-left py-2 px-6 text-sm rounded-lg transition-colors duration-200 ${ selectedItem && selectedItem.name === item.name ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800' }`}>{item.name}</button></a></li>
          ))}
        </ul>
      </div>
    </div>
  );
};

interface PackageDocumentationViewProps {
    file: ProtoFile;
    onBack: () => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const PackageDocumentationView = ({ file, onBack, isDarkMode, toggleDarkMode }: PackageDocumentationViewProps) => {
  const [selectedItem, setSelectedItem] = useState<Message | Service | Enum | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);
  const proto = file;

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const [type, name] = hash.split('-');
        let foundItem: Message | Service | Enum | undefined;
        let foundType = '';
        if (type === 'messages') { foundItem = proto.messages.find((msg) => msg.name === name); foundType = 'messages'; }
        else if (type === 'services') { foundItem = proto.services.find((svc) => svc.name === name); foundType = 'services'; }
        else if (type === 'enums') { foundItem = proto.enums.find((enm) => enm.name === name); foundType = 'enums'; }
        if (foundItem) { setSelectedItem(foundItem); setSelectedItemType(foundType); }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [proto]);

  useEffect(() => {
    if (selectedItem && selectedItemType) {
      const anchorId = getAnchorId(selectedItemType, selectedItem.name);
      const element = document.getElementById(anchorId.substring(1));
      if (element) { element.scrollIntoView({ behavior: 'smooth' }); }
    }
  }, [selectedItem, selectedItemType]);

  const handleSelect = (item: Message | Service | Enum, type: string) => { setSelectedItem(item); setSelectedItemType(type); };
  const filteredServices = proto.services.filter((svc) => svc.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredMessages = proto.messages.filter((msg) => msg.name.toLowerCase().includes(filterQuery.toLowerCase()));
  const filteredEnums = proto.enums.filter((enm) => enm.name.toLowerCase().includes(filterQuery.toLowerCase()));

  return (
    <div className={`font-sans antialiased text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col md:flex-row transition-colors duration-500`}>
      <div className="flex-shrink-0 w-full md:w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-4 shadow-xl transition-all duration-300 ease-in-out md:block overflow-y-auto">
        <div className="flex items-center justify-between p-2 mb-4">
          <div className="flex items-center space-x-2">
            <button onClick={onBack} className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">&larr;</button>
            <h1 className="text-2xl font-bold text-blue-600">ProtoDocs</h1>
          </div>
          <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">{isDarkMode ? '☀️' : '🌙'}</button>
        </div>
        <div className="p-2 mb-4">
          <input type="text" placeholder="Filter definitions..." value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} className="w-full px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">Package</p>
            <h2 className="font-mono text-base font-semibold text-gray-800 dark:text-gray-100 mt-1 break-words">{proto.package}</h2>
          </div>
          <Section title="Services" items={filteredServices} selectedItem={selectedItem} onSelect={handleSelect} itemType="services" />
          <Section title="Messages" items={filteredMessages} selectedItem={selectedItem} onSelect={handleSelect} itemType="messages" />
          <Section title="Enums" items={filteredEnums} selectedItem={selectedItem} onSelect={handleSelect} itemType="enums" />
        </div>
      </div>
      <main ref={mainRef} className="flex-1 w-full bg-white dark:bg-gray-900 md:rounded-l-3xl shadow-xl z-10 overflow-y-auto transition-colors duration-500">
        <ProtoDetailView item={selectedItem} type={selectedItemType} onSelect={handleSelect} proto={proto} />
      </main>
    </div>
  );
};

interface PackageListViewProps {
    files: ProtoFile[];
    onSelectFile: (file: ProtoFile) => void;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const PackageListView = ({ files, onSelectFile, isDarkMode, toggleDarkMode }: PackageListViewProps) => {
  const packages = files.reduce((acc: Record<string, ProtoFile[]>, file) => {
    if (!acc[file.package]) {
      acc[file.package] = [];
    }
    acc[file.package].push(file);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <header className="p-4 flex justify-between items-center container mx-auto">
        <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">ProtoDocs</h1>
        <button onClick={toggleDarkMode} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200">{isDarkMode ? '☀️' : '🌙'}</button>
      </header>
      <div className="container mx-auto p-8 pt-4">
        <h2 className="text-5xl font-extrabold text-center mb-4 text-gray-900 dark:text-gray-100">Available Packages</h2>
        <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-12">Select a package to view its documentation.</p>
        <div className="max-w-2xl mx-auto space-y-8">
          {Object.entries(packages).map(([packageName, packageFiles]) => {
            const totalServices = packageFiles.reduce((sum, file) => sum + file.services.length, 0);
            const totalTypes = packageFiles.reduce((sum, file) => sum + file.messages.length + file.enums.length, 0);

            return (
              <div key={packageName} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border dark:border-gray-700 flex flex-col md:flex-row items-center justify-between hover:shadow-xl transition-shadow duration-300">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 font-mono">company.{packageName}</h3>
                  <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-2">
                    <span><span className="font-semibold">{totalServices}</span> Services</span>
                    <span><span className="font-semibold">{totalTypes}</span> Types</span>
                  </div>
                </div>
                <button
                  onClick={() => onSelectFile(packageFiles[0])}
                  className="mt-4 md:mt-0 bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition-colors duration-300 self-start md:self-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm">
                  View Documentation
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [selectedFile, setSelectedFile] = useState<ProtoFile | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  if (!selectedFile) {
    return (
      <PackageListView files={mockFiles} onSelectFile={setSelectedFile} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
    );
  }

  return (
    <PackageDocumentationView file={selectedFile} onBack={() => setSelectedFile(null)} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
  );
}