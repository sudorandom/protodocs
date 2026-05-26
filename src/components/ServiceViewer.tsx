import React, { useState } from 'react';
import TypeLink from './TypeLink';
import OptionLink from './OptionLink';
import { FormatOptions } from './options-formatter';
import { formatOptionValue } from '../lib/options-formatter-helpers';
import { generateMockJson } from '../lib/mock-generator';
import { sendRpcRequest } from '../lib/rpc-sender';

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
}: ServiceViewerProps) {
  const fqn = file.package ? `.${file.package}.${service.name}` : `.${service.name}`;
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  return (
    <div id={fqn} className="mb-8 font-mono text-sm rounded transition-colors p-3 hover:bg-slate-800/10 border border-transparent hover:border-slate-800/20 select-text">
      {service.description && (
        <div className="text-syn-comment mb-1 whitespace-pre-wrap">
          // {service.description}
        </div>
      )}
      <div>
        <span className="text-syn-keyword">service</span>{' '}
        <span className="text-app-textBright font-bold">{service.name}</span> {'{'}
      </div>

      <div className="pl-8 my-1">
        {service.options &&
          Object.entries(service.options)
            .filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption')
            .map(([k, v]) => (
              <div key={k} className="text-app-textMuted px-2 py-0.5 rounded -ml-2">
                <span className="text-syn-keyword">option</span>{' '}
                <OptionLink
                  optionKey={k}
                  parentOptionsMessage="ServiceOptions"
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                /> = {formatOptionValue(v, k, 'ServiceOptions', typeIndex)};
              </div>
            ))}
        {service.method?.map((m: any) => {
          const methodFqn = `${fqn}.${m.name}`;
          return (
            <div key={m.name} id={methodFqn} className="mb-3.5 mt-2">
              {m.description && (
                <div className="text-syn-comment mb-0.5 whitespace-pre-wrap">// {m.description}</div>
              )}
              <div
                onClick={() => {
                  const selection = window.getSelection();
                  if (selection && selection.toString()) return;
                  setExpandedMethod(expandedMethod === m.name ? null : m.name);
                }}
                className="hover:bg-app-hoverBg px-2 py-1 rounded -ml-2 cursor-pointer group whitespace-pre-wrap font-mono relative pr-20"
              >
                <span className="inline-flex items-center text-app-textMuted group-hover:text-app-textBright select-none mr-1.5">
                  <svg className="w-3.5 h-3.5 text-app-textMuted group-hover:text-app-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </span>
                
                <span className="text-syn-keyword">rpc</span>{' '}
                <span className="text-app-textBright font-semibold group-hover:underline">{m.name}</span>
                
                <span className="text-app-textMuted">(</span>
                {m.clientStreaming && <span className="text-syn-keyword mr-1">stream</span>}
                <TypeLink
                  typeName={m.inputType}
                  typeIndex={typeIndex}
                  onMouseEnter={onMouseEnter}
                  onMouseLeave={onMouseLeave}
                  onPinClick={onPinClick}
                />
                <span className="text-app-textMuted">)</span>
                
                {' '}<span className="text-syn-keyword">returns</span>{' '}

                <span className="text-app-textMuted">(</span>
                {m.serverStreaming && <span className="text-syn-keyword mr-1">stream</span>}
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
              />
            )}
          </div>
          );
        })}
      </div>
      
      <div>{'}'}</div>
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
}

