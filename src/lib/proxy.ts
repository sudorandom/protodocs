let proxyChecked = false;
let proxyAvailable = false;

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

export async function checkProxyAvailable(): Promise<boolean> {
  if (proxyChecked) {
    return proxyAvailable;
  }
  try {
    const res = await fetch(resolveUrl('/api/health'));
    if (res.ok) {
      const data = await res.json();
      proxyAvailable = data.proxy === true || data.status === 'ok';
    }
  } catch {
    proxyAvailable = false;
  }
  proxyChecked = true;
  return proxyAvailable;
}

export function isProxyEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('proxy') === 'false') {
      return false;
    }
    if (params.get('proxy') === 'true') {
      return true;
    }
  }
  return proxyAvailable;
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
