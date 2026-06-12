let proxyChecked = false;
let proxyAvailable = false;

export async function checkProxyAvailable(): Promise<boolean> {
  if (proxyChecked) {
    return proxyAvailable;
  }
  try {
    const res = await fetch('/api/health');
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
      url: '/api/proxy',
      headers: nextHeaders,
    };
  }
  return { url, headers };
}
