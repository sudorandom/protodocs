export function openExternalUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return;
  }

  const runtime = (window as any).runtime;
  if (runtime && typeof runtime.BrowserOpenURL === 'function') {
    runtime.BrowserOpenURL(parsed.toString());
    return;
  }

  window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
}
