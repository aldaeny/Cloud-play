import type { Request, Response, NextFunction } from 'express';

type Entry = { count: number; resetTime: number };
/** Single-process safety net only. A shared limiter is required behind a load balancer. */
export class BoundedRateLimiter {
  private entries = new Map<string, Entry>();
  private lastCleanup = 0;
  constructor(private readonly windowMs = 60_000, private readonly maxKeys = 10_000) {}
  check(key: string, limit: number, now = Date.now()): { allowed: boolean; retryAfter: number } {
    if (now - this.lastCleanup >= this.windowMs || this.entries.size >= this.maxKeys) {
      for (const [entryKey, value] of this.entries) if (value.resetTime <= now) this.entries.delete(entryKey);
      this.lastCleanup = now;
    }
    const entry = this.entries.get(key);
    if (!entry || entry.resetTime <= now) {
      if (!entry && this.entries.size >= this.maxKeys) return { allowed: false, retryAfter: Math.ceil(this.windowMs / 1000) };
      this.entries.set(key, { count: 1, resetTime: now + this.windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    entry.count += 1;
    return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)) };
  }
}
const limiter = new BoundedRateLimiter();
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Express trust proxy defaults to false. Never trust a client-provided forwarding header by default.
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const general = limiter.check(`general:${ip}`, 100);
  const sensitive = req.method === 'POST' && /^\/auth\/(?:login|register|admin\/login|refresh)\/?$/i.test(req.path);
  const auth = sensitive ? limiter.check(`auth:${ip}`, 10) : { allowed: true, retryAfter: 0 };
  if (!general.allowed || !auth.allowed) {
    const retryAfter = Math.max(general.allowed ? 0 : general.retryAfter, auth.allowed ? 0 : auth.retryAfter);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.', retryAfter });
    return;
  }
  next();
}
