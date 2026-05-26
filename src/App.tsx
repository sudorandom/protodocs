import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createFileRegistry } from '@bufbuild/protobuf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadDescriptorsFromUrls } from './lib/descriptor-loader';
import { loadSchemaFromReflection } from './lib/reflection-client';
import Sidebar from './components/Sidebar';
import Tooltip, { type TooltipState } from './components/Tooltip';
import ReferencePanel, { type ReferencePanelState } from './components/ReferencePanel';
import ServiceViewer from './components/ServiceViewer';
import MessageViewer from './components/MessageViewer';
import EnumViewer from './components/EnumViewer';
import { formatOptionKey, formatOptionValue } from './lib/options-formatter-helpers';
import ExtensionGroupViewer from './components/ExtensionGroupViewer';
import OptionLink from './components/OptionLink';
import { populateTypeIndexWithOptions, normalizeFileDescriptor } from './lib/option-resolver';
import { reconstructProto, getEditionString } from './lib/proto-reconstructor';

interface AppConfig {
  loadingMethod: 'http' | 'grpc-web' | 'connect';
  descriptorFiles: string[];
  reflectionUrl: string;
  logoUrl: string;
  logoText: string;
  defaultFile?: string;
  frontPageMarkdownFile?: string;
  bottomOfFrontPageMarkdownFile?: string;
  serviceEndpoints?: Record<string, string>;
}

const DEFAULT_CONFIG: AppConfig = {
  loadingMethod: 'http',
  descriptorFiles: ['/gnostic.binpb', '/protovalidate.binpb', '/googleapis.binpb'],
  reflectionUrl: 'http://127.0.0.1',
  logoUrl: '',
  logoText: 'ProtoDocs',
  frontPageMarkdownFile: '/home.md',
  bottomOfFrontPageMarkdownFile: '/footer.md',
};

interface ParsedHash {
  filepath: string;
  symbol: string;
}

