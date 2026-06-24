import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { createFileRegistry, fromJson } from '@bufbuild/protobuf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import YAML from 'yaml';
import { loadDescriptorsFromUrls, loadDescriptorsFromBytesList } from './lib/descriptor-loader';
import { loadBsrDescriptorBytes } from './lib/bsr-loader';
import UploadZone from './components/UploadZone';
import { loadSchemaFromReflection } from './lib/reflection-client';
import { checkProxyAvailable, resolveUrl, setDesktopProxyUrl } from './lib/proxy';
import type { TooltipState } from './components/Tooltip';
import type { ReferencePanelState } from './components/ReferencePanel';
import { formatOptionKey, formatOptionValue } from './lib/options-formatter-helpers';
import OptionLink from './components/OptionLink';
import ExternalLink from './components/ExternalLink';
import { populateTypeIndexWithOptions, normalizeFileDescriptor } from './lib/option-resolver';
import { reconstructProto, getEditionString, cleanComment } from './lib/proto-reconstructor';
import KeywordLink from './components/KeywordLink';
import { ConfigSchema } from './gen/protodocs/v1/config_pb';
import { safeHttpUrl } from './lib/safe-url';
import { getActiveLogoUrl } from './lib/logo';

const Sidebar = lazy(() => import('./components/Sidebar'));
const Tooltip = lazy(() => import('./components/Tooltip'));
const ReferencePanel = lazy(() => import('./components/ReferencePanel'));
const ServiceViewer = lazy(() => import('./components/ServiceViewer'));
const MessageViewer = lazy(() => import('./components/MessageViewer'));
const EnumViewer = lazy(() => import('./components/EnumViewer'));
const ExtensionGroupViewer = lazy(() => import('./components/ExtensionGroupViewer'));
const QuickBrowse = lazy(() => import('./components/QuickBrowse'));
const Minimap = lazy(() => import('./components/Minimap'));
const APP_VERSION = __PROTODOCS_VERSION__;

interface AppConfig {
  loadingMethod: 'http' | 'grpc-web' | 'connect' | 'grpc';
  descriptorFiles: string[];
  reflectionUrl: string;
  logoUrl: string;
  logoUrlLight?: string;
  logoUrlDark?: string;
  logoUrlCyberpunk?: string;
  logoText: string;
  frontPageSections?: FrontPageSectionConfig[];
  serviceEndpoints?: Record<string, string | string[]>;
  prioritizedPaths?: string[];
  highlightedFiles?: string[];
  backToText?: string;
  backToUrl?: string;
  proxy?: boolean;
  defaultTab?: 'files' | 'services';
  protocols?: string[];
}

