/**
 * Health monitoring for configured Xtream servers.
 *
 * Honesty rules, which are the whole point of this file:
 *  - "healthy" requires a real, authenticated response from the provider. A
 *    timeout, DNS failure, 5xx, or refused credential is NEVER healthy.
 *  - An unreachable origin is recorded as `unhealthy` with a distinct reason
 *    (`ORIGIN_UNREACHABLE`). That means "we could not reach it right now", NOT
 *    "the provider is permanently offline" and NOT "the credentials are wrong".
 *  - Nothing is simulated. If probing is disabled or unconfigured, the status
 *    stays `unknown` rather than being optimistically set to healthy.
 *
 * Retry discipline: exactly ONE attempt per server per check, a hard timeout,
 * no redirect following, and a cap on how many servers a single sweep probes.
 * The provider origin is currently unavailable and unbounded retries against it
 * are explicitly forbidden, so there is no retry loop here at all.
 *
 * SSRF: the URL is re-validated at probe time (not just at creation), credentials
 * are never placed in the URL, and redirects are refused so a provider cannot
 * bounce the probe (and its credentials) to an internal address.
 */
import { pinnedProviderRequest, ProviderTransportError } from '../../common/pinned-provider-request';
import { isIP } from 'node:net';
import { publicProviderAddress } from '../../common/provider-address';
import { Injectable, Logger } from '@nestjs/common';
import { normalizeStatus, statusFromProbe, type ConnectionStatus } from './xtream-selection';

export type HealthReason =
  | 'OK'
  | 'AUTH_REJECTED'
  | 'ORIGIN_UNREACHABLE'
  | 'HTTP_DISABLED'
  | 'INVALID_URL'
  | 'UNEXPECTED_RESPONSE';

export interface ProbeTarget {
  baseUrl: string;
  username: string;
  password: string;
}

export interface ProbeResult {
  status: ConnectionStatus;
  reason: HealthReason;
  /** Round-trip milliseconds; null when no response was received. */
  latencyMs: number | null;
  httpStatus: number | null;
  checkedAt: Date;
}

const PROBE_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 64 * 1024;
/** Servers probed per sweep, so one request cannot fan out without bound. */
export const MAX_SERVERS_PER_SWEEP = 10;
/** Minimum gap between probes of the same server, to avoid hammering an origin. */
export const MIN_RECHECK_INTERVAL_MS = 60_000;

/** Re-validate a stored URL immediately before use. Mirrors creation-time rules. */
export function probeUrlAllowed(baseUrl: string, allowHttp: boolean): URL | null {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || ['localhost', 'metadata', 'instance-data'].includes(host) ||
      /\.(localhost|local|internal|lan|home|corp|intranet|localdomain)$/.test(host) ||
      (!host.includes('.') && !host.includes(':'))) return null;
  if (isIP(host) && !publicProviderAddress(host)) return null;
  if (url.protocol === 'http:' && !allowHttp) return null;
  return url;
}

@Injectable()
export class XtreamHealthService {
  private readonly logger = new Logger(XtreamHealthService.name);

  /** Whether a previous check is recent enough to reuse instead of re-probing. */
  shouldRecheck(lastCheckedAt: Date | null, now = Date.now()): boolean {
    if (!lastCheckedAt) return true;
    return now - lastCheckedAt.getTime() >= MIN_RECHECK_INTERVAL_MS;
  }

  /**
   * Probe one server with a single bounded attempt.
   *
   * Uses the Xtream `player_api.php` auth handshake, which returns account info
   * only for valid credentials. The response is size-capped and never returned
   * to a client; only the derived status is.
   */
  async probe(target: ProbeTarget, allowHttp = false): Promise<ProbeResult> {
    const checkedAt = new Date();
    const base = probeUrlAllowed(target.baseUrl, allowHttp);
    if (!base || base.protocol !== 'https:') {
      const reason: HealthReason = (base?.protocol === 'http:' || (/^http:\/\//i.test(target.baseUrl) && !allowHttp)) ? 'HTTP_DISABLED' : 'INVALID_URL';
      return { status: 'unhealthy', reason, latencyMs: null, httpStatus: null, checkedAt };
    }

    // Credentials go in the POST body, never the query string, so they cannot
    // land in a proxy access log or a Referer header.
    const endpoint = new URL('/player_api.php', base);
    const body = new URLSearchParams({ username: target.username, password: target.password });
    const started = Date.now();

    let response: Response;
    try {
      response = await pinnedProviderRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof ProviderTransportError && error.code !== 'ORIGIN_UNREACHABLE') {
        return { status: 'unhealthy', reason: error.code, latencyMs: null, httpStatus: null, checkedAt };
      }
      // Unreachable right now. Not a credential verdict, not "permanently offline".
      return { status: 'unhealthy', reason: 'ORIGIN_UNREACHABLE', latencyMs: null, httpStatus: null, checkedAt };
    }

    const latencyMs = Date.now() - started;

    if (!response.ok) await response.body?.cancel().catch(() => {});

    if (response.status === 401 || response.status === 403) {
      return { status: 'unhealthy', reason: 'AUTH_REJECTED', latencyMs, httpStatus: response.status, checkedAt };
    }
    if (!response.ok) {
      return { status: 'unhealthy', reason: 'ORIGIN_UNREACHABLE', latencyMs, httpStatus: response.status, checkedAt };
    }

    let payload: unknown;
    try {
      const size = Number(response.headers.get('content-length'));
      if (size > MAX_RESPONSE_BYTES) { await response.body?.cancel(); throw new Error('TOO_LARGE'); }
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('TOO_LARGE'); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      payload = JSON.parse(text);
    } catch {
      return { status: 'unhealthy', reason: 'UNEXPECTED_RESPONSE', latencyMs, httpStatus: response.status, checkedAt };
    }

    const info = (payload as { user_info?: { auth?: unknown; status?: unknown } } | null)?.user_info;
    // Xtream returns auth=1 for a valid account. Anything else is not healthy.
    const authenticated = Boolean(info) && Number(info?.auth) === 1;
    if (!info) {
      return { status: 'unhealthy', reason: 'UNEXPECTED_RESPONSE', latencyMs, httpStatus: response.status, checkedAt };
    }
    if (!authenticated) {
      return { status: 'unhealthy', reason: 'AUTH_REJECTED', latencyMs, httpStatus: response.status, checkedAt };
    }

    const status = statusFromProbe({ ok: true, authenticated: true });
    // Log the outcome only — never the URL, username, password or response body.
    this.logger.log(`Xtream health probe succeeded in ${latencyMs}ms`);
    return { status, reason: 'OK', latencyMs, httpStatus: response.status, checkedAt };
  }

  /** Coerce a stored status into the known set before using it for ordering. */
  normalize(value: unknown): ConnectionStatus {
    return normalizeStatus(value);
  }
}
