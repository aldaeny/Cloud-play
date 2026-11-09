/**
 * Shared rate limiting for Next.js API routes.
 *
 * SCOPE — read this before relying on it:
 * this is an in-process, per-instance safety net, exactly like the NestJS
 * `BoundedRateLimiter`. On serverless hosting each warm instance keeps its own
 * counters, so the effective global limit is (instances x limit). It blunts
 * single-client abuse and runaway loops; it is NOT a distributed quota. A
 * shared store (Redis/Upstash) or an edge/WAF rule is required for a true global
 * limit. That is documented rather than implied, so nobody treats this as
 * stronger protection than it is.
 *
 * Memory is bounded: keys expire and the map is capped, so a spray of unique
 * IPs cannot exhaust the process. When the cap is reached new keys are refused
 * (fail-closed) instead of evicting live counters.
 *
 * Client identity: `x-forwarded-for` is trusted ONLY when TRUST_PROXY is set,
 * because a client can forge that header. Without it, all callers without a
 * socket address share one conservative bucket, which is safer than trusting a
 * spoofable header.
 */
import type { NextApiRequest, NextApiResponse } from 'next';

interface Entry {
  count: number;
  resetTime: number;
}

export class BoundedRateLimiter {
  private entries = new Map<string, Entry>();
  private lastCleanup = 0;

  constructor(
    private readonly windowMs = 60_000,
    private readonly maxKeys = 10_000,
  ) {}

  /** Number of tracked keys; exposed for tests and diagnostics. */
  get size(): number {
    return this.entries.size;
  }

  check(key: string, limit: number, now = Date.now()): { allowed: boolean; retryAfter: number; remaining: number } {
    if (now - this.lastCleanup >= this.windowMs || this.entries.size >= this.maxKeys) {
      for (const [entryKey, value] of this.entries) {
        if (value.resetTime <= now) this.entries.delete(entryKey);
      }
      this.lastCleanup = now;
    }

    const entry = this.entries.get(key);
    if (!entry || entry.resetTime <= now) {
      if (this.entries.size >= this.maxKeys) {
        return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000), remaining: 0 };
      }
      this.entries.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, retryAfter: 0, remaining: Math.max(0, limit - 1) };
    }

    entry.count += 1;
    return {
      allowed: entry.count <= limit,
      retryAfter: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)),
      remaining: Math.max(0, limit - entry.count),
    };
  }

  reset(): void {
    this.entries.clear();
    this.lastCleanup = 0;
  }
}

/**
 * Per-minute budgets. Streaming is deliberately much higher than catalog reads:
 * an HLS player legitimately requests many segments per minute, and a tight
 * limit there would break playback rather than protect anything.
 */
export const RATE_BUCKETS = {
  /** Static/CDN-cacheable public lists. Origin hits only; CDN hits never arrive. */
  public: 240,
  /** Catalog browsing and session checks. */
  catalog: 120,
  /** Media segments and playlist fetches during active playback. */
  stream: 1800,
  /** Write/import operations, which are also separately owner-limited. */
  write: 30,
} as const;

export type RateBucket = keyof typeof RATE_BUCKETS;

const limiters = new Map<number, BoundedRateLimiter>();

function limiterFor(windowMs: number): BoundedRateLimiter {
  let limiter = limiters.get(windowMs);
  if (!limiter) {
    limiter = new BoundedRateLimiter(windowMs);
    limiters.set(windowMs, limiter);
  }
  return limiter;
}

/** Best-effort client identity. Never trusts a forwarding header by default. */
export function clientKey(req: NextApiRequest): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw?.split(',')[0]?.trim();
    if (first && first.length <= 64) return first;
  }
  const socketAddress = req.socket?.remoteAddress;
  if (socketAddress) return socketAddress;
  // No trustworthy address: one shared conservative bucket rather than a
  // spoofable per-client key.
  return 'shared';
}

export interface RateOptions {
  bucket: RateBucket;
  /** Override the budget, e.g. a stricter per-route write limit. */
  limit?: number;
  windowMs?: number;
}

/**
 * Enforce a budget. Returns true when the request may proceed; when false it
 * has already written a 429 with `Retry-After` and the handler must return.
 */
export function enforceRateLimit(req: NextApiRequest, res: NextApiResponse, options: RateOptions): boolean {
  const windowMs = options.windowMs ?? 60_000;
  const limit = options.limit ?? RATE_BUCKETS[options.bucket];
  const result = limiterFor(windowMs).check(`${options.bucket}:${clientKey(req)}`, limit);

  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));

  if (result.allowed) return true;

  res.setHeader('Retry-After', String(result.retryAfter));
  // A throttled response must never be cached by a CDN.
  res.setHeader('Cache-Control', 'no-store');
  res.status(429).json({ error: 'RATE_LIMITED', retryAfter: result.retryAfter });
  return false;
}

/** Test helper: drop all counters. */
export function resetRateLimits(): void {
  for (const limiter of limiters.values()) limiter.reset();
}
