import React, { useState } from 'react';
import TypeLink from './TypeLink';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue, formatOptionKey } from '../lib/options-formatter-helpers';
import { generateMockJson } from '../lib/mock-generator';
import { sendRpcRequest } from '../lib/rpc-sender';
import { isProxyEnabled } from '../lib/proxy';
import KeywordLink from './KeywordLink';
import { cleanComment } from '../lib/proto-reconstructor';

interface ServiceViewerProps {
  service: any;
  file: any;
  typeIndex: Record<string, any>;
  onMouseEnter: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  onMouseLeave: () => void;
  onPinClick: (
    e: React.MouseEvent,
    fqn: string,
    desc: any,
    category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value',
    shortName: string
  ) => void;
  registry: any;
  config: any;
  customHeaders: { key: string; value: string }[];
  setCustomHeaders: (headers: { key: string; value: string }[]) => void;
}

export default function ServiceViewer({
  service,
  file,
  typeIndex,
  onMouseEnter,
  onMouseLeave,
  onPinClick,
  registry,
  config,
  customHeaders,
  setCustomHeaders,
}: ServiceViewerProps) {
  const fqn = file.package ? `.${file.package}.${service.name}` : `.${service.name}`;
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  return (
    <div id={fqn} className="mb-8 font-mono text-sm rounded transition-colors p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text">
      {service.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap font-mono">
          {cleanComment(service.description).split('\n').map((line: string) => `// ${line}`).join('\n')}
        </div>
      )}
      <div className="font-mono whitespace-pre-wrap">
        <KeywordLink
          keyword="service"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onPinClick={onPinClick}
        />{' '}
        <span className="text-app-textBright font-bold">{service.name}</span> {'{'}
      </div>

      <div className="my-1">
        {service.options && (() => {
          const optionEntries = Object.entries(service.options).filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption');
          const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
          const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
          const customEntries = optionEntries.filter(([k]) => isCustom(k));
          standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
          customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

          const sortedEntries = [...standardEntries, ...customEntries];
          return sortedEntries.map(([k, v]) => (
            <div key={k} className="text-app-textMuted px-2 py-0.5 rounded -ml-2 font-mono whitespace-pre-wrap">
              {'  '}
              <KeywordLink
                keyword="option"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onPinClick={onPinClick}
              />{' '}
              <OptionLink
                optionKey={k}
                parentOptionsMessage="ServiceOptions"
                typeIndex={typeIndex}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onPinClick={onPinClick}
              /> = {formatOptionValue(v, k, 'ServiceOptions', typeIndex)};
            </div>
          ));
        })()}
        {service.method?.map((m: any) => {
          const methodFqn = `${fqn}.${m.name}`;
          return (
            <div key={m.name} id={methodFqn} className="mb-3.5 mt-2 font-mono">
              {m.description && (
                <div className="text-syn-comment mb-0.5 whitespace-pre-wrap font-mono">
                  {cleanComment(m.description).split('\n').map((line: string) => `  // ${line}`).join('\n')}
                </div>
              )}
              <div
                onClick={() => {
                  const selection = window.getSelection();
                  if (selection && selection.toString()) return;
                  setExpandedMethod(expandedMethod === m.name ? null : m.name);
                }}
                className="hover:bg-app-hoverBg px-2 py-1 rounded -ml-2 cursor-pointer group whitespace-pre-wrap font-mono relative pr-20 text-app-textMuted"
              >
                {'  '}
                <span className="inline-flex items-center text-app-textMuted group-hover:text-app-textBright select-none mr-1.5">
                  <svg className="w-3.5 h-3.5 text-app-textMuted group-hover:text-app-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </span>
                
                <KeywordLink
                  keyword="rpc"
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />{' '}
                <span className="text-app-textBright font-semibold group-hover:underline">{m.name}</span>
                
                <span className="text-app-textMuted">(</span>
                {m.clientStreaming && (
                  <KeywordLink
                    keyword="stream"
                    className="text-syn-keyword border-b border-dotted border-syn-keyword/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text font-mono mr-1"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onPinClick={onPinClick}
                  />
                )}
                <TypeLink
                  typeName={m.inputType}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />
                <span className="text-app-textMuted">)</span>
                
                {' '}
                <KeywordLink
                  keyword="returns"
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />{' '}

                <span className="text-app-textMuted">(</span>
                {m.serverStreaming && (
                  <KeywordLink
                    keyword="stream"
                    className="text-syn-keyword border-b border-dotted border-syn-keyword/60 cursor-pointer hover:bg-app-hoverBg rounded px-0.5 select-text font-mono mr-1"
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onPinClick={onPinClick}
                  />
                )}
                <TypeLink
                  typeName={m.outputType}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />
                <span className="text-app-textMuted">)</span>

                {m.options && Object.keys(m.options).filter(k => !k.startsWith('$') && k !== 'uninterpretedOption').length > 0 ? (
                  <>
                    {' {'}
                    <FormatOptions
                      options={m.options}
                      parentOptionsMessage="MethodOptions"
                      typeIndex={typeIndex}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      onPinClick={onPinClick}
                    />
                    {'}'}
                  </>
                ) : (
                  <span className="text-app-textMain">;</span>
                )}

                <div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100 text-[10px] font-bold bg-app-accent/20 text-app-accent px-1.5 py-0.5 rounded transition-all select-none">
                  {expandedMethod === m.name ? 'Collapse' : 'Try it out'}
                </div>
              </div>

            {expandedMethod === m.name && (
              <RpcMethodTester
                method={m}
                packageName={file.package || ''}
                serviceName={service.name}
                typeIndex={typeIndex}
                registry={registry}
                config={config}
                onClose={() => setExpandedMethod(null)}
                customHeaders={customHeaders}
                setCustomHeaders={setCustomHeaders}
              />
            )}
          </div>
          );
        })}
      </div>
      
      <div className="font-mono whitespace-pre-wrap">{'}'}</div>
    </div>
  );
}

