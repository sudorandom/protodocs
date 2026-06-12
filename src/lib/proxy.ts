export function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  let path = window.location.pathname;
  if (path.endsWith('.html') || path.endsWith('.htm')) {
    path = path.substring(0, path.lastIndexOf('/') + 1);
  }
  if (!path.endsWith('/')) {
    path += '/';
  }
  return path;
}

export function resolveUrl(relativeUrl: string): string {
  if (!relativeUrl) {
    return '';
  }
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://') || relativeUrl.startsWith('ws://') || relativeUrl.startsWith('wss://')) {
    return relativeUrl;
  }
  const base = getBaseUrl();
  const rel = relativeUrl.startsWith('/') ? relativeUrl.substring(1) : relativeUrl;
  return base + rel;
}

export function isProxyEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('proxy') === 'true';
  }
  return false;
}

export function getProxiedUrlAndHeaders(
  url: string,
  headers: Record<string, string>
): { url: string; headers: Record<string, string> } {
  if (isProxyEnabled() && (url.startsWith('http://') || url.startsWith('https://'))) {
    const localOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    if (localOrigin && url.startsWith(localOrigin)) {
      return { url, headers };
    }
    
    const nextHeaders = { ...headers };
    nextHeaders['X-Target-Url'] = url;
    return {
      url: resolveUrl('/api/proxy'),
      headers: nextHeaders,
    };
  }
  return { url, headers };
}