interface FrontPageSectionConfig {
  type: 'markdown' | 'markdown-small' | 'descriptor-stats-panel' | 'service-list-panel';
  markdown?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  loadingMethod: 'http',
  descriptorFiles: [],
  reflectionUrl: 'https://demo.connectrpc.com',
  logoUrl: '',
  logoText: 'ProtoDocs',
  frontPageSections: [],
  defaultTab: 'services',
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

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && !!(window as any).go?.main?.App);

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [schema, setSchema] = useState<{ file: any[] }>({ file: [] });
  const [isSchemaLoaderOpen, setIsSchemaLoaderOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<string>('');
  const [isDownloadOpen, setIsDownloadOpen] = useState<boolean>(false);
  const [isQuickBrowseOpen, setIsQuickBrowseOpen] = useState<boolean>(false);

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
  const [sidebarView, setSidebarView] = useState<'files' | 'services'>('files');
  const [expandedDecoderFqn, setExpandedDecoderFqn] = useState<string | null>(null);
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
  const [loading, setLoading] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const contentAreaRef = useRef<HTMLElement>(null);

  // Build type index for cross-linking
  const typeIndex = useMemo(() => {
    const index: Record<string, { kind: 'message' | 'enum' | 'service' | 'option'; obj: any; file: string; defFqn?: string }> = {};
    schema.file.forEach((f) => {
      const pkgPrefix = f.package ? `.${f.package}.` : '.';

      const addMessage = (m: any, parentFqn: string) => {
        const fqn = `${parentFqn}${m.name}`;
        index[fqn] = { kind: 'message', obj: m, file: f.name };

        m.field?.forEach((fld: any) => {
          const fieldFqn = `${fqn}.${fld.name}`;
          index[fieldFqn] = { kind: 'option', obj: fld, file: f.name };
        });

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
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleOpenDecoder = useCallback((fqn: string | null) => {
    setExpandedDecoderFqn(fqn);
    if (fqn) {
      const info = typeIndex[fqn];
      if (info && info.file) {
        goToElement(info.file, fqn);
      }
    }
  }, [typeIndex, goToElement]);

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
  const loadSchema = useCallback(async (targetConfig: AppConfig) => {
    setLoading(true);
    setError(null);
    try {
      let loadedSchema;
      if (targetConfig.loadingMethod === 'http') {
        if (!targetConfig.descriptorFiles || targetConfig.descriptorFiles.length === 0) {
          loadedSchema = { file: [] };
        } else {
          loadedSchema = await loadDescriptorsFromUrls(targetConfig.descriptorFiles);
        }
      } else {
        loadedSchema = await loadSchemaFromReflection(targetConfig.reflectionUrl, targetConfig.loadingMethod);
      }

      setSchema(loadedSchema);
      setIsSchemaLoaderOpen(false);

      // Focus tab based on config (or default to services if > 0 count of services)
      let totalServices = 0;
      if (loadedSchema.file) {
        loadedSchema.file.forEach((f: any) => {
          if (f.service && f.service.length > 0) {
            totalServices += f.service.length;
          }
        });
      }
      const preferredTab = targetConfig.defaultTab || 'services';
      if (preferredTab === 'services' && totalServices > 0) {
        setSidebarView('services');
      } else {
        setSidebarView('files');
      }

      if (loadedSchema.file && loadedSchema.file.length > 0) {
        // Apply routing from initial hash if available
        const { filepath, symbol } = parseHash(window.location.hash);
        if (filepath && loadedSchema.file.some((f: any) => f.name === filepath)) {
          setActiveFile(filepath);
          if (symbol) {
            setTimeout(() => {
              const el = document.getElementById(symbol);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.classList.add('highlight-flash');
              }
            }, 200);
          }
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
      document.body.classList.remove('loading');
    }
  }, []);

  const handleFilesUploaded = useCallback(async (files: File[]) => {
    setLoading(true);
    setError(null);
    try {
      const bytesList: Uint8Array[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        bytesList.push(new Uint8Array(buffer));
      }
      const loadedSchema = await loadDescriptorsFromBytesList(bytesList);
      setSchema(loadedSchema);
      setIsSchemaLoaderOpen(false);
      
      if (loadedSchema.file && loadedSchema.file.length > 0) {
        let totalServices = 0;
        loadedSchema.file.forEach((f: any) => {
          if (f.service && f.service.length > 0) {
            totalServices += f.service.length;
          }
        });
        if (totalServices > 0) {
          setSidebarView('services');
        } else {
          setSidebarView('files');
        }
        setActiveFile('');
      }
    } catch (err: any) {
      console.error('Error loading uploaded descriptors:', err);
      setError(err?.message || 'Failed to parse descriptor files. Ensure they are valid binary FileDescriptorSet files.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnectReflection = useCallback(async (url: string, method: 'connect' | 'grpc-web' | 'grpc') => {
    const newConfig: AppConfig = {
      ...config,
      loadingMethod: method,
      reflectionUrl: url,
      descriptorFiles: [],
    };
    setConfig(newConfig);
    await loadSchema(newConfig);
  }, [config, loadSchema]);

  const handleLoadBsr = useCallback(async (module: string, ref: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const bytes = await loadBsrDescriptorBytes({
        module,
        ref,
        token,
        sourceInfo: true,
      });
      const loadedSchema = await loadDescriptorsFromBytesList([bytes]);
      setSchema(loadedSchema);
      setIsSchemaLoaderOpen(false);

      let totalServices = 0;
      if (loadedSchema.file) {
        loadedSchema.file.forEach((f: any) => {
          if (f.service && f.service.length > 0) {
            totalServices += f.service.length;
          }
        });
      }
      setSidebarView(totalServices > 0 ? 'services' : 'files');
      setActiveFile('');
    } catch (err: any) {
      console.error('Error loading BSR descriptor:', err);
      setError(err?.message || 'Failed to load BSR module.');
      setSchema({ file: [] });
    } finally {
      setLoading(false);
      document.body.classList.remove('loading');
    }
  }, []);

  const handleLoadDemo = useCallback(async () => {
    const demoConfig: AppConfig = {
      ...config,
      loadingMethod: 'http',
      descriptorFiles: ['/eliza.binpb'],
      serviceEndpoints: {
        ...config.serviceEndpoints,
        'connectrpc.eliza.v1.ElizaService': ['https://demo.connectrpc.com'],
      },
    };
    setConfig(demoConfig);
    await loadSchema(demoConfig);
  }, [config, loadSchema]);

  const handleOpenSchemaLoader = useCallback(() => {
    setIsSchemaLoaderOpen(true);
    setError(null);
  }, []);

  const handleCloseSchemaLoader = useCallback(() => {
    setIsSchemaLoaderOpen(false);
    setError(null);
  }, []);

  const loadAssociatedFile = useCallback(async (filePath: string) => {
    const wailsApp = (window as any).go?.main?.App;
    if (!wailsApp || typeof wailsApp.ReadFileBytes !== 'function') return;

    const normalizedPath = filePath.startsWith('file://')
      ? decodeURIComponent(filePath.replace(/^file:\/\/+/, '/'))
      : decodeURIComponent(filePath);

    setLoading(true);
    setError(null);
    try {
      const bytes = await wailsApp.ReadFileBytes(normalizedPath);
      const loadedSchema = await loadDescriptorsFromBytesList([new Uint8Array(bytes)]);
      setSchema(loadedSchema);
      setIsSchemaLoaderOpen(false);
      setSidebarView('files');
      setActiveFile('');
    } catch (err: any) {
      console.error('Error loading associated file:', err);
      setError(err?.message || `Failed to load associated file: ${normalizedPath}`);
    } finally {
      setLoading(false);
      document.body.classList.remove('loading');
    }
  }, []);

  // Listen to file open events from Wails (for double-clicking files while app is running)
  useEffect(() => {
    const runtime = (window as any).runtime;
    if (runtime && typeof runtime.EventsOn === 'function') {
      runtime.EventsOn('open-file', (filePath: string) => {
        loadAssociatedFile(filePath);
      });
      return () => {
        if (typeof runtime.EventsOff === 'function') {
          runtime.EventsOff('open-file');
        }
      };
    }
  }, [loadAssociatedFile]);

  // Set up global window drag/drop listeners for descriptor files
  useEffect(() => {
    if (!isDesktop) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const filesArray = Array.from(e.dataTransfer.files);
        await handleFilesUploaded(filesArray);
      }
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFilesUploaded, isDesktop]);

  // Load config and initial schema on start
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        const activeConfig = { ...DEFAULT_CONFIG };

        // 0. Check if running inside Wails desktop wrapper
        const getWailsProxy = async (): Promise<string | null> => {
          const checkWails = () => (window as any).go?.main?.App;
          if (checkWails() && typeof checkWails().GetProxyUrl === 'function') {
            return checkWails().GetProxyUrl();
          }
          return new Promise((resolve) => {
            let attempts = 0;
            const interval = setInterval(async () => {
              attempts++;
              const wailsApp = checkWails();
              if (wailsApp && typeof wailsApp.GetProxyUrl === 'function') {
                clearInterval(interval);
                resolve(await wailsApp.GetProxyUrl());
              } else if (attempts > 50) { // 500ms max wait
                clearInterval(interval);
                resolve(null);
              }
            }, 10);
          });
        };

        const proxyUrl = await getWailsProxy();
        const localIsDesktop = !!(window as any).go?.main?.App;
        if (localIsDesktop) {
          setIsDesktop(true);
        }
        if (proxyUrl) {
          setDesktopProxyUrl(proxyUrl);
          activeConfig.proxy = true;
        }

        // 1. Fetch config.yaml first as the base config
        try {
          const res = await fetch(resolveUrl('/config.yaml?t=' + new Date().getTime()));
          if (res.ok) {
            const yamlText = await res.text();
            const yamlObj = YAML.parse(yamlText);
            const pbConfig = fromJson(ConfigSchema, yamlObj, { ignoreUnknownFields: true });
            
            if (pbConfig.descriptorFiles && pbConfig.descriptorFiles.length > 0 && !localIsDesktop) {
              activeConfig.loadingMethod = 'http';
              activeConfig.descriptorFiles = pbConfig.descriptorFiles;
            }
            if (pbConfig.title) {
              activeConfig.logoText = pbConfig.title;
            }
            if (pbConfig.logoText) {
              activeConfig.logoText = pbConfig.logoText;
            }
            if (pbConfig.logoUrl) {
              activeConfig.logoUrl = pbConfig.logoUrl;
            }
            if (pbConfig.logoUrlLight) {
              activeConfig.logoUrlLight = pbConfig.logoUrlLight;
            }
            if (pbConfig.logoUrlDark) {
              activeConfig.logoUrlDark = pbConfig.logoUrlDark;
            }
            if (pbConfig.logoUrlCyberpunk) {
              activeConfig.logoUrlCyberpunk = pbConfig.logoUrlCyberpunk;
            }
            if (pbConfig.frontPageSections && pbConfig.frontPageSections.length > 0) {
              activeConfig.frontPageSections = pbConfig.frontPageSections
                .filter((section) =>
                  section.type === 'markdown'
                  || section.type === 'markdown-small'
                  || section.type === 'descriptor-stats-panel'
                  || section.type === 'service-list-panel'
                )
                .map((section) => ({
                  type: section.type as FrontPageSectionConfig['type'],
                  markdown: section.markdown,
                }));
            }
            if (pbConfig.serverUrl) {
              activeConfig.reflectionUrl = pbConfig.serverUrl;
            } else if (pbConfig.reflectionUrl) {
              activeConfig.reflectionUrl = pbConfig.reflectionUrl;
            }
            if (pbConfig.serviceEndpoints && Object.keys(pbConfig.serviceEndpoints).length > 0) {
              const converted: Record<string, string[]> = {};
              for (const [key, val] of Object.entries(pbConfig.serviceEndpoints)) {
                if (val && val.endpoints) {
                  converted[key] = val.endpoints;
                }
              }
              activeConfig.serviceEndpoints = converted;
            }
            if (pbConfig.prioritizedPaths && pbConfig.prioritizedPaths.length > 0) {
              activeConfig.prioritizedPaths = pbConfig.prioritizedPaths;
            }
            if (pbConfig.highlightedFiles && pbConfig.highlightedFiles.length > 0) {
              activeConfig.highlightedFiles = pbConfig.highlightedFiles;
            }
            if (pbConfig.backToText) {
              activeConfig.backToText = pbConfig.backToText;
            }
            if (pbConfig.backToUrl) {
              activeConfig.backToUrl = pbConfig.backToUrl;
            }
            if (pbConfig.defaultTab) {
              activeConfig.defaultTab = pbConfig.defaultTab as any;
            }
            if (pbConfig.proxy !== undefined) {
              activeConfig.proxy = pbConfig.proxy;
              if (pbConfig.proxy) {
                await checkProxyAvailable();
              }
            }
            if (pbConfig.protocols && pbConfig.protocols.length > 0) {
              activeConfig.protocols = pbConfig.protocols;
            }
          }
        } catch (e) {
          console.warn('config.yaml not found or failed to parse, using defaults.', e);
        }

        // 2. Override with URL search params
        const params = new URLSearchParams(window.location.search);
        const method = params.get('method');
        const url = params.get('url') || params.get('serverUrl') || params.get('reflectionUrl');
        const descriptors = params.get('descriptors');
        const logoText = params.get('logoText');
        const logoUrl = params.get('logoUrl');
        const logoUrlLight = params.get('logoUrlLight');
        const logoUrlDark = params.get('logoUrlDark');
        const logoUrlCyberpunk = params.get('logoUrlCyberpunk');
        const prioritizedPathsParam = params.get('prioritizedPaths') || params.get('prioritized_paths');
        const highlightedFilesParam = params.get('highlightedFiles') || params.get('highlighted_files');
        const backToText = params.get('backToText') || params.get('back_to_text');
        const backToUrl = params.get('backToUrl') || params.get('back_to_url');
        const defaultTabParam = params.get('defaultTab') || params.get('default_tab');

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
        if (logoUrlLight) activeConfig.logoUrlLight = logoUrlLight;
        if (logoUrlDark) activeConfig.logoUrlDark = logoUrlDark;
        if (logoUrlCyberpunk) activeConfig.logoUrlCyberpunk = logoUrlCyberpunk;
        if (prioritizedPathsParam) {
          activeConfig.prioritizedPaths = prioritizedPathsParam.split(',').map((p) => p.trim());
        }
        if (highlightedFilesParam) {
          activeConfig.highlightedFiles = highlightedFilesParam.split(',').map((f) => f.trim());
        }
        if (backToText) activeConfig.backToText = backToText;
        if (backToUrl) activeConfig.backToUrl = backToUrl;
        if (defaultTabParam === 'files' || defaultTabParam === 'services') {
          activeConfig.defaultTab = defaultTabParam;
        }

        let openedFileOnLaunch = '';
        if (localIsDesktop && typeof (window as any).go?.main?.App.GetInitialFile === 'function') {
          openedFileOnLaunch = await (window as any).go?.main?.App.GetInitialFile();
          if (!openedFileOnLaunch) {
            const deadline = Date.now() + 1000;
            while (!openedFileOnLaunch && Date.now() < deadline) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              openedFileOnLaunch = await (window as any).go?.main?.App.GetInitialFile();
            }
          }
        }

        setConfig(activeConfig);
        if (openedFileOnLaunch) {
          await loadAssociatedFile(openedFileOnLaunch);
        } else {
          await loadSchema(activeConfig);
        }
      } catch (e: any) {
        console.error('Failed to initialize config or schema:', e);
        setError(e?.message || 'Failed to initialize Proto schema.');
        setLoading(false);
        document.body.classList.remove('loading');
      }
    };

    initializeConfig();
  }, [loadAssociatedFile, loadSchema]);

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
      } else if (!filepath) {
        setActiveFile('');
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
    if (loading) return;
    const { filepath } = parseHash(window.location.hash);
    if (activeFile) {
      if (filepath !== activeFile) {
        window.location.hash = `#/files/${activeFile}`;
      }
    } else {
      if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '#') {
        window.location.hash = '#/';
      }
    }
  }, [activeFile, loading]);

  // Scroll content area back to top when switching files/pages
  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
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

  const descriptorStats = useMemo(() => {
    const packages = new Set<string>();
    let messages = 0;
    let enums = 0;
    let services = 0;
    let methods = 0;

    const walkMessages = (messageList: any[] = []) => {
      messageList.forEach((message) => {
        messages++;
        enums += message.enumType?.length || 0;
        walkMessages(message.nestedType || []);
      });
    };

    schema.file.forEach((file) => {
      if (file.package) {
        packages.add(file.package);
      }
      enums += file.enumType?.length || 0;
      walkMessages(file.messageType || []);
      services += file.service?.length || 0;
      file.service?.forEach((service: any) => {
        methods += service.method?.length || 0;
      });
    });

    return {
      modules: packages.size,
      files: schema.file.length,
      messages,
      enums,
      services,
      methods,
    };
  }, [schema]);

  const frontPageServices = useMemo(() => {
    const services: Array<{ packageName: string; file: string; name: string; fqn: string; description: string; methodCount: number }> = [];
    schema.file.forEach((file) => {
      const packageName = file.package || 'unnamed';
      file.service?.forEach((service: any) => {
        const fqn = file.package ? `.${file.package}.${service.name}` : `.${service.name}`;
        services.push({
          packageName,
          file: file.name,
          name: service.name,
          fqn,
          description: cleanComment(service.description || ''),
          methodCount: service.method?.length || 0,
        });
      });
    });
    return services.sort((a, b) => a.fqn.localeCompare(b.fqn));
  }, [schema]);

  const frontPageSections = config.frontPageSections || [];

  const renderFrontPageSection = (section: FrontPageSectionConfig, index: number) => {
    if (section.type === 'markdown') {
      return (
        <section key={index} className="prose dark:prose-invert max-w-none text-app-textMain">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
            {section.markdown || ''}
          </ReactMarkdown>
        </section>
      );
    }

    if (section.type === 'markdown-small') {
      return (
        <section key={index} className="pt-8 border-t border-app-border/40 prose dark:prose-invert max-w-none text-xs text-app-textMuted/60">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ExternalLink }}>
            {section.markdown || ''}
          </ReactMarkdown>
        </section>
      );
    }

    if (section.type === 'descriptor-stats-panel') {
      const stats: Array<{ label: string; value: number; accent: string }> = [
        { label: 'Packages', value: descriptorStats.modules, accent: 'bg-sky-500' },
        { label: 'Files', value: descriptorStats.files, accent: 'bg-emerald-500' },
        { label: 'Methods', value: descriptorStats.methods, accent: 'bg-rose-500' },
      ];
      const typeTotal = descriptorStats.messages + descriptorStats.enums + descriptorStats.services;
      const typeMix = [
        { label: 'Messages', value: descriptorStats.messages, color: 'bg-violet-500', textColor: 'text-violet-400' },
        { label: 'Enums', value: descriptorStats.enums, color: 'bg-amber-500', textColor: 'text-amber-400' },
        { label: 'Services', value: descriptorStats.services, color: 'bg-cyan-500', textColor: 'text-cyan-400' },
      ].map((item) => ({
        ...item,
        percent: typeTotal > 0 ? (item.value / typeTotal) * 100 : 0,
      }));
      const rpcSurface = descriptorStats.services > 0
        ? `${descriptorStats.methods.toLocaleString()} methods across ${descriptorStats.services.toLocaleString()} services`
        : 'No RPC services in this descriptor set';
      return (
        <section key={index} className="border border-app-border bg-app-panel rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border/60 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-app-textBright">Descriptor Overview</h2>
              <p className="mt-1 text-xs text-app-textMuted">Live summary of the loaded FileDescriptorSet.</p>
            </div>
            <div className="text-[11px] font-mono text-app-textMuted">
              {typeTotal.toLocaleString()} declared types
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 border-b border-app-border/60">
            <div className="lg:col-span-3 p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-app-border/70 bg-app-base/45 p-4 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl font-bold text-app-textBright tabular-nums">{stat.value.toLocaleString()}</div>
                    <span className={`h-2.5 w-2.5 rounded-full ${stat.accent}`} />
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-app-textMuted font-semibold">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 p-5 border-t lg:border-t-0 lg:border-l border-app-border/60 flex flex-col justify-center gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-app-textMuted font-semibold">RPC Surface</div>
                <div className="mt-1 text-sm font-semibold text-app-textBright">{rpcSurface}</div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-app-textBright uppercase tracking-wide">Declared Type Mix</h3>
                <p className="mt-1 text-xs text-app-textMuted">
                  Messages, enums, and services as a share of the loaded schema.
                </p>
              </div>
              <div className="text-[11px] font-mono text-app-textMuted">
                {typeTotal.toLocaleString()} total
              </div>
            </div>

            <div className="mt-4 h-7 rounded-lg bg-app-hoverBg overflow-hidden flex border border-app-border/60">
              {typeMix.map((item) => (
                item.value > 0 && (
                  <div
                    key={item.label}
                    className={`${item.color} h-full flex items-center justify-center min-w-[3px]`}
                    style={{ width: `${item.percent}%` }}
                    title={`${item.label}: ${item.value.toLocaleString()} (${Math.round(item.percent)}%)`}
                  >
                    {item.percent >= 16 && (
                      <span className="text-[10px] font-bold text-white/95 drop-shadow-sm">
                        {item.label}
                      </span>
                    )}
                  </div>
                )
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {typeMix.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-app-border/60 bg-app-base/35 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color} shrink-0`} />
                    <span className="text-xs font-semibold text-app-textBright truncate">{item.label}</span>
                  </div>
                  <div className="text-[11px] font-mono text-app-textMuted shrink-0">
                    <span className={item.textColor}>{item.value.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (section.type === 'service-list-panel') {
      return (
        <section key={index} className="border border-app-border bg-app-panel rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-app-border/60 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-app-textBright">Services</h2>
            <span className="text-[11px] text-app-textMuted font-mono">{frontPageServices.length.toLocaleString()} total</span>
          </div>
          {frontPageServices.length > 0 ? (
            <div className="divide-y divide-app-border/50">
              {frontPageServices.map((service) => (
                <button
                  key={service.fqn}
                  type="button"
                  onClick={() => goToElement(service.file, service.fqn)}
                  className="w-full text-left px-5 py-4 hover:bg-app-hoverBg transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-app-textBright truncate">{service.name}</div>
                      <div className="mt-1 text-[11px] text-app-textMuted font-mono truncate">{service.packageName}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-app-accent font-mono border border-app-border rounded px-2 py-1">
                      {service.methodCount} {service.methodCount === 1 ? 'method' : 'methods'}
                    </span>
                  </div>
                  {service.description && (
                    <p className="mt-3 text-xs leading-relaxed text-app-textMuted line-clamp-2">
                      {service.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-app-textMuted font-mono">
              No services found in the loaded descriptors.
            </div>
          )}
        </section>
      );
    }

    return null;
  };

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
      y: rect.bottom + 6,
      fqn,
      description,
      category,
      shortName,
      isPinned: true,
      hasDefinition,
      targetRect: {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
      },
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
        y: rect.bottom + 6,
        fqn,
        description,
        category,
        shortName,
        isPinned: false,
        hasDefinition,
        targetRect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        },
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
  const activeLogoUrl = getActiveLogoUrl(config, theme);
  const safeBackToUrl = safeHttpUrl(config.backToUrl);

  if (!loading && (!schema.file || schema.file.length === 0)) {
    return (
      <div className={`flex h-screen w-screen bg-app-base text-app-textMain font-sans overflow-hidden transition-colors duration-200 ${themeClass}`}>
        <UploadZone
          onFilesUploaded={handleFilesUploaded}
          onConnectReflection={handleConnectReflection}
          onLoadBsr={handleLoadBsr}
          onLoadDemo={handleLoadDemo}
          loading={loading}
          error={error}
          theme={theme}
          setTheme={setTheme}
          logoUrl={activeLogoUrl}
          appVersion={APP_VERSION}
          isDesktop={isDesktop}
          canLoadBsr={isDesktop || config.proxy === true}
        />
        {isDragging && (
          <div className="fixed inset-0 bg-app-base/80 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-app-accent pointer-events-none">
            <div className="bg-app-panel border border-app-border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl scale-up max-w-sm text-center">
              <svg className="w-16 h-16 text-app-accent animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
              <h3 className="text-xl font-bold text-app-textBright">Drop to Load Schema</h3>
              <p className="text-sm text-app-textMuted font-mono">Drop your compiled binary protobuf descriptor files here to immediately browse their schemas.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen bg-app-base text-app-textMain font-sans overflow-hidden transition-colors duration-200 ${themeClass}`}>

      {/* Sidebar backdrop on mobile */}
      {isSidebarOpen && (
        <div
          className="fixed top-14 inset-x-0 bottom-0 bg-black/40 z-35 md:hidden transition-opacity duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar with grouped directories and popup theme selector */}
      <Suspense fallback={<div className="w-64 h-full bg-app-surface border-r border-app-border animate-pulse" />}>
        <Sidebar
          logoUrl={activeLogoUrl}
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
          prioritizedPaths={config.prioritizedPaths}
          highlightedFiles={config.highlightedFiles}
        />
      </Suspense>

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

            {safeBackToUrl && (
              <a
                href={safeBackToUrl}
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-app-textMuted hover:text-app-textBright hover:bg-app-hoverBg px-2.5 py-1.5 rounded-lg font-sans text-sm font-semibold transition-colors shrink-0 mr-2 border border-app-border/40"
                title={config.backToText || 'Back'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span>{config.backToText || 'Back'}</span>
              </a>
            )}

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
            {isDesktop && (
              <button
                type="button"
                onClick={handleOpenSchemaLoader}
                className="text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 border border-app-border/40"
                title="Load a different protobuf descriptor or connection"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span>Load Schema</span>
              </button>
            )}
            {activeFile && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDownloadOpen(!isDownloadOpen);
                  }}
                  title="Download File or Descriptor Set"
                  className={`text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors flex items-center justify-center shrink-0 ${
                    isDownloadOpen ? 'bg-app-hoverBg text-app-textBright' : ''
                  }`}
                >
                  <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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

            {activeFile && (
              <button
                type="button"
                onClick={() => setIsQuickBrowseOpen(true)}
                title="Quick Browse Outline (Cmd+K)"
                className="text-app-textMuted hover:text-app-textBright p-1.5 rounded-lg hover:bg-app-hoverBg cursor-pointer transition-colors flex items-center justify-center shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.25">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </button>
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
        <main ref={contentAreaRef} className="flex-1 overflow-y-auto overflow-x-hidden p-8 xl:pr-40 bg-app-code transition-colors duration-200 relative select-text w-full">
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
              <div className="pb-8 select-text w-full max-w-4xl mx-auto">
                {frontPageSections.length > 0 ? (
                  <div className="space-y-8">
                    {frontPageSections.map((section, index) => renderFrontPageSection(section, index))}
                  </div>
                ) : (
                  <div className="text-center py-20 text-app-textMuted font-mono">
                    <h2 className="text-2xl font-bold text-app-textBright mb-4">Welcome to ProtoDocs</h2>
                    <p className="text-sm">Select a file or service in the sidebar to start browsing the schema documentation.</p>
                  </div>
                )}
              </div>
            ) : (
              currentFileObj && (
                <>
                  {currentFileObj.description && (
                    <div className="text-syn-comment mb-6 whitespace-pre-wrap font-mono text-sm leading-relaxed select-text w-full">
                      {cleanComment(currentFileObj.description).split('\n').map((line: string) => `// ${line}`).join('\n')}
                    </div>
                  )}

                  {/* File Header metadata */}
                  <div className="proto-block mb-8 border-b border-app-border pb-4 font-mono text-xs text-app-textMuted space-y-1.5 select-text w-full overflow-x-auto hide-scrollbar">
                    {getEditionString(currentFileObj.edition) ? (() => {
                      const edStr = getEditionString(currentFileObj.edition)!;
                      const edDesc = {
                        text: `Declares that this file uses Protobuf Editions syntax (edition "${edStr}"). Editions replace the old proto2/proto3 syntax keywords and allow per-feature opt-in/opt-out behaviour.`,
                        url: 'https://protobuf.dev/editions/overview/',
                      };
                      return (
                        <div className="proto-text">
                          <KeywordLink
                            keyword="edition"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onPinClick={handlePinClick}
                          /> ={' '}
                          <span
                            className="text-syn-string border-b border-dotted border-syn-string/50 cursor-pointer hover:bg-app-hoverBg rounded px-0.5"
                            onMouseEnter={(e) => handleMouseEnter(e, `edition.${edStr}`, edDesc, 'primitive', `"${edStr}"`)}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => handlePinClick(e, `edition.${edStr}`, edDesc, 'primitive', `"${edStr}"`)}
                          >"{edStr}"</span>;
                        </div>
                      );
                    })() : (() => {
                      const syn = currentFileObj.syntax || 'proto2';
                      const docsUrl = syn === 'proto2'
                        ? 'https://protobuf.dev/programming-guides/proto2/'
                        : 'https://protobuf.dev/programming-guides/proto3/';
                      const synDesc = {
                        text: syn === 'proto2'
                          ? 'Declares that this file uses Protocol Buffers version 2 (proto2). Fields require explicit optional/required/repeated labels and support default values and extensions.'
                          : 'Declares that this file uses Protocol Buffers version 3 (proto3). Fields are optional by default, required is removed, and the language is simplified compared to proto2.',
                        url: docsUrl,
                      };
                      return (
                        <div className="proto-text">
                          <KeywordLink
                            keyword="syntax"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onPinClick={handlePinClick}
                          /> ={' '}
                          <span
                            className="text-syn-string border-b border-dotted border-syn-string/50 cursor-pointer hover:bg-app-hoverBg rounded px-0.5"
                            onMouseEnter={(e) => handleMouseEnter(e, `syntax.${syn}`, synDesc, 'primitive', `"${syn}"`)}
                            onMouseLeave={handleMouseLeave}
                            onClick={(e) => handlePinClick(e, `syntax.${syn}`, synDesc, 'primitive', `"${syn}"`)}
                          >"{syn}"</span>;
                        </div>
                      );
                    })()}
                    {currentFileObj.package && (
                      <div className="proto-text">
                        <KeywordLink
                          keyword="package"
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={handleMouseLeave}
                          onPinClick={handlePinClick}
                        />{' '}
                        <span className="text-app-textMain">{currentFileObj.package}</span>;
                      </div>
                    )}
                    {(() => {
                      if (!currentFileObj.dependency) return null;
                      const publicSet = new Set<number>(currentFileObj.publicDependency || []);
                      const weakSet = new Set<number>(currentFileObj.weakDependency || []);
                      const depsWithMetadata = currentFileObj.dependency.map((dep: string, index: number) => ({
                        name: dep,
                        isPublic: publicSet.has(index),
                        isWeak: weakSet.has(index),
                      }));

                      depsWithMetadata.sort((a: any, b: any) => a.name.localeCompare(b.name));

                      return depsWithMetadata.map((dep: any) => (
                        <div
                          key={dep.name}
                          className="proto-text cursor-pointer hover:text-app-textBright group transition-colors whitespace-pre-wrap"
                          onClick={() => {
                            if (schema.file.some((f) => f.name === dep.name)) {
                              setActiveFile(dep.name);
                            }
                          }}
                        >
                          <KeywordLink
                            keyword="import"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onPinClick={handlePinClick}
                          />{' '}
                          {dep.isPublic && (
                            <>
                              <KeywordLink
                                keyword="public"
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                                onPinClick={handlePinClick}
                              />{' '}
                            </>
                          )}
                          {dep.isWeak && (
                            <>
                              <KeywordLink
                                keyword="weak"
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                                onPinClick={handlePinClick}
                              />{' '}
                            </>
                          )}
                          <span className="text-syn-string">"{dep.name}"</span>;
                        </div>
                      ));
                    })()}
                    {currentFileObj.options && (() => {
                      const optionEntries = Object.entries(currentFileObj.options).filter(([k]) => !k.startsWith('$') && k !== 'uninterpretedOption');
                      const isCustom = (key: string) => key.startsWith('[') || key.startsWith('(');
                      const standardEntries = optionEntries.filter(([k]) => !isCustom(k));
                      const customEntries = optionEntries.filter(([k]) => isCustom(k));
                      standardEntries.sort((a, b) => a[0].localeCompare(b[0]));
                      customEntries.sort((a, b) => formatOptionKey(a[0]).localeCompare(formatOptionKey(b[0])));

                      const sortedEntries = [...standardEntries, ...customEntries];
                      return sortedEntries.map(([k, v]) => (
                        <div key={k} className="proto-text">
                          <KeywordLink
                            keyword="option"
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={handleMouseLeave}
                            onPinClick={handlePinClick}
                          />{' '}
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
                      ));
                    })()}
                  </div>

                  {/* Viewers */}
                  <Suspense fallback={<div className="p-8 text-app-textMuted animate-pulse">Loading viewers...</div>}>
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
                        onOpenDecoderModal={handleOpenDecoder}
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
                        onOpenDecoderModal={handleOpenDecoder}
                        registry={registry}
                        allowedProtocols={config.protocols}
                        expandedDecoderFqn={expandedDecoderFqn}
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
                  </Suspense>
                </>
              )
            )}
          </div>
        </main>

        {/* Minimap Viewport Navigation */}
        <Suspense fallback={null}>
          <Minimap
            contentRef={contentAreaRef}
            activeFile={activeFile}
            schema={schema}
            theme={theme}
          />
        </Suspense>

        {isSchemaLoaderOpen && (
          <div className="fixed inset-0 z-[100] bg-app-base/85 backdrop-blur-md">
            <UploadZone
              onFilesUploaded={handleFilesUploaded}
              onConnectReflection={handleConnectReflection}
              onLoadBsr={handleLoadBsr}
              onLoadDemo={handleLoadDemo}
              loading={loading}
              error={error}
              theme={theme}
              setTheme={setTheme}
              logoUrl={activeLogoUrl}
              appVersion={APP_VERSION}
              isDesktop={isDesktop}
              canLoadBsr={isDesktop || config.proxy === true}
              onClose={handleCloseSchemaLoader}
            />
          </div>
        )}

        {/* Reference Panel Drawer */}
        <Suspense fallback={null}>
          <ReferencePanel
            state={referencePanel}
            onClose={() => setReferencePanel(null)}
            onReferenceClick={goToElement}
          />
        </Suspense>

      </div>

      {/* Rich Tooltip Overlay */}
      <Suspense fallback={null}>
        <Tooltip
          key={activeTooltip ? `${activeTooltip.fqn}-${activeTooltip.x}-${activeTooltip.y}` : 'none'}
          activeTooltip={activeTooltip}
          onClose={() => setActiveTooltip(null)}
          onGoToDefinition={goToDefinition}
          onFindReferences={findReferences}
          onOpenDecoderDrawer={handleOpenDecoder}
          typeIndex={typeIndex}
        />
      </Suspense>

      {/* QuickBrowse outline outline catalog */}
      <Suspense fallback={null}>
        {schema && schema.file && (
          <QuickBrowse
            schema={schema}
            activeFile={activeFile}
            onNavigate={goToElement}
            isOpen={isQuickBrowseOpen}
            setIsOpen={setIsQuickBrowseOpen}
          />
        )}
      </Suspense>

      {isDragging && (
        <div className="fixed inset-0 bg-app-base/80 backdrop-blur-md z-50 flex flex-col items-center justify-center border-4 border-dashed border-app-accent pointer-events-none">
          <div className="bg-app-panel border border-app-border rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl scale-up max-w-sm text-center font-sans">
            <svg className="w-16 h-16 text-app-accent animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <h3 className="text-xl font-bold text-app-textBright">Drop to Load Schema</h3>
            <p className="text-sm text-app-textMuted leading-relaxed">Drop your compiled binary protobuf descriptor files here to immediately browse their schemas.</p>
          </div>
        </div>
      )}
    </div>
  );
}
