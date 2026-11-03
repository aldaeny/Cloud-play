/** Read-only catalog; no arbitrary URLs or server-side stream proxy. Approved URLs are visible to viewers. */
const SOURCE = 'https://digite-bda04-default-rtdb.firebaseio.com/channels.json';
const ALLOWED_HLS_HOSTS = new Set(['partneta.cdn.mgmlcdn.com']);
const MAX_BYTES = 1024 * 1024;
export type PublicChannel = { id: string; name: string; category: string; quality: string; playable: boolean; streamUrl?: string };
let cached: { until: number; data: PublicChannel[] } | undefined;
let pending: Promise<PublicChannel[]> | undefined;
let hits = 0, windowStart = 0;
function safeText(input: unknown, max = 100): string { return typeof input === 'string' ? input.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, max) : ''; }
export function publicHls(input: unknown): string | undefined {
  if (typeof input !== 'string' || input.length > 2048) return;
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:' || !ALLOWED_HLS_HOSTS.has(u.hostname.toLowerCase()) || (u.port && u.port !== '443') || u.username || u.password || u.search || u.hash || !u.pathname.toLowerCase().endsWith('.m3u8')) return;
    return u.href;
  } catch { return; }
}
export async function getPublicChannels(): Promise<PublicChannel[]> {
  const now = Date.now(); if (now - windowStart > 60_000) { windowStart = now; hits = 0; } if (++hits > 60) throw new Error('RATE_LIMIT');
  if (cached && cached.until > now) return cached.data;
  if (pending) return pending;
  pending = (async () => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(SOURCE, { signal: controller.signal, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!r.ok || !r.body || Number(r.headers.get('content-length')) > MAX_BYTES) throw new Error('SOURCE_UNAVAILABLE');
      const reader = r.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
      for (;;) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > MAX_BYTES) { await reader.cancel(); throw new Error('SOURCE_UNAVAILABLE'); } chunks.push(part.value); }
      const raw: unknown = JSON.parse(Buffer.concat(chunks.map(x => Buffer.from(x))).toString('utf8'));
      const values = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
      const data = values.slice(0, 500).flatMap((value, index) => {
        if (!value || typeof value !== 'object') return [];
        const row = value as Record<string, unknown>; const name = safeText(row.name); if (!name) return [];
        const streamUrl = publicHls(row.streamUrl); const id = safeText(String(row.id ?? index), 60);
        return [{ id: `${index}-${id}`, name, category: safeText(row.category), quality: safeText(row.quality, 30), playable: !!streamUrl, ...(streamUrl ? { streamUrl } : {}) }];
      });
      cached = { until: Date.now() + 30_000, data }; return data;
    } finally { clearTimeout(timer); }
  })().finally(() => { pending = undefined; });
  return pending;
}