interface RpcMethodTesterProps {
  method: any;
  packageName: string;
  serviceName: string;
  typeIndex: Record<string, any>;
  registry: any;
  config: any;
  onClose: () => void;
  customHeaders: { key: string; value: string }[];
  setCustomHeaders: (headers: { key: string; value: string }[]) => void;
}

function RpcMethodTester({
  method,
  packageName,
  serviceName,
  typeIndex,
  registry,
  config,
  onClose,
  customHeaders,
  setCustomHeaders,
}: RpcMethodTesterProps) {
  const hasProxy = isProxyEnabled();
  const isConsoleSupported = hasProxy || !method.clientStreaming;
  const [endpointUrl, setEndpointUrl] = useState(() => {
    if (config.serviceEndpoints) {
      const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
      const fqn = packageName ? `.${packageName}.${serviceName}` : `.${serviceName}`;
      if (config.serviceEndpoints[fullServiceName]) {
        return config.serviceEndpoints[fullServiceName];
      }
      if (config.serviceEndpoints[fqn]) {
        return config.serviceEndpoints[fqn];
      }
      if (config.serviceEndpoints[serviceName]) {
        return config.serviceEndpoints[serviceName];
      }
    }
    return config.reflectionUrl || 'http://localhost:8080';
  });
  const [protocol, setProtocol] = useState<'connect' | 'grpc-web' | 'grpc'>('connect');
  const [requestJson, setRequestJson] = useState(() => {
    try {
      let mockObj: any = generateMockJson(method.inputType, typeIndex);
      if (method.clientStreaming) {
        mockObj = [mockObj];
      }
      return JSON.stringify(mockObj, null, 2);
    } catch {
      return method.clientStreaming ? '[\n  {}\n]' : '{}';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: string;
    headers: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState<'connect' | 'grpc' | 'grpc-web' | 'curl-connect' | null>(null);
  const [streamMessages, setStreamMessages] = useState<{ id: number; body: string; timestamp: string }[]>([]);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);

  const getBufCurlCommand = (proto: 'connect' | 'grpc' | 'grpc-web') => {
    const normalizedUrl = endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl;
    const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
    const url = `${normalizedUrl}/${fullServiceName}/${method.name}`;
    const http2Flag = endpointUrl.startsWith('http://') ? ' --http2-prior-knowledge' : '';

    let headerArgs = '';
    customHeaders.forEach(({ key, value }) => {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        headerArgs += ` \\\n  --header "${trimmedKey}: ${value.trim()}"`;
      }
    });

    let cleanJson = '{}';
    try {
      cleanJson = JSON.stringify(JSON.parse(requestJson));
    } catch {
      cleanJson = requestJson.replace(/\s+/g, '');
    }

    return `buf curl${http2Flag}${headerArgs} \\\n  --protocol ${proto} \\\n  --data '${cleanJson}' \\\n  ${url}`;
  };

  const getCurlCommand = () => {
    const normalizedUrl = endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl;
    const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
    const url = `${normalizedUrl}/${fullServiceName}/${method.name}`;
    const http2Flag = endpointUrl.startsWith('http://') ? ' --http2-prior-knowledge' : '';

    let headerArgs = '';
    customHeaders.forEach(({ key, value }) => {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        headerArgs += ` \\\n  -H "${trimmedKey}: ${value.trim()}"`;
      }
    });

    let cleanJson = '{}';
    try {
      cleanJson = JSON.stringify(JSON.parse(requestJson));
    } catch {
      cleanJson = requestJson.replace(/\s+/g, '');
    }

    return `curl${http2Flag} -X POST \\\n  -H "Content-Type: application/json" \\\n  -H "Connect-Protocol-Version: 1"${headerArgs} \\\n  -d '${cleanJson}' \\\n  ${url}`;
  };

  const handleCopySingleCmd = (text: string, type: 'connect' | 'grpc' | 'grpc-web' | 'curl-connect' | null) => {
    navigator.clipboard.writeText(text);
    setCopiedProtocol(type);
    setTimeout(() => setCopiedProtocol(null), 2000);
  };

  const handleCopyResponse = () => {
    let copyText = '';
    if (method.serverStreaming) {
      copyText = streamMessages.map((m) => `// Message #${m.id} (${m.timestamp})\n${m.body}`).join('\n\n');
      if (response?.headers) {
        copyText = `${response.headers}\n\n${copyText}`;
      }
    } else {
      copyText = response?.body || '';
    }

    if (copyText) {
      navigator.clipboard.writeText(copyText);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  const handleCopyMessage = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const [testerView, setTesterView] = useState<'try' | 'curl'>(isConsoleSupported ? 'try' : 'curl');

  const handleSend = async () => {
    if (!registry) {
      setError('FileRegistry not loaded. Cannot serialize request.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setStreamMessages([]);

    const extraHeaders: Record<string, string> = {};
    customHeaders.forEach(({ key, value }) => {
      const trimmedKey = key.trim();
      if (trimmedKey) {
        extraHeaders[trimmedKey] = value.trim();
      }
    });

    const isServerStreaming = !!method.serverStreaming;
    const isClientStreaming = !!method.clientStreaming;

    try {
      const res = await sendRpcRequest({
        baseUrl: endpointUrl,
        packageName,
        serviceName,
        methodName: method.name,
        inputFqn: method.inputType,
        outputFqn: method.outputType,
        requestJson,
        protocol,
        registry,
        extraHeaders,
        isServerStreaming,
        isClientStreaming,
        onChunk: (isServerStreaming || isClientStreaming) ? (chunk) => {
          if (chunk.body) {
            setStreamMessages((prev) => [
              ...prev,
              {
                id: prev.length + 1,
                body: chunk.body!,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
          if (chunk.headers) {
            setResponse((prev) => ({
              status: prev?.status || 'Invoking stream...',
              headers: prev?.headers ? `${prev.headers}\n${chunk.headers}` : chunk.headers!,
              body: prev?.body || '',
            }));
          }
        } : undefined,
      });
      setResponse((prev) => ({
        status: res.status,
        headers: prev?.headers || res.headers,
        body: res.body,
      }));
    } catch (err: any) {
      setError(err?.message || 'An error occurred during call execution');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 p-4 bg-app-panel border border-app-border rounded-lg font-sans text-xs space-y-4">
      {/* View Mode Tabs Header */}
      <div className="flex items-center justify-between border-b border-app-border/40 pb-2.5 mb-2 flex-wrap gap-2">
        {isConsoleSupported ? (
          <div className="flex gap-1.5 bg-app-base border border-app-border rounded p-0.5 select-none">
            {(['try', 'curl'] as const).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setTesterView(view)}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all select-none cursor-pointer ${
                  testerView === view
                    ? 'bg-app-accent text-white shadow'
                    : 'text-app-textMuted hover:text-app-textBright'
                }`}
              >
                {view === 'try' ? 'Try it out' : 'CLI'}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-app-textMuted uppercase font-bold select-none px-1 py-1">
            Client/Bidi Streaming Call (CLI Preview Only)
          </div>
        )}

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={onClose}
            title="Close Rpc Console"
            className="text-app-textMuted hover:text-app-textBright rounded p-1 hover:bg-app-hoverBg transition-colors cursor-pointer select-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {testerView === 'try' && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            {/* Endpoint Input */}
            <div className="flex-1 min-w-[200px]">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] text-app-textMuted uppercase font-bold">
                  Endpoint URL
                </label>
                {hasProxy && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    Proxy Active
                  </span>
                )}
              </div>
              <input
                type="text"
                className="w-full bg-app-base border border-app-border rounded px-2 py-1 text-app-textBright outline-none focus:border-app-accent font-mono text-xs"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
              />
            </div>

            {/* Protocol Selector */}
            <div>
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1">
                Protocol
              </label>
              <div className="flex gap-2 bg-app-base border border-app-border rounded p-0.5">
                {(hasProxy ? ['connect', 'grpc-web', 'grpc'] : ['connect', 'grpc-web']).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProtocol(p as 'connect' | 'grpc-web' | 'grpc')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer select-none ${
                      protocol === p
                        ? 'bg-app-accent text-white shadow'
                        : 'text-app-textMuted hover:text-app-textBright'
                    }`}
                  >
                    {p === 'grpc' ? 'gRPC' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <div className="self-end">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSend}
                className="bg-app-accent hover:bg-app-accent/80 text-white font-bold px-4 py-1.5 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed uppercase text-[10px] tracking-wide"
              >
                {isLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>

          {/* Custom Headers Configurator */}
          <div className="border border-app-border/40 rounded-lg p-3 bg-app-code/30">
            <div className="flex items-center justify-between mb-2 select-none">
              <span className="text-[10px] text-app-textMuted uppercase font-bold">Custom Headers (For Auth, Metadata)</span>
              <button
                type="button"
                onClick={() => {
                  setCustomHeaders([...customHeaders, { key: '', value: '' }]);
                }}
                className="text-app-accent hover:text-app-accent/80 font-bold text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none"
              >
                + Add Header
              </button>
            </div>
            
            {customHeaders.length === 0 ? (
              <div className="text-[10px] text-app-textMuted/60 italic pb-0.5">No custom headers configured.</div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {customHeaders.map((h, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Header Name (e.g. Authorization)"
                      className="flex-1 bg-app-base border border-app-border rounded px-2 py-1 text-app-textBright outline-none focus:border-app-accent font-mono text-[10px]"
                      value={h.key}
                      onChange={(e) => {
                        const newHeaders = [...customHeaders];
                        newHeaders[index].key = e.target.value;
                        setCustomHeaders(newHeaders);
                      }}
                    />
                    <span className="text-app-textMuted font-bold select-none">:</span>
                    <input
                      type="text"
                      placeholder="Value (e.g. Bearer token)"
                      className="flex-1 bg-app-base border border-app-border rounded px-2 py-1 text-app-textBright outline-none focus:border-app-accent font-mono text-[10px]"
                      value={h.value}
                      onChange={(e) => {
                        const newHeaders = [...customHeaders];
                        newHeaders[index].value = e.target.value;
                        setCustomHeaders(newHeaders);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newHeaders = customHeaders.filter((_, i) => i !== index);
                        setCustomHeaders(newHeaders);
                      }}
                      className="text-red-400 hover:text-red-300 p-1 hover:bg-app-hoverBg rounded cursor-pointer transition-colors"
                      title="Remove Header"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request JSON Editor */}
            <div>
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1">
                Request Body (JSON)
              </label>
              <textarea
                className="w-full min-h-[12rem] max-h-72 bg-app-code border border-app-border rounded p-2 text-syn-string font-mono text-xs outline-none focus:border-app-accent resize-y"
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
              />
            </div>

            {/* Response Viewer */}
            <div className="flex flex-col">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1 select-none">
                Response
              </label>
              <div className="flex-1 min-h-[12rem] max-h-72 bg-app-code border border-app-border rounded p-3 font-mono text-[11px] overflow-auto relative">
                {/* Global Copy Button */}
                {(response || streamMessages.length > 0) && (
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    className="absolute top-2 right-2 p-1 hover:bg-app-hoverBg rounded text-app-textMuted hover:text-app-textBright transition-colors flex items-center gap-1 select-none cursor-pointer text-[9px] font-bold uppercase tracking-wider bg-app-base/40 border border-app-border/30 z-10"
                    title="Copy full response and headers"
                  >
                    {copiedResponse ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                        </svg>
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}

                {error && <div className="text-red-400">Error: {error}</div>}
                
                {response && (
                  <div className="space-y-3">
                    <div className="text-app-accent font-bold">{response.status}</div>
                    {response.headers && (
                      <div className="text-[10px] text-app-textMuted border-b border-app-border/40 pb-1.5 whitespace-pre pr-12 select-text">
                        {response.headers}
                      </div>
                    )}
                    
                    {!method.serverStreaming && response.body && (
                      <pre className="text-syn-type whitespace-pre-wrap select-text pr-12">{response.body}</pre>
                    )}
                  </div>
                )}

                {method.serverStreaming && streamMessages.length > 0 && (
                  <div className="space-y-3 mt-3">
                    <div className="text-[9px] uppercase font-bold text-app-textMuted select-none border-b border-app-border/20 pb-1">
                      Streaming Messages ({streamMessages.length})
                    </div>
                    {streamMessages.map((msg) => (
                      <div key={msg.id} className="relative border border-app-border/40 rounded p-2 bg-app-base/20 group/msg">
                        <div className="flex items-center justify-between text-[9px] text-app-textMuted border-b border-app-border/10 pb-1 mb-1.5 select-none">
                          <span>Message #{msg.id} &bull; {msg.timestamp}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.body)}
                            className="text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg p-0.5 rounded transition-colors cursor-pointer"
                            title="Copy this message"
                          >
                            {copiedMessageId === msg.id ? (
                              <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 00-9-9z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <pre className="text-syn-type whitespace-pre-wrap select-text">{msg.body}</pre>
                      </div>
                    ))}
                  </div>
                )}

                {!error && !response && streamMessages.length === 0 && !isLoading && (
                  <div className="text-app-textMuted italic select-none">Click "Send Request" to invoke the RPC endpoint.</div>
                )}
                {isLoading && streamMessages.length === 0 && (
                  <div className="flex items-center gap-2 text-app-textMuted italic select-none">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-app-accent"></div>
                    Invoking endpoint...
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {testerView === 'curl' && (
        <div className="space-y-4">
          {/* Connect Protocol (buf curl) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 select-none">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold">
                buf curl (connect protocol)
              </label>
              <button
                type="button"
                onClick={() => handleCopySingleCmd(getBufCurlCommand('connect'), 'connect')}
                className="text-app-accent hover:text-app-accent/80 font-bold uppercase text-[9px] cursor-pointer select-none"
              >
                {copiedProtocol === 'connect' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-app-code border border-app-border rounded-lg p-4 overflow-x-auto font-mono text-[11px] text-syn-string whitespace-pre select-text leading-relaxed">
              {getBufCurlCommand('connect')}
            </pre>
          </div>

          {/* gRPC Protocol (buf curl) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 select-none">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold">
                buf curl (grpc protocol)
              </label>
              <button
                type="button"
                onClick={() => handleCopySingleCmd(getBufCurlCommand('grpc'), 'grpc')}
                className="text-app-accent hover:text-app-accent/80 font-bold uppercase text-[9px] cursor-pointer select-none"
              >
                {copiedProtocol === 'grpc' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-app-code border border-app-border rounded-lg p-4 overflow-x-auto font-mono text-[11px] text-syn-string whitespace-pre select-text leading-relaxed">
              {getBufCurlCommand('grpc')}
            </pre>
          </div>

          {/* gRPC-Web Protocol (buf curl) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 select-none">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold">
                buf curl (grpc-web protocol)
              </label>
              <button
                type="button"
                onClick={() => handleCopySingleCmd(getBufCurlCommand('grpc-web'), 'grpc-web')}
                className="text-app-accent hover:text-app-accent/80 font-bold uppercase text-[9px] cursor-pointer select-none"
              >
                {copiedProtocol === 'grpc-web' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-app-code border border-app-border rounded-lg p-4 overflow-x-auto font-mono text-[11px] text-syn-string whitespace-pre select-text leading-relaxed">
              {getBufCurlCommand('grpc-web')}
            </pre>
          </div>

          {/* Connect Protocol (curl) */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 select-none">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold">
                curl (connect protocol)
              </label>
              <button
                type="button"
                onClick={() => handleCopySingleCmd(getCurlCommand(), 'curl-connect')}
                className="text-app-accent hover:text-app-accent/80 font-bold uppercase text-[9px] cursor-pointer select-none"
              >
                {copiedProtocol === 'curl-connect' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="bg-app-code border border-app-border rounded-lg p-4 overflow-x-auto font-mono text-[11px] text-syn-string whitespace-pre select-text leading-relaxed">
              {getCurlCommand()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
