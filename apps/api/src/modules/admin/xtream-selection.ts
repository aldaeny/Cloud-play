/**
 * Server selection and failover ordering for multi-server Xtream management.
 *
 * Pure functions so the ordering rules can be tested exhaustively without a
 * database or a provider. Nothing here contacts the network.
 *
 * Rules, in order:
 *  1. Only enabled servers are eligible. A disabled server is never selected,
 *     even if it is the configured default.
 *  2. An explicitly chosen default wins, if it is eligible.
 *  3. Otherwise lower `priority` wins (1 is best, like a DNS MX preference).
 *  4. Health breaks ties: healthy > unknown > unhealthy. "unknown" is NOT treated
 *     as failure — a server that has never been probed must still be usable,
 *     otherwise a fresh install could never play anything.
 *  5. Finally a stable tiebreak (name, then id) so ordering is deterministic and
 *     does not flap between requests.
 *
 * Failover produces an ordered candidate list rather than retrying internally,
 * so the caller controls the retry budget. The provider currently has an
 * unavailable origin, and unbounded retries against it are explicitly forbidden.
 */

export type ConnectionStatus = 'unknown' | 'healthy' | 'unhealthy';

export interface SelectableServer {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  connectionStatus: string;
}

/** Lower is better. Unrecognised values are treated as "unknown", not healthy. */
function healthRank(status: string): number {
  if (status === 'healthy') return 0;
  if (status === 'unhealthy') return 2;
  return 1;
}

export function normalizeStatus(value: unknown): ConnectionStatus {
  return value === 'healthy' || value === 'unhealthy' ? value : 'unknown';
}

/**
 * Ordered failover candidates: the preferred server first, then the rest.
 * Disabled servers are excluded entirely.
 */
export function orderServers<T extends SelectableServer>(servers: readonly T[]): T[] {
  return servers
    .filter(server => server.enabled)
    .slice()
    .sort((a, b) => {
      // An eligible default always leads.
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const health = healthRank(a.connectionStatus) - healthRank(b.connectionStatus);
      if (health !== 0) return health;
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    });
}

/** The single best candidate, or null when nothing is enabled. */
export function selectServer<T extends SelectableServer>(servers: readonly T[]): T | null {
  return orderServers(servers)[0] ?? null;
}

/**
 * Bounded failover plan. `maxAttempts` caps how many servers may be tried, so a
 * caller can never loop over an unbounded list against a dead origin.
 */
export function failoverCandidates<T extends SelectableServer>(
  servers: readonly T[],
  maxAttempts = 3,
): T[] {
  const cap = Number.isFinite(maxAttempts) ? Math.max(1, Math.min(10, Math.floor(maxAttempts))) : 1;
  return orderServers(servers).slice(0, cap);
}

/**
 * Decide the next status after a probe.
 *
 * A transport failure (timeout, DNS, 5xx) means "unreachable", which is recorded
 * as unhealthy. An auth rejection means the server IS reachable but the
 * credentials were refused; that is also unhealthy, and must never be reported
 * as healthy. Only an actual successful, authenticated response is healthy.
 */
export function statusFromProbe(probe: { ok: boolean; authenticated: boolean }): ConnectionStatus {
  return probe.ok && probe.authenticated ? 'healthy' : 'unhealthy';
}

export const MIN_PRIORITY = 1;
export const MAX_PRIORITY = 1000;

export function isValidPriority(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_PRIORITY && value <= MAX_PRIORITY;
}
