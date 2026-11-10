/**
 * Supabase Auth token verification for the Hybrid architecture (D1 Option C).
 *
 * Supabase Auth is the SINGLE source of truth for end-user identity and
 * sessions. This service makes the API a *resource server*: it validates a
 * Supabase-issued access token and never issues, stores or verifies a password.
 *
 * Why call Supabase instead of verifying the JWT locally?
 *  - It is authoritative: a revoked/signed-out session is rejected immediately,
 *    which a locally-verified JWT cannot detect until it expires.
 *  - It works regardless of how the project signs tokens (legacy HS256 secret or
 *    the newer asymmetric signing keys), so no signing secret is copied into
 *    this service and none can leak from it.
 *  - It mirrors the already-proven pattern in
 *    `apps/web/src/server/xtream-access.ts` (`supabase.auth.getUser(token)`),
 *    so web and API agree on what "signed in" means.
 *
 * Trade-off: one upstream round trip per authenticated request. There is
 * deliberately NO result cache here — caching auth decisions would delay
 * revocation. Add one only with an explicit, short, documented TTL.
 *
 * Fail-closed: if Supabase is unconfigured, unreachable, or returns anything
 * unexpected, the caller is NOT authenticated.
 */
import { Injectable, Logger } from '@nestjs/common';

/** Verified identity as returned by Supabase Auth. Never built from client input. */
export interface SupabaseIdentity {
  /** Supabase `auth.users.id` — the stable cross-service user identifier. */
  id: string;
  email: string | null;
  /**
   * Whether Supabase has actually verified this email address.
   * IMPORTANT: with `mailer_autoconfirm = true` Supabase marks new signups
   * confirmed without proving ownership, so this must never be used to link
   * accounts by email. See docs/SERVICE_OWNERSHIP.md.
   */
  emailConfirmed: boolean;
}

export type SupabaseAuthCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'TOKEN_MISSING'
  | 'TOKEN_INVALID'
  | 'AUTH_UNAVAILABLE';

export class SupabaseAuthError extends Error {
  constructor(public readonly code: SupabaseAuthCode) {
    super(code);
    this.name = 'SupabaseAuthError';
  }
}

/** HTTP status for an auth failure, without revealing whether an account exists. */
export function supabaseAuthStatus(code: SupabaseAuthCode): number {
  if (code === 'TOKEN_MISSING' || code === 'TOKEN_INVALID') return 401;
  return 503;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 8000;
/** Supabase access tokens are JWTs; reject obviously malformed input cheaply. */
const MAX_TOKEN_LENGTH = 4096;

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);

  /** True when the API is able to verify Supabase sessions at all. */
  isConfigured(): boolean {
    return Boolean(this.projectUrl() && this.apiKey());
  }

  /**
   * Accept either the server-side or the existing public env names so the API
   * can be configured without renaming what the web app already uses.
   */
  private projectUrl(): string | null {
    const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const value = raw.trim().replace(/\/+$/, '');
    if (!value) return null;
    try {
      const url = new URL(value);
      // Credentials must travel over TLS only; never accept userinfo in the URL.
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (url.pathname !== '/' || url.search || url.hash) return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  private apiKey(): string | null {
    const value = (
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''
    ).trim();
    return value || null;
  }

  /** Extract a bearer token from an Authorization header value. */
  static bearer(header: string | string[] | undefined): string | null {
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || !/^bearer\s+\S+$/i.test(raw.trim())) return null;
    const token = raw.trim().slice(7).trim();
    if (!token || token.length > MAX_TOKEN_LENGTH) return null;
    if (token.split('.').length !== 3) return null;
    return token;
  }

  /**
   * Verify an access token with Supabase Auth and return the verified identity.
   * Throws SupabaseAuthError on any failure — never returns a partial identity.
   */
  async verifyAccessToken(token: string): Promise<SupabaseIdentity> {
    const origin = this.projectUrl();
    const key = this.apiKey();
    if (!origin || !key) throw new SupabaseAuthError('AUTH_NOT_CONFIGURED');

    if (!token || token.length > MAX_TOKEN_LENGTH || token.split('.').length !== 3) {
      throw new SupabaseAuthError('TOKEN_INVALID');
    }

    let response: Response;
    try {
      response = await fetch(`${origin}/auth/v1/user`, {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: 'application/json' },
        // A redirect could forward the bearer token to another origin.
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      // Timeout, DNS, TLS or redirect failure: unavailable, NOT "unauthenticated".
      throw new SupabaseAuthError('AUTH_UNAVAILABLE');
    }

    if (response.status === 401 || response.status === 403) {
      throw new SupabaseAuthError('TOKEN_INVALID');
    }
    if (!response.ok) {
      // Log the status only — never the token, body, or user identifiers.
      this.logger.warn(`Supabase auth verification failed with status ${response.status}`);
      throw new SupabaseAuthError('AUTH_UNAVAILABLE');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new SupabaseAuthError('AUTH_UNAVAILABLE');
    }

    const user = payload as { id?: unknown; email?: unknown; email_confirmed_at?: unknown; confirmed_at?: unknown } | null;
    if (!user || typeof user.id !== 'string' || !UUID.test(user.id)) {
      throw new SupabaseAuthError('AUTH_UNAVAILABLE');
    }

    return {
      id: user.id.toLowerCase(),
      email: typeof user.email === 'string' && user.email ? user.email.toLowerCase() : null,
      emailConfirmed: Boolean(user.email_confirmed_at || user.confirmed_at),
    };
  }
}
