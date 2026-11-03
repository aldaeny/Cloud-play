/** Server-only, read-only Xtream catalog adapter. Never return provider URLs or credentials. */
export type Entry = { id: string; name: string };
export class CatalogError extends Error {
  constructor(public code: 'DISABLED' | 'NOT_CONFIGURED' | 'HTTP_DISABLED' | 'UPSTREAM_BLOCKED' | 'UPSTREAM_ERROR' | 'INVALID_CATEGORY' | 'RATE_LIMIT') { super(code); }
}
const MAX_BYTES = 2 * 1024 * 1024;
const CACHE_MS = 30_000;
const MAX_CATEGORIES = 1000;
const MAX_CHANNELS = 5000;
const cache = new Map<string, { expires: number; value: Entry[] }>();
const pending = new Map<string, Promise<Entry[]>>();
let windowStart = 0;
let hits = 0;

function settings() {
  if (process.env.XTREAM_CATALOG_ENABLED !== 'true') throw new CatalogError('DISABLED');
  const base = process.env.XTREAM_BASE_URL?.trim();
  const username = process.env.XTREAM_USERNAME;
  const password = process.env.XTREAM_PASSWORD;
  if (!base || !username || !password) throw new CatalogError('NOT_CONFIGURED');
  let url: URL;
  try { url = new URL(base); } catch { throw new CatalogError('NOT_CONFIGURED'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new CatalogError('NOT_CONFIGURED');
  if (url.protocol === 'http:' && process.env.XTREAM_ALLOW_HTTP !== 'true') throw new CatalogError('HTTP_DISABLED');
  return { url, username, password };
}
function limit() {
  const now = Date.now();
  if (now - windowStart >= 60_000) { windowStart = now; hits = 0; }
  if (++hits > 120) throw new CatalogError('RATE_LIMIT');
}
function idOf(value: unknown): string | null {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return /^\d{1,18}$/.test(id) ? id : null;
}
function cleanName(value: unknown, secrets: string[]) {
  if (typeof value !== 'string') return '';
  let text = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
  for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
  return text.slice(0, 150);
}
async function fetchEntries(action: 'get_live_categories' | 'get_live_streams', category?: string): Promise<Entry[]> {
  const config = settings();
  const url = new URL('/player_api.php', config.url);
  url.searchParams.set('username', config.username);
  url.searchParams.set('password', config.password);
  url.searchParams.set('action', action);
  if (category) url.searchParams.set('category_id', category);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.status === 403) throw new CatalogError('UPSTREAM_BLOCKED');
    if (!response.ok || !response.body) throw new CatalogError('UPSTREAM_ERROR');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new CatalogError('UPSTREAM_ERROR');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new CatalogError('UPSTREAM_ERROR'); }
      chunks.push(result.value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8'));
    if (!Array.isArray(parsed)) throw new CatalogError('UPSTREAM_ERROR');
    const cap = action === 'get_live_categories' ? MAX_CATEGORIES : MAX_CHANNELS;
    const result: Entry[] = [];
    for (const item of parsed.slice(0, cap)) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const id = idOf(action === 'get_live_categories' ? record.category_id : record.stream_id);
      const name = cleanName(action === 'get_live_categories' ? record.category_name : record.name, [config.username, config.password]);
      if (id && name) result.push({ id, name });
    }
    return result;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError('UPSTREAM_ERROR');
  } finally { clearTimeout(timeout); }
}
async function cached(key: string, action: 'get_live_categories' | 'get_live_streams', category?: string) {
  // Check configuration every request so disabling the integration takes effect immediately.
  settings();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(key)) return pending.get(key)!;
  const task = fetchEntries(action, category).then(value => {
    if (cache.size >= 100) cache.delete(cache.keys().next().value as string);
    cache.set(key, { expires: Date.now() + CACHE_MS, value });
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, task); return task;
}
export async function categories() { limit(); return cached('categories', 'get_live_categories'); }
export async function channels(category: string) {
  limit();
  // Configuration is checked before the argument: a disabled adapter must say
  // DISABLED, not INVALID_CATEGORY, or the operator is told to fix the wrong thing.
  settings();
  if (!/^\d{1,18}$/.test(category)) throw new CatalogError('INVALID_CATEGORY');
  const groups = await cached('categories', 'get_live_categories');
  if (!groups.some(group => group.id === category)) throw new CatalogError('INVALID_CATEGORY');
  return cached(`channels:${category}`, 'get_live_streams', category);
}
