export function safeHttpUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return '';

  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }

    return parsed.href;
  } catch {
    return '';
  }
}
