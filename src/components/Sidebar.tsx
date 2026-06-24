import { useState, useMemo, useEffect } from 'react';
import { safeHttpUrl } from '../lib/safe-url';

interface SidebarProps {
  logoUrl: string;
  logoText: string;
  sidebarView: 'files' | 'services';
  setSidebarView: (view: 'files' | 'services') => void;
  schema: { file: any[] };
  activeFile: string;
  setActiveFile: (file: string) => void;
  parsedServices: Record<string, any[]>;
  onGoToElement: (file: string, elementId: string) => void;
  loading: boolean;
  error: string | null;
  theme: 'dark' | 'light' | 'cyberpunk';
  setTheme: (theme: 'dark' | 'light' | 'cyberpunk') => void;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  prioritizedPaths?: string[];
  highlightedFiles?: string[];
}

const IconFile = () => (
  <svg className="w-4 h-4 text-app-textMuted group-hover:text-app-textBright shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconFolder = () => (
  <svg className="w-4 h-4 text-app-textMuted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const IconServer = () => (
  <svg className="w-4 h-4 text-app-textMuted group-hover:text-app-textBright shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);
const getThemeIcon = (themeName: 'light' | 'dark' | 'cyberpunk', sizeClass: string = "w-4 h-4") => {
  switch (themeName) {
    case 'light':
      return (
        <svg className={`${sizeClass} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
        </svg>
      );
    case 'dark':
      return (
        <svg className={`${sizeClass} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    case 'cyberpunk':
      return (
        <svg className={`${sizeClass} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
};

export default function Sidebar({
  logoUrl,
  logoText,
  sidebarView,
  setSidebarView,
  schema,
  activeFile,
  setActiveFile,
  parsedServices,
  onGoToElement,
  loading,
  error,
  theme,
  setTheme,
  isSidebarOpen,
  onCloseSidebar,
  prioritizedPaths,
  highlightedFiles,
}: SidebarProps) {
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const safeLogoUrl = safeHttpUrl(logoUrl);

  // Close theme dropdown when clicking anywhere outside of it
  useEffect(() => {
    if (!isThemeMenuOpen) return;
    const handleClose = () => setIsThemeMenuOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isThemeMenuOpen]);

  // Group and sort files by directory (common prefix merging)
  const groupedFiles = useMemo(() => {
    const groups: Record<string, any[]> = {};
    schema.file.forEach((file) => {
      const parts = file.name.split('/');
      const fileName = parts.pop() || '';
      const dir = parts.join('/') || 'root';
      if (!groups[dir]) {
        groups[dir] = [];
      }
      groups[dir].push({ ...file, displayName: fileName });
    });

    // Sort files within each directory. Highlighted or prioritized files rise to the top.
    Object.keys(groups).forEach((dir) => {
      groups[dir].sort((a, b) => {
        const aIsPrioritized = highlightedFiles?.includes(a.name) || prioritizedPaths?.includes(a.name);
        const bIsPrioritized = highlightedFiles?.includes(b.name) || prioritizedPaths?.includes(b.name);
        
        if (aIsPrioritized && bIsPrioritized) {
          return a.displayName.localeCompare(b.displayName);
        }
        if (aIsPrioritized) return -1;
        if (bIsPrioritized) return 1;
        
        return a.displayName.localeCompare(b.displayName);
      });
    });

    // Sort directories: 'root' first, then prioritizedPaths, then alphabetical
    const sortedDirs = Object.keys(groups).sort((a, b) => {
      if (a === 'root') return -1;
      if (b === 'root') return 1;

      if (prioritizedPaths && prioritizedPaths.length > 0) {
        // Find if directories match or are subdirectories of any prioritized paths
        const aIndex = prioritizedPaths.findIndex(p => a === p || a.startsWith(p + '/'));
        const bIndex = prioritizedPaths.findIndex(p => b === p || b.startsWith(p + '/'));

        if (aIndex !== -1 && bIndex !== -1) {
          if (aIndex !== bIndex) return aIndex - bIndex;
          return a.localeCompare(b);
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
      }

      return a.localeCompare(b);
    });

    return { sortedDirs, groups };
  }, [schema, prioritizedPaths, highlightedFiles]);

  // Sort packages alphabetically
  const sortedPackages = useMemo(() => {
    return Object.keys(parsedServices).sort((a, b) => a.localeCompare(b));
  }, [parsedServices]);

  return (
    <div
      className={`w-72 border-r border-app-border bg-app-panel flex flex-col transition-all duration-300 shrink-0 select-none fixed top-14 md:top-0 bottom-0 left-0 z-40 md:relative md:translate-x-0 md:flex ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      
      {/* Top Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-app-border shrink-0 relative">
        <div
          onClick={() => {
            window.location.hash = '#/';
            setActiveFile('');
            onCloseSidebar();
          }}
          className="flex items-center gap-2 truncate cursor-pointer hover:opacity-85 transition-opacity"
        >
          {safeLogoUrl ? (
            <img src={safeLogoUrl} alt="Logo" className="max-h-8 object-contain" />
          ) : (
            <div className="flex items-center gap-2 select-none">
              {/* Default Theme-Adaptive Logo SVG Icon */}
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Stylized Document Shape */}
                <path d="M9 7h10l5 5v13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
                {/* Folded corner */}
                <path d="M19 7v5h5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
                {/* Connection lines */}
                <line x1="12" y1="20" x2="16" y2="15" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
                <line x1="16" y1="15" x2="20" y2="18" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6"/>
                {/* Schema Nodes */}
                <circle cx="12" cy="20" r="3" fill="var(--syn-option)"/>
                <circle cx="16" cy="15" r="3" fill="var(--syn-primitive)"/>
                <circle cx="20" cy="18" r="3" fill="var(--syn-string)"/>
              </svg>
              <span className="font-bold text-base text-app-textBright tracking-wide truncate">{logoText}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Theme Switcher Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsThemeMenuOpen(!isThemeMenuOpen);
            }}
            title={`Select Theme (Current: ${theme})`}
            className={`text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg transition-colors flex items-center justify-center ${
              isThemeMenuOpen ? 'bg-app-hoverBg text-app-textBright' : ''
            }`}
          >
            {getThemeIcon(theme, "w-5 h-5")}
          </button>

          {/* Close Button for mobile */}
          <button
            type="button"
            onClick={onCloseSidebar}
            className="md:hidden text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg transition-colors flex items-center justify-center cursor-pointer"
            title="Close Sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Theme Dropdown Menu */}
        {isThemeMenuOpen && (
          <div className="absolute top-12 right-6 w-40 bg-app-panel border border-app-border rounded-lg shadow-2xl z-50 py-1 divide-y divide-app-border/40 select-none">
            {(['light', 'dark', 'cyberpunk'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTheme(t);
                  setIsThemeMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2 text-left px-4 py-2.5 text-xs font-semibold capitalize hover:bg-app-hoverBg transition-colors ${
                  theme === t ? 'text-app-accent font-bold' : 'text-app-textBright'
                }`}
              >
                {getThemeIcon(t, "w-4 h-4")}
                <span>{t} Theme</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 py-2 border-b border-app-border shrink-0">
        <div className="flex bg-app-base rounded-md p-0.5 w-full border border-app-border">
          <button
            onClick={() => setSidebarView('files')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded transition-all duration-200 cursor-pointer ${
              sidebarView === 'files'
                ? 'bg-app-panel text-app-textBright shadow border border-app-border'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setSidebarView('services')}
            className={`flex-1 text-xs font-semibold py-1.5 rounded transition-all duration-200 cursor-pointer ${
              sidebarView === 'services'
                ? 'bg-app-panel text-app-textBright shadow border border-app-border'
                : 'text-app-textMuted hover:text-app-textBright'
            }`}
          >
            Services
          </button>
        </div>
      </div>
      
      {/* Sidebar List Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {loading && (
          <div className="px-6 py-8 text-xs text-app-textMuted flex flex-col items-center justify-center gap-3 text-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-app-accent"></div>
            <span>Loading Schema...</span>
          </div>
        )}

        {error && (
          <div className="mx-4 my-2 px-3 py-2 text-[11px] text-red-400 bg-red-950/20 border border-red-900/40 rounded-lg whitespace-pre-wrap leading-normal">
            {error}
          </div>
        )}

        {!loading && !error && schema.file.length === 0 && (
          <div className="px-6 py-8 text-xs text-app-textMuted text-center">
            No descriptors loaded.
          </div>
        )}

        {/* Grouped and Merged Directories */}
        {!loading && !error && sidebarView === 'files' ? (
          groupedFiles.sortedDirs.map((dir) => {
            const files = groupedFiles.groups[dir];
            return (
              <div key={dir} className="mb-3">
                {dir !== 'root' && (
                  <div className="flex items-center px-4 py-1 text-[10px] font-bold text-app-textMuted uppercase tracking-wider gap-2 select-none">
                    <IconFolder />
                    <span className="truncate" title={dir}>
                      {dir}/
                    </span>
                  </div>
                )}
                {files.map((file) => {
                  const isHighlighted = highlightedFiles?.includes(file.name);
                  return (
                    <div
                      key={file.name}
                      onClick={() => {
                        setActiveFile(file.name);
                        onCloseSidebar();
                      }}
                      className={`flex items-center py-1.5 text-xs cursor-pointer group transition-colors justify-between ${
                        dir === 'root' ? 'px-6' : 'pl-8 pr-6'
                      } ${
                        activeFile === file.name
                          ? 'bg-app-accentBg text-app-accent border-r-2 border-app-accent font-semibold'
                          : 'hover:bg-app-hoverBg hover:text-app-textBright'
                      }`}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <IconFile />
                        <span className="ml-2.5 truncate" title={file.name}>
                          {file.displayName}
                        </span>
                      </div>
                      {isHighlighted && (
                        <span className="ml-2 text-amber-500 font-bold select-none text-xs shrink-0" title="Core Schema File">
                          ★
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          !loading &&
          !error &&
          sortedPackages.map((pkg) => {
            const services = parsedServices[pkg];
            return (
              <div key={pkg} className="mb-3">
                <div className="flex items-center px-4 py-1.5 text-[10px] font-bold text-app-textMuted uppercase tracking-wider gap-2">
                  <IconFolder />
                  <span className="truncate" title={pkg}>
                    {pkg}
                  </span>
                </div>
                {services.map((svc) => (
                  <div
                    key={svc.name}
                    onClick={() => {
                      onGoToElement(svc.file, `.${pkg}.${svc.name}`);
                      onCloseSidebar();
                    }}
                    className="flex items-center px-6 py-1.5 text-xs cursor-pointer group transition-colors hover:bg-app-hoverBg hover:text-app-textBright"
                  >
                    <IconServer />
                    <span className="ml-2.5 truncate" title={svc.name}>
                      {svc.name}
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
