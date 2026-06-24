import { resolveUrl } from './proxy';

export interface BsrLoadRequest {
  module: string;
  ref?: string;
  token?: string;
  sourceInfo?: boolean;
}

export async function loadBsrDescriptorBytes(request: BsrLoadRequest): Promise<Uint8Array> {
  const res = await fetch(resolveUrl('/api/bsr/descriptor'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: request.token || '',
      modules: [
        {
          module: request.module,
          ref: request.ref || '',
          sourceInfo: request.sourceInfo ?? true,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body.trim() || `Failed to load BSR descriptor: HTTP ${res.status}`);
  }

  return new Uint8Array(await res.arrayBuffer());
}
