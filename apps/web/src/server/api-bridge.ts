/**
 * Server-side bridge from Next.js to the NestJS API (Hybrid, D1 Option C).
 *
 * Next.js calls NestJS for business operations. The browser only ever talks to
 * same-origin `/api/*` routes; this module runs on the server and forwards the
 * caller's Supabase access token to NestJS, which verifies it with Supabase Auth
 * and applies the business rules.
 *
 * Why proxy instead of calling the API from the browser?
 *  - The API origin stays server-side, so it is never published to clients.
 *  - No CORS surface is exposed to arbitrary sites.
 *  - One place enforces timeouts, redirect refusal and cache policy.
 *
 * This deliberately mirrors `apps/admin/lib/backend.ts`, which is already
 * deployed and verified: bearer required, origin validated, `redirect: 'error'`,
 * bounded timeout, `no-store`.
 *
 * The API is optional. When `API_INTERNAL_URL` is unset the bridge reports
 * `API_NOT_CONFIGURED` and callers keep their existing behaviour, so this file
 * can ship before the API is deployed without changing the live site.
 */

/** Stable, client-safe error codes. Never include upstream URLs or bodies. */
export type BridgeCode =
  | 'API_NOT_CONFIGURED'
  | 'API_ORIGIN_INVALID'
  | 'SIGN_IN_REQUIRED'
  | 'UPSTREAM_REJECTED'
  | 'API_UNAVAILABLE';

export interface BridgeFailure {
  ok: false;
  code: BridgeCode;
  /** HTTP status to return to the browser. */
  status: number;
  /** Upstream status, when there was one. Useful for logs, not for users. */
  upstreamStatus?: number;
}

export interface BridgeSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export type BridgeResult<T> = BridgeSuccess<T> | BridgeFailure;

const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 256 * 1024;

export function apiConfigured(): boolean {
  return Boolean((process.env.API_INTERNAL_URL || '').trim());
}

/**
 * Validate the configured API origin.
 *
 * HTTPS is required except for loopback development, because credentials travel
 * on this hop. Userinfo, a path, a query or a fragment are all rejected: they
 * make the target ambiguous and can be used to smuggle credentials elsewhere.
 */
export function resolveApiOrigin(): { origin: string } | { code: BridgeCode } {
  const raw = (process.env.API_INTERNAL_URL || '').trim();
  if (!raw) return { code: 'API_NOT_CONFIGURED' };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { code: 'API_ORIGIN_INVALID' };
  }
  if (url.username || url.password) return { code: 'API_ORIGIN_INVALID' };
  if (url.pathname !== '/' || url.search || url.hash) return { code: 'API_ORIGIN_INVALID' };
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol === 'https:') return { origin: url.origin };
  if (url.protocol === 'http:' && loopback) return { origin: url.origin };
  return { code: 'API_ORIGIN_INVALID' };
}

/**
 * Only forward known API path segments. `path` must be a root-relative path
 * without a scheme, `..`, or a protocol-relative `//` prefix, so a caller cannot
 * turn this bridge into an open proxy.
 */
export function safeApiPath(path: string): string | null {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  if (path.includes('\\') || path.includes('..')) return null;
  if (/[\r\n\0]/.test(path)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  return path;
}

/** Extract a Supabase bearer token from an incoming header value. */
export function bearerFrom(header: string | string[] | null | undefined): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !/^bearer\s+\S+$/i.test(raw.trim())) return null;
  const token = raw.trim().slice(7).trim();
  if (!token || token.length > 4096 || token.split('.').length !== 3) return null;
  return token;
}

export interface BridgeRequest {
  /** Root-relative API path, e.g. `/profiles`. */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Incoming Authorization header; verified downstream by NestJS. */
  authorization?: string | string[] | null;
  /** JSON request body for write methods. */
  body?: unknown;
  /** Set false only for endpoints that are genuinely public. */
  requireAuth?: boolean;
}

/**
 * Forward a business operation to NestJS.
 *
 * Returns a discriminated result rather than throwing, so a route handler can
 * map failures to honest status codes without leaking upstream detail.
 */
export async function callApi<T>(request: BridgeRequest): Promise<BridgeResult<T>> {
  const resolved = resolveApiOrigin();
  if ('code' in resolved) {
    return { ok: false, code: resolved.code, status: 503 };
  }

  const path = safeApiPath(request.path);
  if (!path) return { ok: false, code: 'API_ORIGIN_INVALID', status: 500 };

  const method = request.method || 'GET';
  const token = bearerFrom(request.authorization);
  if (request.requireAuth !== false && !token) {
    return { ok: false, code: 'SIGN_IN_REQUIRED', status: 401 };
  }

  let payload: string | undefined;
  if (request.body !== undefined && method !== 'GET') {
    payload = JSON.stringify(request.body);
    if (Buffer.byteLength(payload, 'utf8') > MAX_BODY_BYTES) {
      return { ok: false, code: 'UPSTREAM_REJECTED', status: 413 };
    }
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, resolved.origin), {
      method,
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload !== undefined ? { body: payload } : {}),
      // A redirect could forward the caller's bearer token to another origin.
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, code: 'API_UNAVAILABLE', status: 503 };
  }

  // Parse defensively: an upstream proxy may return HTML or an empty body.
  let data: unknown = null;
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) return { ok: false, code: 'API_UNAVAILABLE', status: 502, upstreamStatus: response.status };
      data = null;
    }
  }

  if (!response.ok) {
    // Pass through the status class so the browser can react (401 → sign in),
    // but never the upstream body: it may contain internal detail.
    const status = response.status >= 400 && response.status < 500 ? response.status : 503;
    return { ok: false, code: 'UPSTREAM_REJECTED', status, upstreamStatus: response.status };
  }

  return { ok: true, status: response.status, data: data as T };
}