function RpcMethodTester({
  method,
  packageName,
  serviceName,
  typeIndex,
  registry,
  config,
  onClose,
}: RpcMethodTesterProps) {
  const isStreaming = !!(method.clientStreaming || method.serverStreaming);
  const [endpointUrl, setEndpointUrl] = useState(
    config.reflectionUrl || 'http://localhost:8080'
  );
  const [protocol, setProtocol] = useState<'connect' | 'grpc-web'>('connect');
  const [requestJson, setRequestJson] = useState(() => {
    try {
      const mockObj = generateMockJson(method.inputType, typeIndex);
      return JSON.stringify(mockObj, null, 2);
    } catch {
      return '{}';
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<{
    status: string;
    headers: string;
    body: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cmdTool, setCmdTool] = useState<'buf' | 'curl'>('buf');
  const [copiedProtocol, setCopiedProtocol] = useState<'connect' | 'grpc' | 'grpc-web' | 'curl-connect' | null>(null);

  const getBufCurlCommand = (proto: 'connect' | 'grpc' | 'grpc-web') => {
    const normalizedUrl = endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl;
    const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
    const url = `${normalizedUrl}/${fullServiceName}/${method.name}`;
    const http2Flag = endpointUrl.startsWith('http://') ? ' --http2-prior-knowledge' : '';

    let cleanJson = '{}';
    try {
      cleanJson = JSON.stringify(JSON.parse(requestJson));
    } catch {
      cleanJson = requestJson.replace(/\s+/g, '');
    }

    return `buf curl${http2Flag} \\\n  --protocol ${proto} \\\n  --data '${cleanJson}' \\\n  ${url}`;
  };

  const getCurlCommand = () => {
    const normalizedUrl = endpointUrl.endsWith('/') ? endpointUrl.slice(0, -1) : endpointUrl;
    const fullServiceName = packageName ? `${packageName}.${serviceName}` : serviceName;
    const url = `${normalizedUrl}/${fullServiceName}/${method.name}`;
    const http2Flag = endpointUrl.startsWith('http://') ? ' --http2-prior-knowledge' : '';

    let cleanJson = '{}';
    try {
      cleanJson = JSON.stringify(JSON.parse(requestJson));
    } catch {
      cleanJson = requestJson.replace(/\s+/g, '');
    }

    return `curl${http2Flag} -X POST \\\n  -H "Content-Type: application/json" \\\n  -H "Connect-Protocol-Version: 1" \\\n  -d '${cleanJson}' \\\n  ${url}`;
  };

  const handleCopySingleCmd = (text: string, type: 'connect' | 'grpc' | 'grpc-web' | 'curl-connect') => {
    navigator.clipboard.writeText(text);
    setCopiedProtocol(type);
    setTimeout(() => setCopiedProtocol(null), 2000);
  };

  const [testerView, setTesterView] = useState<'try' | 'curl'>(isStreaming ? 'curl' : 'try');

  const handleSend = async () => {
    if (!registry) {
      setError('FileRegistry not loaded. Cannot serialize request.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResponse(null);
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
      });
      setResponse(res);
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
        {!isStreaming ? (
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
            Streaming Call (CLI Preview Only)
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
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1">
                Endpoint URL
              </label>
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
                {(['connect', 'grpc-web'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProtocol(p)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer select-none ${
                      protocol === p
                        ? 'bg-app-accent text-white shadow'
                        : 'text-app-textMuted hover:text-app-textBright'
                    }`}
                  >
                    {p}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Request JSON Editor */}
            <div>
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1">
                Request Body (JSON)
              </label>
              <textarea
                className="w-full h-48 bg-app-code border border-app-border rounded p-2 text-syn-string font-mono text-xs outline-none focus:border-app-accent resize-y"
                value={requestJson}
                onChange={(e) => setRequestJson(e.target.value)}
              />
            </div>

            {/* Response Viewer */}
            <div className="flex flex-col">
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1">
                Response
              </label>
              <div className="flex-1 min-h-[12rem] bg-app-code border border-app-border rounded p-2 font-mono text-[11px] overflow-auto max-h-72">
                {error && <div className="text-red-400">Error: {error}</div>}
                {response && (
                  <div className="space-y-2">
                    <div className="text-app-accent font-bold">{response.status}</div>
                    <div className="text-[10px] text-app-textMuted border-b border-app-border/40 pb-1.5 whitespace-pre">
                      {response.headers}
                    </div>
                    <pre className="text-syn-type whitespace-pre-wrap">{response.body}</pre>
                  </div>
                )}
                {!error && !response && !isLoading && (
                  <div className="text-app-textMuted italic">Click "Send Request" to invoke the RPC endpoint.</div>
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-app-textMuted italic">
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
          <div className="flex flex-wrap items-center gap-4">
            {/* CLI Tool Selector */}
            <div>
              <label className="block text-[10px] text-app-textMuted uppercase font-bold mb-1 select-none">
                CLI Tool
              </label>
              <div className="flex gap-1.5 bg-app-base border border-app-border rounded p-0.5 select-none">
                {(['buf', 'curl'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCmdTool(t)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer select-none ${
                      cmdTool === t
                        ? 'bg-app-accent text-white shadow'
                        : 'text-app-textMuted hover:text-app-textBright'
                    }`}
                  >
                    {t === 'buf' ? 'buf curl' : 'curl'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {cmdTool === 'buf' ? (
            <div className="space-y-4">
              {/* Connect Protocol */}
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

              {/* gRPC Protocol */}
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

              {/* gRPC-Web Protocol */}
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
            </div>
          ) : (
            <div className="space-y-4">
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
      )}
    </div>
  );
}