// Parses location hash: #/files/google/protobuf/any.proto?symbol=.google.protobuf.Any
function parseHash(hash: string): ParsedHash {
  const cleanHash = hash.replace(/^#/, '');
  if (!cleanHash.startsWith('/files/')) {
    return { filepath: '', symbol: '' };
  }
  const [filePathPart, queryPart] = cleanHash.substring(7).split('?');
  const params = new URLSearchParams(queryPart || '');
  const symbol = params.get('symbol') || '';
  return { filepath: filePathPart, symbol };
}

export default function App() {
  const [theme, setThemeState] = useState<'dark' | 'light' | 'cyberpunk'>(() => {
    const saved = localStorage.getItem('protodocs_theme');
    if (saved === 'dark' || saved === 'light' || saved === 'cyberpunk') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const setTheme = (newTheme: 'dark' | 'light' | 'cyberpunk') => {
    setThemeState(newTheme);
    localStorage.setItem('protodocs_theme', newTheme);
  };

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [schema, setSchema] = useState<{ file: any[] }>({ file: [] });
  const [activeFile, setActiveFile] = useState<string>('');
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);

  const registry = useMemo(() => {
    if (!schema.file || schema.file.length === 0) return null;
    try {
      // Clone the schema files to avoid mutating React state directly
      const normalizedFiles = schema.file.map((f) => {
        const cloned = JSON.parse(JSON.stringify(f));
        normalizeFileDescriptor(cloned);
        return cloned;
      });
      const fdSet = {
        $typeName: 'google.protobuf.FileDescriptorSet',
        file: normalizedFiles,
      };
      return createFileRegistry(fdSet as any);
    } catch (e) {
      console.error('Failed to create FileRegistry from schema.file:', e);
      return null;
    }
  }, [schema]);
  const [frontPageMarkdown, setFrontPageMarkdown] = useState<string>('');
  const [footerMarkdown, setFooterMarkdown] = useState<string>('');
  const [sidebarView, setSidebarView] = useState<'files' | 'services'>('files');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState<number>(-1);
  const [isMobileSearchExpanded, setIsMobileSearchExpanded] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [customHeaders, setCustomHeadersState] = useState<{ key: string; value: string }[]>(() => {
    try {
      const saved = localStorage.getItem('protodocs_custom_headers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const setCustomHeaders = (newHeaders: { key: string; value: string }[]) => {
    setCustomHeadersState(newHeaders);
    localStorage.setItem('protodocs_custom_headers', JSON.stringify(newHeaders));
  };
  const [referencePanel, setReferencePanel] = useState<ReferencePanelState | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Build type index for cross-linking
  const typeIndex = useMemo(() => {
    const index: Record<string, { kind: 'message' | 'enum' | 'service' | 'option'; obj: any; file: string; defFqn?: string }> = {};
    schema.file.forEach((f) => {
      const pkgPrefix = f.package ? `.${f.package}.` : '.';

      const addMessage = (m: any, parentFqn: string) => {
        const fqn = `${parentFqn}${m.name}`;
        index[fqn] = { kind: 'message', obj: m, file: f.name };

        m.nestedType?.forEach((nested: any) => {
          addMessage(nested, `${fqn}.`);
        });

        m.enumType?.forEach((e: any) => {
          index[`${fqn}.${e.name}`] = { kind: 'enum', obj: e, file: f.name };
        });
      };

      f.messageType?.forEach((m: any) => {
        addMessage(m, pkgPrefix);
      });
      f.enumType?.forEach((e: any) => {
        index[pkgPrefix + e.name] = { kind: 'enum', obj: e, file: f.name };
      });
      f.service?.forEach((s: any) => {
        index[pkgPrefix + s.name] = { kind: 'service', obj: s, file: f.name };
      });
    });
    populateTypeIndexWithOptions(schema, index);
    return index;
  }, [schema]);

  // Navigate and scroll to an element and update URL Hash
  const goToElement = useCallback((file: string, elementId: string) => {
    setActiveFile(file);
    setActiveTooltip(null);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsMobileSearchExpanded(false);
    setIsSidebarOpen(false);

    // Update location hash
    const newHash = `#/files/${file}?symbol=${elementId}`;
    if (window.location.hash !== newHash) {
      window.location.hash = newHash;
    }

    // Delay to allow file content tab to switch & render
    setTimeout(() => {
      let el = document.getElementById(elementId);
      // Fallback for nested types: find the closest ancestor ID that exists in the DOM
      if (!el) {
        let currentId = elementId;
        while (currentId) {
          const lastDot = currentId.lastIndexOf('.');
          if (lastDot <= 0) break;
          currentId = currentId.substring(0, lastDot);
          el = document.getElementById(currentId);
          if (el) break;
        }
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('highlight-flash');
        void el.offsetWidth; // trigger reflow
        el.classList.add('highlight-flash');
      }
    }, 100);
  }, []);

  // Navigate to symbol definition
  const goToDefinition = (fqn: string) => {
    let info = typeIndex[fqn];
    let targetId = fqn;
    if (!info) {
      // Try resolving parent (e.g. for enum values like .google.api.FieldBehavior.REQUIRED)
      const parts = fqn.split('.');
      if (parts.length > 1) {
        const parentFqn = parts.slice(0, -1).join('.');
        info = typeIndex[parentFqn];
      }
    } else {
      targetId = info.defFqn || fqn;
    }
    if (info) {
      goToElement(info.file, targetId);
    }
  };

  // Find references to a type or option across all files, messages, enums, and services
  const findReferences = (fqn: string) => {
    const results: any[] = [];

    const optionKeysToFind: string[] = [];
    let isOptionSearch = false;

    // Check if fqn matches a standard option: .google.protobuf.xxxOptions.yyy
    const standardOptionMatch = fqn.match(
      /^\.google\.protobuf\.(FileOptions|MessageOptions|FieldOptions|OneofOptions|EnumOptions|EnumValueOptions|ServiceOptions|MethodOptions)\.(.+)$/
    );
    if (standardOptionMatch) {
      isOptionSearch = true;
      const fieldName = standardOptionMatch[2]; // e.g. go_package
      // Convert snake_case to camelCase
      const camelName = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      optionKeysToFind.push(fieldName);
      if (camelName !== fieldName) {
        optionKeysToFind.push(camelName);
      }
    } else {
      // Check if it's a custom option / extension FQN (e.g. .google.api.http)
      const typeInfo = typeIndex[fqn];
      if (typeInfo && typeInfo.kind === 'option') {
        isOptionSearch = true;
        if (fqn.startsWith('.')) {
          const withoutDot = fqn.substring(1);
          optionKeysToFind.push(`[${withoutDot}]`, withoutDot);
        } else {
          optionKeysToFind.push(`[${fqn}]`, fqn);
        }
      }
    }

    if (isOptionSearch) {
      schema.file.forEach((f) => {
        const checkOpts = (opts: any, contextFqn: string, contextType: string, contextLabel: string, parentOptsMsg: string) => {
          if (!opts) return;
          for (const key of optionKeysToFind) {
            if (opts[key] !== undefined) {
              const valStr = formatOptionValue(opts[key], key, parentOptsMsg, typeIndex);
              results.push({
                path: f.name,
                contextFqn,
                text: `option ${formatOptionKey(key)} = ${valStr}; // in ${contextType} ${contextLabel}`,
              });
              break;
            }
          }
        };

        // File options
        if (f.options) {
          checkOpts(f.options, '', 'file', f.name, 'FileOptions');
        }

        const msgFqnPrefix = f.package ? `.${f.package}.` : '.';
        f.messageType?.forEach((m: any) => {
          const msgFqn = msgFqnPrefix + m.name;
          if (m.options) {
            checkOpts(m.options, msgFqn, 'message', m.name, 'MessageOptions');
          }
          m.field?.forEach((field: any) => {
            if (field.options) {
              checkOpts(field.options, msgFqn, 'field', `${m.name}.${field.name}`, 'FieldOptions');
            }
          });
          // Nested enums
          m.enumType?.forEach((e: any) => {
            const enumFqn = `${msgFqn}.${e.name}`;
            if (e.options) {
              checkOpts(e.options, enumFqn, 'enum', `${m.name}.${e.name}`, 'EnumOptions');
            }
            e.value?.forEach((v: any) => {
              if (v.options) {
                checkOpts(v.options, enumFqn, 'enum value', `${m.name}.${e.name}.${v.name}`, 'EnumValueOptions');
              }
            });
          });
          // Recursive message helper (just in case there are deeply nested types)
          const checkNested = (nm: any, parentFqn: string) => {
            const nestedFqn = `${parentFqn}.${nm.name}`;
            if (nm.options) {
              checkOpts(nm.options, nestedFqn, 'nested message', nm.name, 'MessageOptions');
            }
            nm.field?.forEach((field: any) => {
              if (field.options) {
                checkOpts(field.options, nestedFqn, 'field', `${nm.name}.${field.name}`, 'FieldOptions');
              }
            });
            nm.enumType?.forEach((e: any) => {
              const enumFqn = `${nestedFqn}.${e.name}`;
              if (e.options) {
                checkOpts(e.options, enumFqn, 'enum', `${nm.name}.${e.name}`, 'EnumOptions');
              }
              e.value?.forEach((v: any) => {
                if (v.options) {
                  checkOpts(v.options, enumFqn, 'enum value', `${nm.name}.${e.name}.${v.name}`, 'EnumValueOptions');
                }
              });
            });
            nm.nestedType?.forEach((nnm: any) => checkNested(nnm, nestedFqn));
          };
          m.nestedType?.forEach((nm: any) => checkNested(nm, msgFqn));
        });

        f.enumType?.forEach((e: any) => {
          const enumFqn = msgFqnPrefix + e.name;
          if (e.options) {
            checkOpts(e.options, enumFqn, 'enum', e.name, 'EnumOptions');
          }
          e.value?.forEach((v: any) => {
            if (v.options) {
              checkOpts(v.options, enumFqn, 'enum value', `${e.name}.${v.name}`, 'EnumValueOptions');
            }
          });
        });

        f.service?.forEach((s: any) => {
          const svcFqn = msgFqnPrefix + s.name;
          if (s.options) {
            checkOpts(s.options, svcFqn, 'service', s.name, 'ServiceOptions');
          }
          s.method?.forEach((method: any) => {
            if (method.options) {
              checkOpts(method.options, svcFqn, 'rpc method', `${s.name}.${method.name}`, 'MethodOptions');
            }
          });
        });
      });
    } else {
      // Normal type reference search
      schema.file.forEach((f) => {
        const msgFqnPrefix = f.package ? `.${f.package}.` : '.';
        f.messageType?.forEach((m: any) => {
          const msgFqn = msgFqnPrefix + m.name;
          m.field?.forEach((field: any) => {
            if (field.typeName === fqn) {
              results.push({
                path: f.name,
                contextFqn: msgFqn,
                text: `message ${m.name} { ... ${field.name} = ${field.number}; }`,
              });
            }
          });
        });
        f.service?.forEach((s: any) => {
          const svcFqn = msgFqnPrefix + s.name;
          s.method?.forEach((method: any) => {
            if (method.inputType === fqn || method.outputType === fqn) {
              const streamingText = method.clientStreaming ? 'stream ' : '';
              const returnStreamingText = method.serverStreaming ? 'stream ' : '';
              results.push({
                path: f.name,
                contextFqn: svcFqn,
                text: `rpc ${method.name}(${streamingText}${fqn.split('.').pop()}) returns (${returnStreamingText}${method.outputType.split('.').pop()});`,
              });
            }
          });
        });
      });
    }

    setReferencePanel({ token: fqn, results });
    setActiveTooltip(null);
  };

  // Load the schema based on configured method
  const loadSchema = async (targetConfig: AppConfig) => {
    setLoading(true);
    setError(null);
    try {
      let loadedSchema;
      if (targetConfig.loadingMethod === 'http') {
        loadedSchema = await loadDescriptorsFromUrls(targetConfig.descriptorFiles);
      } else {
        loadedSchema = await loadSchemaFromReflection(targetConfig.reflectionUrl, targetConfig.loadingMethod);
      }
      
      setSchema(loadedSchema);
      
      if (loadedSchema.file && loadedSchema.file.length > 0) {
        // Apply routing from initial hash if available
        const { filepath, symbol } = parseHash(window.location.hash);
        if (filepath && loadedSchema.file.some((f: any) => f.name === filepath)) {
          setActiveFile(filepath);
          if (symbol) {
            setTimeout(() => {
              const el = document.getElementById(symbol);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('highlight-flash');
              }
            }, 200);
          }
        } else if (targetConfig.defaultFile && loadedSchema.file.some((f: any) => f.name === targetConfig.defaultFile)) {
          setActiveFile(targetConfig.defaultFile);
        } else {
          setActiveFile('');
        }
      }
    } catch (err: any) {
      console.error('Error loading schema:', err);
      setError(err?.message || 'Failed to load Proto schema.');
      setSchema({ file: [] });
    } finally {
      setLoading(false);
    }
  };

  // Load config and initial schema on start
  useEffect(() => {
    document.body.classList.remove('loading');

    const initializeConfig = async () => {
      let activeConfig = { ...DEFAULT_CONFIG };

      // 1. Try LocalStorage
      const saved = localStorage.getItem('protodocs_config');
      if (saved) {
        try {
          activeConfig = JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved config from localStorage', e);
        }
      } else {
        // 2. Try URL Search Params
        const params = new URLSearchParams(window.location.search);
        const method = params.get('method');
        const url = params.get('url') || params.get('serverUrl') || params.get('reflectionUrl');
        const descriptors = params.get('descriptors');
        const logoText = params.get('logoText');
        const logoUrl = params.get('logoUrl');

        if (method === 'grpc-web' || method === 'connect' || url) {
          activeConfig.loadingMethod = (method as any) || activeConfig.loadingMethod;
          activeConfig.reflectionUrl = url || activeConfig.reflectionUrl;
        } else if (method === 'http' || descriptors) {
          activeConfig.loadingMethod = 'http';
          activeConfig.descriptorFiles = descriptors
            ? descriptors.split(',').map((d) => d.trim())
            : activeConfig.descriptorFiles;
        }

        if (logoText) activeConfig.logoText = logoText;
        if (logoUrl) activeConfig.logoUrl = logoUrl;

        // 3. Fallback to config.json
        if (!method && !descriptors) {
          try {
            const res = await fetch('/config.json');
            if (res.ok) {
              const fileConfig = await res.json();
              if (fileConfig.descriptor_files) {
                activeConfig.loadingMethod = 'http';
                activeConfig.descriptorFiles = fileConfig.descriptor_files;
              }
              if (fileConfig.title) {
                activeConfig.logoText = fileConfig.title;
              }
              if (fileConfig.default_file) {
                activeConfig.defaultFile = fileConfig.default_file;
              }
              if (fileConfig.front_page_markdown_file) {
                activeConfig.frontPageMarkdownFile = fileConfig.front_page_markdown_file;
              }
              if (fileConfig.bottom_of_front_page_markdown_file) {
                activeConfig.bottomOfFrontPageMarkdownFile = fileConfig.bottom_of_front_page_markdown_file;
              }
              if (fileConfig.server_url) {
                activeConfig.reflectionUrl = fileConfig.server_url;
              } else if (fileConfig.reflection_url) {
                activeConfig.reflectionUrl = fileConfig.reflection_url;
              }
              if (fileConfig.service_endpoints) {
                activeConfig.serviceEndpoints = fileConfig.service_endpoints;
              }
            }
          } catch (e) {
            console.warn('config.json not found or failed to parse, using defaults.', e);
          }
        }
      }

      setConfig(activeConfig);
      loadSchema(activeConfig);
    };

    initializeConfig();
  }, []);

  // Listen to hash change for back/forward browser navigation
  useEffect(() => {
    const handleHashChange = () => {
      const { filepath, symbol } = parseHash(window.location.hash);
      if (filepath && schema.file.some((f) => f.name === filepath)) {
        if (symbol) {
          goToElement(filepath, symbol);
        } else {
          setActiveFile(filepath);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [schema, goToElement]);

  // Update document title dynamically based on active file and logo text
  useEffect(() => {
    const baseTitle = config.logoText || 'ProtoDocs';
    if (activeFile) {
      const filename = activeFile.split('/').pop() || activeFile;
      document.title = `${filename} | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [activeFile, config.logoText]);

  // Update hash when active file changes manually
  useEffect(() => {
    if (!activeFile) return;
    const { filepath } = parseHash(window.location.hash);
    if (filepath !== activeFile) {
      window.location.hash = `#/files/${activeFile}`;
    }
  }, [activeFile]);

  // Close unpinned tooltips and download dropdown when clicking around
  useEffect(() => {
    const handleClick = () => {
      setActiveTooltip(null);
      setIsDownloadOpen(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Reset search selection index when query changes
  useEffect(() => {
    setSearchSelectedIndex(-1);
  }, [searchQuery, isSearchOpen]);

  // Apply theme class to document element on theme change
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light', 'theme-cyberpunk');
    const targetThemeClass = theme === 'dark' ? 'theme-dark' : `theme-${theme}`;
    root.classList.add(targetThemeClass);
  }, [theme]);

  // Listen to system theme changes dynamically if no user selection exists
  useEffect(() => {
    const saved = localStorage.getItem('protodocs_theme');
    if (saved) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('protodocs_theme')) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  // Scroll active search item into view
  useEffect(() => {
    if (searchSelectedIndex >= 0) {
      const el = document.getElementById('search-result-selected');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [searchSelectedIndex]);

  // Group and sort services alphabetically
  const parsedServices = useMemo(() => {
    const groups: Record<string, any[]> = {};
    schema.file.forEach((f) => {
      if (f.service && f.service.length > 0) {
        const pkg = f.package || 'unnamed';
        if (!groups[pkg]) groups[pkg] = [];
        f.service.forEach((s: any) => groups[pkg].push({ ...s, file: f.name }));
      }
    });

    // Sort services within each package alphabetically
    Object.keys(groups).forEach((pkg) => {
      groups[pkg].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [schema]);

  // Search Results matcher (limit to 10 results)
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    const results: any[] = [];
    
    Object.entries(typeIndex).forEach(([fqn, info]) => {
      if (fqn.toLowerCase().includes(q)) {
        results.push({
          kind: 'type',
          name: fqn.replace(/^\./, ''),
          file: info.file,
          fqn,
        });
      }
    });

    schema.file.forEach((f) => {
      if (f.name.toLowerCase().includes(q)) {
        results.push({ kind: 'file', name: f.name, file: f.name });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, schema, typeIndex]);

  // Tooltip interaction handlers
  const handlePinClick = (e: React.MouseEvent, fqn: string, description: any, category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value', shortName: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    let hasDefinition = !!typeIndex[fqn];
    if (!hasDefinition) {
      const parts = fqn.split('.');
      if (parts.length > 1) {
        const parentFqn = parts.slice(0, -1).join('.');
        hasDefinition = !!typeIndex[parentFqn];
      }
    }
    setActiveTooltip({
      x: rect.left,
      y: rect.bottom + window.scrollY + 6,
      fqn,
      description,
      category,
      shortName,
      isPinned: true,
      hasDefinition,
    });
  };

  const handleMouseEnter = (e: React.MouseEvent, fqn: string, description: any, category: 'primitive' | 'wkt' | 'custom' | 'option' | 'enum_value', shortName: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let hasDefinition = !!typeIndex[fqn];
    if (!hasDefinition) {
      const parts = fqn.split('.');
      if (parts.length > 1) {
        const parentFqn = parts.slice(0, -1).join('.');
        hasDefinition = !!typeIndex[parentFqn];
      }
    }
    setActiveTooltip((prev) => {
      if (prev && prev.isPinned) return prev;
      return {
        x: rect.left,
        y: rect.bottom + window.scrollY + 6,
        fqn,
        description,
        category,
        shortName,
        isPinned: false,
        hasDefinition,
      };
    });
  };

  const handleMouseLeave = () => {
    setActiveTooltip((prev) => (prev && prev.isPinned ? prev : null));
  };

  // Keyboard navigation for search dropdown
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchOpen || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchSelectedIndex >= 0 && searchSelectedIndex < searchResults.length) {
        const res = searchResults[searchSelectedIndex];
        if (res.fqn) {
          goToElement(res.file, res.fqn);
        } else {
          setActiveFile(res.file);
          setIsSearchOpen(false);
          setSearchQuery('');
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  // Fetch front page and footer markdown content
  useEffect(() => {
    if (config.frontPageMarkdownFile) {
      fetch(config.frontPageMarkdownFile)
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => setFrontPageMarkdown(text))
        .catch((err) => console.warn('Failed to load front page markdown:', err));
    } else {
      setFrontPageMarkdown('');
    }
  }, [config.frontPageMarkdownFile]);

  useEffect(() => {
    if (config.bottomOfFrontPageMarkdownFile) {
      fetch(config.bottomOfFrontPageMarkdownFile)
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => setFooterMarkdown(text))
        .catch((err) => console.warn('Failed to load footer markdown:', err));
    } else {
      setFooterMarkdown('');
    }
  }, [config.bottomOfFrontPageMarkdownFile]);

  const currentFileObj = schema.file.find((f) => f.name === activeFile);

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadProto = () => {
    if (!currentFileObj) return;
    const protoContent = reconstructProto(currentFileObj, typeIndex);
    const filename = activeFile.split('/').pop() || 'file.proto';
    downloadFile(protoContent, filename, 'text/plain');
    setIsDownloadOpen(false);
  };

  const handleDownloadDescriptorJson = () => {
    if (!currentFileObj) return;
    const jsonContent = JSON.stringify(currentFileObj, null, 2);
    const filename = (activeFile.split('/').pop() || 'file.proto') + '.json';
    downloadFile(jsonContent, filename, 'application/json');
    setIsDownloadOpen(false);
  };

  const handleDownloadDescriptorSetJson = () => {
    const jsonContent = JSON.stringify(schema, null, 2);
    downloadFile(jsonContent, 'descriptor_set.json', 'application/json');
    setIsDownloadOpen(false);
  };

  const extensionGroups = useMemo(() => {
    if (!currentFileObj || !currentFileObj.extension) return {};
    const groups: Record<string, any[]> = {};
    currentFileObj.extension.forEach((ext: any) => {
      const key = ext.extendee;
      if (!groups[key]) groups[key] = [];
      groups[key].push(ext);
    });
    return groups;
  }, [currentFileObj]);

  const themeClass = theme === 'dark' ? 'theme-dark' : `theme-${theme}`;

  return (
    <div className={`flex h-screen w-screen bg-app-base text-app-textMain font-sans overflow-hidden transition-colors duration-200 ${themeClass}`}>
      
      {/* Sidebar backdrop on mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-35 md:hidden transition-opacity duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar with grouped directories and popup theme selector */}
      <Sidebar
        logoUrl={config.logoUrl}
        logoText={config.logoText}
        sidebarView={sidebarView}
        setSidebarView={setSidebarView}
        schema={schema}
        activeFile={activeFile}
        setActiveFile={setActiveFile}
        parsedServices={parsedServices}
        onGoToElement={goToElement}
        loading={loading}
        error={error}
        theme={theme}
        setTheme={setTheme}
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
      />

      {/* Main Container - Size is fully constrained and fixed to flex flow */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        
        {/* Top Navbar */}
        <div className="h-14 border-b border-app-border flex items-center px-6 justify-between bg-app-base z-10 transition-colors duration-200 shrink-0">
          <div className="min-w-0 flex-1 flex items-center gap-3 mr-4 text-xs text-app-textMuted truncate font-mono select-text">
            {/* Hamburger Button for mobile/small screen sidebar toggle */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors"
              title="Open Sidebar"
            >
              <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 flex items-center truncate">
              {activeFile.split('/').map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span className={i === arr.length - 1 ? 'text-app-textBright font-semibold truncate' : 'truncate'}>
                    {part}
                  </span>
                  {i < arr.length - 1 && <span className="mx-2 text-app-textMuted/45">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Search container */}
          <div className="shrink-0 flex items-center gap-4">
            {activeFile && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDownloadOpen(!isDownloadOpen);
                  }}
                  className={`flex items-center gap-1.5 bg-app-panel border border-app-border rounded-lg px-3 py-1.5 text-xs text-app-textMuted hover:text-app-textBright cursor-pointer select-none transition-colors ${
                    isDownloadOpen ? 'bg-app-hoverBg text-app-textBright border-app-accent/80' : ''
                  }`}
                >
                  <svg className="w-4 h-4 text-app-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download</span>
                  <svg className={`w-3.5 h-3.5 text-app-textMuted transition-transform duration-200 ${isDownloadOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isDownloadOpen && (
                  <div className="absolute top-full mt-2 right-0 w-64 bg-app-panel border border-app-border rounded-lg shadow-2xl overflow-hidden z-30 select-none py-1 divide-y divide-app-border/40">
                    <button
                      type="button"
                      onClick={handleDownloadProto}
                      className="w-full text-left px-4 py-2.5 text-xs text-app-textBright hover:bg-app-hoverBg transition-colors flex flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-semibold">Protobuf file (.proto)</span>
                      <span className="text-[10px] text-app-textMuted font-normal leading-normal">Reconstructed proto source text</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadDescriptorJson}
                      className="w-full text-left px-4 py-2.5 text-xs text-app-textBright hover:bg-app-hoverBg transition-colors flex flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-semibold">File Descriptor (JSON)</span>
                      <span className="text-[10px] text-app-textMuted font-normal leading-normal">Descriptor schema metadata for this file</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadDescriptorSetJson}
                      className="w-full text-left px-4 py-2.5 text-xs text-app-textBright hover:bg-app-hoverBg transition-colors flex flex-col gap-0.5 cursor-pointer"
                    >
                      <span className="font-semibold">Descriptor Set (JSON)</span>
                      <span className="text-[10px] text-app-textMuted font-normal leading-normal">Combined schema metadata for all files</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile Search Trigger Icon */}
            {!isMobileSearchExpanded && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchExpanded(true);
                  setIsSearchOpen(true);
                  setTimeout(() => {
                    const el = document.getElementById('navbar-search-input');
                    if (el) (el as HTMLInputElement).focus();
                  }, 50);
                }}
                className="flex lg:hidden text-app-textMuted hover:text-app-textBright p-2 rounded-lg hover:bg-app-hoverBg transition-all cursor-pointer"
                title="Search"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}

            {/* Search Input Container */}
            <div className={`${isMobileSearchExpanded ? 'absolute inset-x-4 top-2.5 z-40 flex items-center gap-2 bg-app-base lg:relative lg:inset-auto lg:top-auto lg:bg-transparent' : 'hidden lg:relative lg:flex'}`}>
              <div className="flex items-center bg-app-panel border border-app-border rounded-lg px-3 py-1.5 w-full lg:w-64 focus-within:border-app-accent focus-within:ring-1 focus-within:ring-app-accent transition-all duration-200">
                <svg className="w-4 h-4 text-app-textMuted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="navbar-search-input"
                  type="text"
                  placeholder="Search types or files..."
                  className="bg-transparent border-none outline-none text-xs ml-2 w-full text-app-textBright placeholder-app-textMuted/60"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                />
                {isMobileSearchExpanded && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileSearchExpanded(false);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="text-app-textMuted hover:text-app-textBright ml-2 shrink-0 lg:hidden cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {isSearchOpen && searchQuery && (
                <div className="absolute top-full mt-2 right-0 w-80 bg-app-panel border border-app-border rounded-lg shadow-2xl overflow-hidden z-30 select-none">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-xs text-app-textMuted text-center">No results found</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-app-border/40">
                      {searchResults.map((res, i) => (
                        <div
                          key={i}
                          id={searchSelectedIndex === i ? 'search-result-selected' : undefined}
                          onClick={() => {
                            if (res.fqn) {
                              goToElement(res.file, res.fqn);
                            } else {
                              setActiveFile(res.file);
                              setIsSearchOpen(false);
                              setIsMobileSearchExpanded(false);
                              setSearchQuery('');
                            }
                          }}
                          className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                            searchSelectedIndex === i ? 'bg-app-accentBg' : 'hover:bg-app-hoverBg'
                          }`}
                        >
                          <div className="text-app-textMuted mr-3 shrink-0">
                            {res.kind === 'type' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-semibold text-app-textBright truncate">{res.name}</div>
                            <div className="text-[10px] text-app-textMuted truncate font-mono mt-0.5">{res.file}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Area - Fixed width & overflow-x-hidden ensures no horizontal stretching */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 bg-app-code transition-colors duration-200 relative select-text w-full">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-app-code z-10 text-app-textMuted font-mono">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent"></div>
                <span className="text-sm">Fetching and indexing Schema descriptors...</span>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto w-full">
            {!activeFile || activeFile === '' ? (
              <div className="py-8 select-text w-full max-w-4xl mx-auto">
                {frontPageMarkdown ? (
                  <div className="prose dark:prose-invert max-w-none text-app-textMain">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {frontPageMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-20 text-app-textMuted font-mono">
                    <h2 className="text-2xl font-bold text-app-textBright mb-4">Welcome to ProtoDocs</h2>
                    <p className="text-sm">Select a file or service in the sidebar to start browsing the schema documentation.</p>
                  </div>
                )}

                {footerMarkdown && (
                  <div className="mt-12 pt-8 border-t border-app-border/40 prose dark:prose-invert max-w-none text-xs text-app-textMuted/60">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {footerMarkdown}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            ) : (
              currentFileObj && (
                <>
                  {/* File Header metadata */}
                  <div className="mb-8 border-b border-app-border pb-4 font-mono text-xs text-app-textMuted space-y-1.5 select-text w-full overflow-x-auto hide-scrollbar">
                    {getEditionString(currentFileObj.edition) ? (
                      <div>
                        <span className="text-syn-keyword">edition</span> ={' '}
                        <span className="text-syn-string">"{getEditionString(currentFileObj.edition)}"</span>;
                      </div>
                    ) : (
                      <div>
                        <span className="text-syn-keyword">syntax</span> ={' '}
                        <span className="text-syn-string">"{currentFileObj.syntax || 'proto3'}"</span>;
                      </div>
                    )}
                    {currentFileObj.package && (
                      <div>
                        <span className="text-syn-keyword">package</span>{' '}
                        <span className="text-app-textMain">{currentFileObj.package}</span>;
                      </div>
                    )}
                    {currentFileObj.dependency?.map((dep: string) => (
                      <div
                        key={dep}
                        className="cursor-pointer hover:text-app-textBright group transition-colors whitespace-pre-wrap"
                        onClick={() => {
                          if (schema.file.some((f) => f.name === dep)) {
                            setActiveFile(dep);
                          }
                        }}
                      >
                        <span className="text-syn-keyword">import</span>{' '}
                        <span className="text-syn-string">"{dep}"</span>;
                      </div>
                    ))}
                    {currentFileObj.options &&
                      Object.entries(currentFileObj.options)
                        .filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption')
                        .map(([k, v]) => (
                          <div key={k}>
                            <span className="text-syn-keyword">option</span>{' '}
                            <OptionLink
                              optionKey={k}
                              parentOptionsMessage="FileOptions"
                              typeIndex={typeIndex}
                              onMouseEnter={handleMouseEnter}
                              onMouseLeave={handleMouseLeave}
                              onPinClick={handlePinClick}
                            /> ={' '}
                            <span className="text-syn-string">{formatOptionValue(v, k, 'FileOptions', typeIndex)}</span>;
                          </div>
                        ))}
                  </div>

                  {/* Viewers */}
                  {currentFileObj.service?.map((svc: any) => (
                    <ServiceViewer
                      key={svc.name}
                      service={svc}
                      file={currentFileObj}
                      typeIndex={typeIndex}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onPinClick={handlePinClick}
                      registry={registry}
                      config={config}
                      customHeaders={customHeaders}
                      setCustomHeaders={setCustomHeaders}
                    />
                  ))}

                  {currentFileObj.messageType?.map((msg: any) => (
                    <MessageViewer
                      key={msg.name}
                      message={msg}
                      file={currentFileObj}
                      typeIndex={typeIndex}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onPinClick={handlePinClick}
                    />
                  ))}

                  {currentFileObj.enumType?.map((enm: any) => (
                    <EnumViewer
                      key={enm.name}
                      enumObj={enm}
                      file={currentFileObj}
                      typeIndex={typeIndex}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onPinClick={handlePinClick}
                    />
                  ))}

                  {Object.entries(extensionGroups).map(([extendee, fields]) => (
                    <ExtensionGroupViewer
                      key={extendee}
                      extendee={extendee}
                      fields={fields}
                      parentFqn={currentFileObj.package ? `.${currentFileObj.package}` : ''}
                      typeIndex={typeIndex}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                      onPinClick={handlePinClick}
                    />
                  ))}
                </>
              )
            )}
          </div>
        </div>

        {/* Reference Panel Drawer */}
        <ReferencePanel
          state={referencePanel}
          onClose={() => setReferencePanel(null)}
          onReferenceClick={goToElement}
        />

      </div>

      {/* Rich Tooltip Overlay */}
      <Tooltip
        activeTooltip={activeTooltip}
        onClose={() => setActiveTooltip(null)}
        onGoToDefinition={goToDefinition}
        onFindReferences={findReferences}
      />

    </div>
  );
}
