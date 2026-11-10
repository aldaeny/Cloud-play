import { publicFetch } from './public-fetch';
/**
 * Server-only Xtream adapter for the PRIVATE, owner-only player.
 *
 * This is deliberately separate from `xtream.ts` (the public, read-only live
 * catalog) so the public site's behaviour and its source gate are untouched.
 *
 * Hard rules enforced here:
 *  - Credentials live in server env only and are never returned to the client.
 *  - Names are scrubbed of the username/password in case the provider echoes them.
 *  - Playback is expressed as an encrypted, expiring capability token, never a URL.
 *  - Every upstream call is size-capped, time-boxed, redirect-free and rate-limited.
 */
import { sealPath } from './xtream-token';

export type Kind = 'live' | 'movie' | 'series';
export type Group = { id: string; name: string };
export type Item = { id: string; name: string; icon?: string; ext?: string; season?: string; episode?: string };
export type AccountStatus = { status: string; expiresAt: number | null; activeConnections: number | null; maxConnections: number | null };

export type PrivateCode =
  | 'DISABLED'
  | 'NOT_CONFIGURED'
  | 'HTTP_DISABLED'
  | 'UPSTREAM_BLOCKED'
  | 'UPSTREAM_ERROR'
  | 'INVALID_INPUT'
  | 'RATE_LIMIT';

export class PrivateError extends Error {
  constructor(public code: PrivateCode) {
    super(code);
  }
}

const MAX_BYTES = 8 * 1024 * 1024;
const CACHE_MS = 60_000;
const MAX_GROUPS = 1000;
const MAX_ITEMS = 3000;
const TIMEOUT_MS = 12_000;

const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
let windowStart = 0;
let hits = 0;

const ACTIONS: Record<Kind, { groups: string; items: string }> = {
  live: { groups: 'get_live_categories', items: 'get_live_streams' },
  movie: { groups: 'get_vod_categories', items: 'get_vod_streams' },
  series: { groups: 'get_series_categories', items: 'get_series' },
};

export function isKind(value: unknown): value is Kind {
  return value === 'live' || value === 'movie' || value === 'series';
}

function settings() {
  if (process.env.XTREAM_CATALOG_ENABLED !== 'true') throw new PrivateError('DISABLED');
  const base = process.env.XTREAM_BASE_URL?.trim();
  const username = process.env.XTREAM_USERNAME;
  const password = process.env.XTREAM_PASSWORD;
  if (!base || !username || !password) throw new PrivateError('NOT_CONFIGURED');
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new PrivateError('NOT_CONFIGURED');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new PrivateError('NOT_CONFIGURED');
  if (url.pathname !== '/' && url.pathname !== '') throw new PrivateError('NOT_CONFIGURED');
  if (url.protocol === 'http:' && process.env.XTREAM_ALLOW_HTTP !== 'true') throw new PrivateError('HTTP_DISABLED');
  return { url, username, password, secret: process.env.XTREAM_PROXY_SECRET || password };
}

/** Throws if the private player is switched off or incompletely configured. */
export function assertConfigured(): void {
  settings();
}

function limit() {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    hits = 0;
  }
  if (++hits > 240) throw new PrivateError('RATE_LIMIT');
}

function idOf(value: unknown): string | null {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return /^\d{1,18}$/.test(id) ? id : null;
}

function cleanName(value: unknown, secrets: string[]): string {
  if (typeof value !== 'string') return '';
  let text = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();
  for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
  return text.slice(0, 180);
}

function cleanExt(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const ext = value.trim().toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : undefined;
}

/** Only clean https artwork is passed through; anything else is dropped. */
function safeIcon(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 1024) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

