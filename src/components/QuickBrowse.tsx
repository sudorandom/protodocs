import { useState, useMemo, useEffect, useRef } from 'react';

interface QuickBrowseProps {
  schema: { file: any[] };
  activeFile: string;
  onNavigate: (file: string, elementId: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const IconSearch = () => (
  <svg className="w-4 h-4 text-app-textMuted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.602 10.602z" />
  </svg>
);

export default function QuickBrowse({
  schema,
  activeFile,
  onNavigate,
  isOpen,
  setIsOpen,
}: QuickBrowseProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract top-level services, messages, and enums from the active file
  const symbols = useMemo(() => {
    const services: any[] = [];
    const messages: any[] = [];
    const enums: any[] = [];

    if (!activeFile) return { services, messages, enums };

    const f = schema.file.find((file) => file.name === activeFile);
    if (f) {
      const pkgPrefix = f.package ? `.${f.package}.` : '.';

      f.service?.forEach((s: any) => {
        services.push({
          name: s.name,
          fqn: pkgPrefix + s.name,
          file: f.name,
          package: f.package || 'root',
        });
      });

      f.messageType?.forEach((m: any) => {
        messages.push({
          name: m.name,
          fqn: pkgPrefix + m.name,
          file: f.name,
          package: f.package || 'root',
        });
      });

      f.enumType?.forEach((e: any) => {
        enums.push({
          name: e.name,
          fqn: pkgPrefix + e.name,
          file: f.name,
          package: f.package || 'root',
        });
      });
    }

    // Sort alphabetically
    services.sort((a, b) => a.name.localeCompare(b.name));
    messages.sort((a, b) => a.name.localeCompare(b.name));
    enums.sort((a, b) => a.name.localeCompare(b.name));

    return { services, messages, enums };
  }, [schema, activeFile]);

  // Filter symbols based on search text (matches name or fully qualified name)
  const filtered = useMemo(() => {
    const query = filterQuery.toLowerCase().trim();
    if (!query) return symbols;

    const filterFn = (s: any) =>
      s.name.toLowerCase().includes(query) || s.fqn.toLowerCase().includes(query);

    return {
      services: symbols.services.filter(filterFn),
      messages: symbols.messages.filter(filterFn),
      enums: symbols.enums.filter(filterFn),
    };
  }, [symbols, filterQuery]);

  // Handle keyboard event triggers (Esc to close, Cmd+K / Ctrl+K to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (activeFile) {
          setIsOpen(!isOpen);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeFile, setIsOpen]);

  // Focus input field when the modal triggers open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setFilterQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 pb-8 px-4 backdrop-blur-md bg-black/50 select-none cursor-default"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-app-panel border border-app-border rounded-xl shadow-2xl w-full max-w-xl flex flex-col max-h-[70vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Search Box */}
        <div className="p-4 border-b border-app-border flex items-center gap-3">
          <IconSearch />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search services, messages, enums..."
            className="w-full bg-app-base border border-app-border rounded-lg px-3.5 py-2 text-xs text-app-textBright outline-none focus:border-app-accent font-sans"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        {/* Categorized Outline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 outline-none hide-scrollbar select-text">
          
          {/* Services Section */}
          {filtered.services.length > 0 && (
            <div>
              <div className="text-[10px] text-app-textMuted font-bold uppercase tracking-wider mb-2 select-none">
                Services ({filtered.services.length})
              </div>
              <div className="space-y-1">
                {filtered.services.map((s) => (
                  <div
                    key={s.fqn}
                    onClick={() => {
                      onNavigate(s.file, s.fqn);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-xs font-semibold text-app-textBright truncate">{s.name}</span>
                      <span className="text-[10px] text-app-textMuted font-mono truncate">{s.fqn}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 px-2 py-0.5 rounded select-none shrink-0">
                      service
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages Section */}
          {filtered.messages.length > 0 && (
            <div>
              <div className="text-[10px] text-app-textMuted font-bold uppercase tracking-wider mb-2 select-none">
                Messages ({filtered.messages.length})
              </div>
              <div className="space-y-1">
                {filtered.messages.map((m) => (
                  <div
                    key={m.fqn}
                    onClick={() => {
                      onNavigate(m.file, m.fqn);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-xs font-semibold text-app-textBright truncate">{m.name}</span>
                      <span className="text-[10px] text-app-textMuted font-mono truncate">{m.fqn}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded select-none shrink-0">
                      message
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Enums Section */}
          {filtered.enums.length > 0 && (
            <div>
              <div className="text-[10px] text-app-textMuted font-bold uppercase tracking-wider mb-2 select-none">
                Enums ({filtered.enums.length})
              </div>
              <div className="space-y-1">
                {filtered.enums.map((e) => (
                  <div
                    key={e.fqn}
                    onClick={() => {
                      onNavigate(e.file, e.fqn);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors"
                  >
                    <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-xs font-semibold text-app-textBright truncate">{e.name}</span>
                      <span className="text-[10px] text-app-textMuted font-mono truncate">{e.fqn}</span>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded select-none shrink-0">
                      enum
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filtered.services.length === 0 &&
            filtered.messages.length === 0 &&
            filtered.enums.length === 0 && (
              <div className="text-center py-10 text-xs text-app-textMuted font-sans select-none">
                No matching symbols found.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
