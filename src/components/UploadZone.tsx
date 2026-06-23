import React, { useState, useRef } from 'react';

interface UploadZoneProps {
  onFilesUploaded: (files: File[]) => void;
  onConnectReflection: (url: string, method: 'connect' | 'grpc-web' | 'grpc') => void;
  onLoadDemo: () => void;
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light' | 'cyberpunk';
  setTheme: (theme: 'dark' | 'light' | 'cyberpunk') => void;
  isDesktop?: boolean;
}

export default function UploadZone({
  onFilesUploaded,
  onConnectReflection,
  onLoadDemo,
  loading,
  error,
  theme,
  setTheme,
  isDesktop = false,
}: UploadZoneProps) {
  const [reflectionUrl, setReflectionUrl] = useState('https://demo.connectrpc.com');
  const [reflectionMethod, setReflectionMethod] = useState<'connect' | 'grpc-web' | 'grpc'>('connect');
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-y-auto bg-app-base transition-colors duration-200">
      
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <span className="text-xs text-app-textMuted font-mono">Theme:</span>
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

      {/* Main Card */}
      <div className="max-w-4xl w-full bg-app-panel/40 backdrop-blur-xl border border-app-border/80 rounded-2xl p-8 md:p-10 shadow-2xl flex flex-col gap-8 transition-all duration-300">
        
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-app-accentBg border border-app-accent/50 flex items-center justify-center text-app-accent shadow-inner">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.003 9.003 0 008.354-5.646 9.003 9.003 0 00-8.354-5.646 9.003 9.003 0 00-8.354 5.646 9.003 9.003 0 008.354 5.646z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 11V3m0 0L8.5 6.5M12 3l3.5 3.5" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-app-textBright tracking-tight">ProtoDocs</h1>
          <p className="text-sm text-app-textMuted mt-2 font-medium max-w-md mx-auto leading-relaxed">
            Premium, zero-compile interactive documentation for Protocol Buffer schemas.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3 text-red-400">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-xs font-mono leading-relaxed break-all">
              <span className="font-bold">Error:</span> {error}
            </div>
          </div>
        )}

        {/* Content Container */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          {/* Drop Zone Area (Left/Top) */}
          <div className="md:col-span-6 flex flex-col">
            <div
              onDragOver={isDesktop ? handleDragOver : undefined}
              onDragEnter={isDesktop ? handleDragEnter : undefined}
              onDragLeave={isDesktop ? handleDragLeave : undefined}
              onDrop={isDesktop ? handleDrop : undefined}
              onClick={isDesktop ? handleZoneClick : undefined}
              className={`flex-1 min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition-all duration-300 group select-none relative overflow-hidden ${
                !isDesktop
                  ? 'border-app-border/30 bg-app-panel/10 cursor-not-allowed'
                  : isHovered
                  ? 'border-app-accent bg-app-accentBg shadow-[0_0_15px_rgba(59,130,246,0.15)] cursor-pointer'
                  : 'border-app-border hover:border-app-accent/80 hover:bg-app-hoverBg cursor-pointer'
              }`}
            >
              {isDesktop && (
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".binpb,.pb,.desc"
                  className="hidden"
                  onChange={handleFileChange}
                />
              )}

              {isDesktop ? (
                <>
                  <div className="flex flex-col items-center gap-3 transition-transform duration-300 group-hover:scale-[1.02]">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center transition-colors duration-300 ${
                      isHovered ? 'bg-app-accent text-white' : 'bg-app-panel text-app-textMuted group-hover:text-app-accent'
                    }`}>
                      <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-app-textBright">
                        Drag & drop descriptor files
                      </p>
                      <p className="text-xs text-app-textMuted mt-1 px-4 leading-normal">
                        Supports binary FileDescriptorSet files (<code className="font-mono text-[10px]">.binpb</code>, <code className="font-mono text-[10px]">.pb</code>, <code className="font-mono text-[10px]">.desc</code>)
                      </p>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-3 text-[10px] font-semibold text-app-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Click to browse files &rarr;
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3.5 p-4 select-none">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center bg-app-panel text-app-textMuted/30">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-app-textMuted">
                      Local Upload Disabled
                    </p>
                    <p className="text-xs text-app-textMuted/50 mt-1.5 px-4 leading-relaxed max-w-xs mx-auto">
                      Dragging and dropping or selecting local schema descriptor files is only supported in the native Desktop application.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Divider (Optional text separator) */}
          <div className="md:col-span-1 flex md:flex-col items-center justify-center">
            <span className="text-xs font-bold text-app-textMuted/40 font-mono">OR</span>
          </div>

          {/* Connection / Demo Form (Right/Bottom) */}
          <div className="md:col-span-5 flex flex-col justify-between gap-6">
            
            {/* Server Reflection Input */}
            <form onSubmit={handleReflectionSubmit} className="flex flex-col gap-3">
              <span className="text-xs font-bold text-app-textBright uppercase tracking-wider font-mono">
                Server Reflection
              </span>
              <p className="text-xs text-app-textMuted leading-relaxed">
                Connect directly to a live gRPC or Connect server with reflection enabled.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="http://localhost:50051 or https://..."
                  className="bg-app-base border border-app-border rounded-lg px-3 py-2 text-xs text-app-textBright focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none w-full font-mono placeholder-app-textMuted/40"
                  value={reflectionUrl}
                  onChange={(e) => setReflectionUrl(e.target.value)}
                />
                
                {/* Method selector */}
                <div className="flex rounded-md border border-app-border bg-app-base/50 p-0.5">
                  {(['connect', 'grpc-web', 'grpc'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReflectionMethod(m)}
                      className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                        reflectionMethod === m
                          ? 'bg-app-panel text-app-textBright border border-app-border/40 shadow-sm'
                          : 'text-app-textMuted hover:text-app-textBright'
                      }`}
                    >
                      {m === 'connect' ? 'Connect' : m === 'grpc-web' ? 'gRPC-Web' : 'gRPC'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-app-accent hover:opacity-95 text-white py-2 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect to Server'}
              </button>
            </form>

            <div className="border-t border-app-border/40 my-1"></div>

            {/* Quick Demo */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold text-app-textBright uppercase tracking-wider font-mono">
                Explore a Demo
              </span>
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={loading}
                className="w-full border border-app-accent/40 hover:bg-app-accentBg text-app-accent py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Load Demo Schema</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Info footer */}
      <div className="mt-8 text-center text-[10px] text-app-textMuted/50 font-mono">
        ProtoDocs v1.0.0 &bull; Drag files anywhere to load them
      </div>

    </div>
  );
}