async function apiJson(action: string, params: Record<string, string> = {}): Promise<unknown> {
  const config = settings();
  const url = new URL('/player_api.php', config.url);
  url.searchParams.set('username', config.username);
  url.searchParams.set('password', config.password);
  if (action) url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await publicFetch(url, {
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 401 || response.status === 403) throw new PrivateError('UPSTREAM_BLOCKED');
    if (!response.ok || !response.body) throw new PrivateError('UPSTREAM_ERROR');
    if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new PrivateError('UPSTREAM_ERROR');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new PrivateError('UPSTREAM_ERROR');
      }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf8'));
  } catch (error) {
    if (error instanceof PrivateError) throw error;
    throw new PrivateError('UPSTREAM_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

async function cached<T>(key: string, work: () => Promise<T>): Promise<T> {
  // Re-check configuration on every request so disabling takes effect immediately.
  settings();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const inFlight = pending.get(key);
  if (inFlight) return inFlight as Promise<T>;
  const task = work()
    .then(value => {
      if (cache.size >= 120) cache.delete(cache.keys().next().value as string);
      cache.set(key, { expires: Date.now() + CACHE_MS, value });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

export async function listGroups(kind: Kind): Promise<Group[]> {
  limit();
  return cached(`groups:${kind}`, async () => {
    const config = settings();
    const parsed = await apiJson(ACTIONS[kind].groups);
    if (!Array.isArray(parsed)) throw new PrivateError('UPSTREAM_ERROR');
    const out: Group[] = [];
    for (const entry of parsed.slice(0, MAX_GROUPS)) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const id = idOf(record.category_id);
      const name = cleanName(record.category_name, [config.username, config.password]);
      if (id && name) out.push({ id, name });
    }
    return out;
  });
}

async function assertGroup(kind: Kind, category: string): Promise<void> {
  if (!/^\d{1,18}$/.test(category)) throw new PrivateError('INVALID_INPUT');
  const groups = await listGroups(kind);
  if (!groups.some(group => group.id === category)) throw new PrivateError('INVALID_INPUT');
}

export async function listItems(kind: Kind, category: string): Promise<Item[]> {
  limit();
  await assertGroup(kind, category);
  return cached(`items:${kind}:${category}`, async () => {
    const config = settings();
    const parsed = await apiJson(ACTIONS[kind].items, { category_id: category });
    if (!Array.isArray(parsed)) throw new PrivateError('UPSTREAM_ERROR');
    const secrets = [config.username, config.password];
    const out: Item[] = [];
    for (const entry of parsed.slice(0, MAX_ITEMS)) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const id = idOf(kind === 'series' ? record.series_id : record.stream_id);
      const name = cleanName(record.name ?? record.title, secrets);
      if (!id || !name) continue;
      const rawIcon = record.stream_icon ?? record.cover;
      // Clean https artwork passes through; http artwork on the provider itself
      // is served through our proxy so the page has no mixed-content warnings.
      let icon = safeIcon(rawIcon);
      if (!icon && typeof rawIcon === 'string') {
        const sealed = artworkToken(rawIcon);
        if (sealed) icon = `/api/xtream/stream?t=${encodeURIComponent(sealed)}`;
      }
      const ext = cleanExt(record.container_extension);
      out.push({ id, name, ...(icon ? { icon } : {}), ...(ext ? { ext } : {}) });
    }
    return out;
  });
}

/** Flatten a series into playable episodes. Series rows themselves are not playable. */
export async function listEpisodes(seriesId: string): Promise<Item[]> {
  limit();
  if (!/^\d{1,18}$/.test(seriesId)) throw new PrivateError('INVALID_INPUT');
  return cached(`episodes:${seriesId}`, async () => {
    const config = settings();
    const parsed = await apiJson('get_series_info', { series_id: seriesId });
    if (!parsed || typeof parsed !== 'object') throw new PrivateError('UPSTREAM_ERROR');
    const episodes = (parsed as Record<string, unknown>).episodes;
    if (!episodes || typeof episodes !== 'object') return [];
    const secrets = [config.username, config.password];
    const out: Item[] = [];
    for (const [season, rows] of Object.entries(episodes as Record<string, unknown>)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows.slice(0, 500)) {
        if (!row || typeof row !== 'object') continue;
        const record = row as Record<string, unknown>;
        const id = idOf(record.id);
        if (!id) continue;
        const episode = cleanName(record.episode_num, secrets) || String(out.length + 1);
        const title = cleanName(record.title, secrets);
        const name = title || `${season} · ${episode}`;
        const ext = cleanExt(record.container_extension);
        out.push({ id, name, season: String(season).slice(0, 6), episode: episode.slice(0, 6), ...(ext ? { ext } : {}) });
        if (out.length >= MAX_ITEMS) return out;
      }
    }
    return out;
  });
}

/** Safe account summary for the owner UI. Never includes username or password. */
export async function accountStatus(): Promise<AccountStatus> {
  limit();
  const parsed = await apiJson('');
  const info = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).user_info : undefined;
  const record = info && typeof info === 'object' ? (info as Record<string, unknown>) : {};
  const exp = record.exp_date;
  const expNum = typeof exp === 'string' || typeof exp === 'number' ? Number(exp) : NaN;
  const num = (value: unknown) => {
    const parsedNum = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
    return Number.isFinite(parsedNum) ? parsedNum : null;
  };
  return {
    status: typeof record.status === 'string' ? record.status.slice(0, 40) : 'unknown',
    expiresAt: Number.isFinite(expNum) && expNum > 0 ? expNum * 1000 : null,
    activeConnections: num(record.active_cons),
    maxConnections: num(record.max_connections),
  };
}

/**
 * Build the provider-relative playback path and seal it into a token.
 * The raw path (which contains the credentials) never leaves this function.
 */
export function playbackToken(kind: Kind, id: string, ext?: string): { token: string; container: string } {
  const config = settings();
  if (!/^\d{1,18}$/.test(id)) throw new PrivateError('INVALID_INPUT');
  const container = kind === 'live' ? 'm3u8' : cleanExt(ext) ?? 'mp4';
  const user = encodeURIComponent(config.username);
  const pass = encodeURIComponent(config.password);
  const path = `/${kind}/${user}/${pass}/${id}.${container}`;
  return { token: sealPath(path, config.secret), container };
}

/** Seal an artwork path on the provider so http posters can be shown safely. */
export function artworkToken(absoluteUrl: string): string | null {
  const config = settings();
  let url: URL;
  try {
    url = new URL(absoluteUrl);
  } catch {
    return null;
  }
  if (url.origin !== config.url.origin) return null;
  return sealPath(url.pathname + url.search, config.secret, 60 * 60 * 1000);
}

export function providerOrigin(): string {
  return settings().url.origin;
}

export function proxySecret(): string {
  return settings().secret;
}
