import React, { useEffect, useRef, useState } from 'react';
import ProtoDocsLogo from './ProtoDocsLogo';
import ExternalLink from './ExternalLink';

interface UploadZoneProps {
  onFilesUploaded: (files: File[]) => void;
  onConnectReflection: (url: string, method: 'connect' | 'grpc-web' | 'grpc') => void;
  onLoadBsr: (module: string, ref: string, token: string) => void;
  onLoadDemo: () => void;
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light' | 'cyberpunk';
  setTheme: (theme: 'dark' | 'light' | 'cyberpunk') => void;
  logoUrl: string;
  appVersion: string;
  isDesktop?: boolean;
  canLoadBsr?: boolean;
  onClose?: () => void;
}

type LoadTab = 'file' | 'bsr' | 'server' | 'demo';

export default function UploadZone({
  onFilesUploaded,
  onConnectReflection,
  onLoadBsr,
  onLoadDemo,
  loading,
  error,
  theme,
  setTheme,
  logoUrl,
  appVersion,
  isDesktop = false,
  canLoadBsr = false,
  onClose,
}: UploadZoneProps) {
  const [activeTab, setActiveTab] = useState<LoadTab>(() => {
    if (isDesktop) return 'file';
    if (canLoadBsr) return 'bsr';
    return 'server';
  });
  const [reflectionUrl, setReflectionUrl] = useState('https://demo.connectrpc.com');
  const [reflectionMethod, setReflectionMethod] = useState<'connect' | 'grpc-web' | 'grpc'>('connect');
  const [bsrModule, setBsrModule] = useState('buf.build/googleapis/googleapis');
  const [bsrRef, setBsrRef] = useState('main');
  const [bsrToken, setBsrToken] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDesktop && activeTab === 'file') {
      setActiveTab(canLoadBsr ? 'bsr' : 'server');
    } else if (!canLoadBsr && activeTab === 'bsr') {
      setActiveTab('server');
    }
  }, [activeTab, canLoadBsr, isDesktop]);

  const availableTabs: Array<{ id: LoadTab; label: string; enabled: boolean }> = [
    { id: 'file', label: 'Local File', enabled: isDesktop },
    { id: 'bsr', label: 'BSR', enabled: canLoadBsr },
    { id: 'server', label: 'Server', enabled: true },
    { id: 'demo', label: 'Demo', enabled: true },
  ];
  const tabs = availableTabs.filter((tab) => tab.enabled);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesUploaded(Array.from(e.dataTransfer.files));
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesUploaded(Array.from(e.target.files));
    }
  };

  const handleReflectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reflectionUrl.trim()) {
      onConnectReflection(reflectionUrl.trim(), reflectionMethod);
    }
  };

  const handleBsrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bsrModule.trim() && canLoadBsr) {
      onLoadBsr(bsrModule.trim(), bsrRef.trim(), bsrToken.trim());
    }
  };

  const docsLinkClass = "text-app-accent hover:underline underline-offset-2 font-semibold";

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-5 relative overflow-y-auto bg-app-base transition-colors duration-200">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 h-9 w-9 rounded-lg border border-app-border/70 bg-app-panel/80 text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg transition-colors flex items-center justify-center cursor-pointer"
          aria-label="Close schema loader"
          title="Close"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className={`absolute ${onClose ? 'top-5 left-5' : 'top-5 right-5'} flex items-center gap-2`}>
        <div className="flex bg-app-panel border border-app-border rounded-lg p-0.5 select-none shrink-0">
          {(['light', 'dark', 'cyberpunk'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer capitalize ${
                theme === t
                  ? 'bg-app-accent text-white shadow-sm'
                  : 'text-app-textMuted hover:text-app-textBright'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl bg-app-panel/40 backdrop-blur-xl border border-app-border/80 rounded-2xl p-6 md:p-7 shadow-2xl flex flex-col gap-5 transition-all duration-300">
        <div className="flex flex-col items-center gap-3 text-center">
          <ProtoDocsLogo
            logoUrl={logoUrl}
            logoText="ProtoDocs"
            showText={false}
            iconClassName="h-16 w-16"
            imageClassName="h-16 w-16 rounded-xl border border-app-border/70 bg-[#0f172a] shadow-xl"
          />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-app-textBright tracking-normal">ProtoDocs</h1>
            <p className="mt-1 text-sm md:text-base text-app-textMuted leading-snug">
              A modern Protocol Buffers viewer and interactive RPC tester
            </p>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-sm font-bold text-app-textBright uppercase tracking-wider font-mono">Load Schema</h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-3 text-red-400">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-xs font-mono leading-relaxed break-all">
              <span className="font-bold">Error:</span> {error}
            </div>
          </div>
        )}

        <div className="flex rounded-xl border border-app-border bg-app-base/60 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              disabled={!tab.enabled}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-app-panel text-app-textBright shadow-sm border border-app-border/60'
                  : 'text-app-textMuted hover:text-app-textBright'
              } disabled:cursor-not-allowed disabled:opacity-45`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[250px]">
          {activeTab === 'file' && (
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleZoneClick}
              className={`min-h-[250px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-300 group select-none relative overflow-hidden ${
                isHovered
                  ? 'border-app-accent bg-app-accentBg shadow-[0_0_15px_rgba(59,130,246,0.15)] cursor-pointer'
                  : 'border-app-border hover:border-app-accent/80 hover:bg-app-hoverBg cursor-pointer'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".binpb,.pb,.desc"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-3 transition-transform duration-300 group-hover:scale-[1.02]">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isHovered ? 'bg-app-accent text-white' : 'bg-app-panel text-app-textMuted group-hover:text-app-accent'
                }`}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-app-textBright">Local descriptor</p>
                  <p className="text-xs text-app-textMuted mt-1">
                    <code className="font-mono text-[10px]">.binpb</code>, <code className="font-mono text-[10px]">.pb</code>, <code className="font-mono text-[10px]">.desc</code>
                  </p>
                  <p className="text-xs text-app-textMuted mt-3 max-w-sm leading-relaxed">
                    Load a compiled FileDescriptorSet from disk. Descriptor files are the protobuf schema model used for reflection, code generation, and dynamic RPC.{' '}
                    <ExternalLink className={docsLinkClass} href="https://buf.build/docs/reference/descriptors/">
                      Buf descriptor docs
                    </ExternalLink>
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bsr' && (
            <form onSubmit={handleBsrSubmit} className="flex min-h-[250px] flex-col justify-center gap-3">
              <p className="text-xs text-app-textMuted leading-relaxed">
                Load a module directly from the Buf Schema Registry. Public modules work without a token; private modules can use the token field or <code className="font-mono text-[10px]">BUF_TOKEN</code> in the local backend.{' '}
                <ExternalLink className={docsLinkClass} href="https://buf.build/docs/bsr/">
                  Buf BSR docs
                </ExternalLink>
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-app-textBright uppercase tracking-wider font-mono">Module</span>
                <input
                  type="text"
                  placeholder="buf.build/googleapis/googleapis"
                  className="bg-app-base border border-app-border rounded-lg px-3 py-2.5 text-xs text-app-textBright focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none w-full font-mono placeholder-app-textMuted/40"
                  value={bsrModule}
                  onChange={(e) => setBsrModule(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <label className="sm:col-span-2 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-app-textBright uppercase tracking-wider font-mono">Ref</span>
                  <input
                    type="text"
                    placeholder="main"
                    className="bg-app-base border border-app-border rounded-lg px-3 py-2.5 text-xs text-app-textBright focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none w-full font-mono placeholder-app-textMuted/40"
                    value={bsrRef}
                    onChange={(e) => setBsrRef(e.target.value)}
                  />
                </label>
                <label className="sm:col-span-3 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold text-app-textBright uppercase tracking-wider font-mono">Token</span>
                  <input
                    type="password"
                    placeholder="optional"
                    className="bg-app-base border border-app-border rounded-lg px-3 py-2.5 text-xs text-app-textBright focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none w-full font-mono placeholder-app-textMuted/40"
                    value={bsrToken}
                    onChange={(e) => setBsrToken(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={loading || !canLoadBsr || !bsrModule.trim()}
                className="mt-2 w-full bg-app-accent hover:opacity-95 text-white py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Module'}
              </button>
            </form>
          )}

          {activeTab === 'server' && (
            <form onSubmit={handleReflectionSubmit} className="flex min-h-[250px] flex-col justify-center gap-3">
              <p className="text-xs text-app-textMuted leading-relaxed">
                Connect to a live gRPC, gRPC-Web, or Connect endpoint and discover services through server reflection. The server must expose reflection metadata for ProtoDocs to load the schema.{' '}
                <ExternalLink className={docsLinkClass} href="https://grpc.io/docs/guides/reflection/">
                  gRPC reflection docs
                </ExternalLink>
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold text-app-textBright uppercase tracking-wider font-mono">Reflection URL</span>
                <input
                  type="text"
                  placeholder="http://localhost:50051 or https://..."
                  className="bg-app-base border border-app-border rounded-lg px-3 py-2.5 text-xs text-app-textBright focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none w-full font-mono placeholder-app-textMuted/40"
                  value={reflectionUrl}
                  onChange={(e) => setReflectionUrl(e.target.value)}
                />
              </label>
              <div className="flex rounded-lg border border-app-border bg-app-base/50 p-0.5">
                {(['connect', 'grpc-web', 'grpc'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReflectionMethod(m)}
                    className={`flex-1 py-2 text-[10px] font-semibold rounded-md transition-all cursor-pointer ${
                      reflectionMethod === m
                        ? 'bg-app-panel text-app-textBright border border-app-border/40 shadow-sm'
                        : 'text-app-textMuted hover:text-app-textBright'
                    }`}
                  >
                    {m === 'connect' ? 'Connect' : m === 'grpc-web' ? 'gRPC-Web' : 'gRPC'}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-app-accent hover:opacity-95 text-white py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
            </form>
          )}

          {activeTab === 'demo' && (
            <div className="flex min-h-[250px] flex-col items-center justify-center gap-4 text-center">
              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-app-panel text-app-accent border border-app-border">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-app-textMuted leading-relaxed max-w-sm">
                Load the ConnectRPC Eliza demo schema bundled with ProtoDocs. It is a small service definition for trying browsing, references, and RPC calls.{' '}
                <ExternalLink className={docsLinkClass} href="https://buf.build/connectrpc/eliza">
                  Eliza on buf.build
                </ExternalLink>
              </p>
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={loading}
                className="w-full max-w-xs border border-app-accent/40 hover:bg-app-accentBg text-app-accent py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Load Demo Schema'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 text-center text-[10px] text-app-textMuted/50 font-mono">
        ProtoDocs v{appVersion}
      </div>
    </div>
  );
}
