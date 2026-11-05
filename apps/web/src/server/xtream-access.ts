/**
 * Owner-only access control for the private Xtream player.
 *
 * The public Cloud Play site allows anyone to create a free account, so
 * "signed in" is NOT enough to reach a personal IPTV subscription — that would
 * just be the public site with an extra step. Access is therefore restricted to
 * an explicit allow-list of account emails (`XTREAM_OWNER_EMAILS`).
 *
 * Fail-closed: with no allow-list configured, nobody gets in.
 */
import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

export type AccessCode =
  | 'ACCOUNTS_OFF'
  | 'OWNER_NOT_SET'
  | 'SIGN_IN_REQUIRED'
  | 'NOT_AUTHORIZED'
  | 'AUTH_UNAVAILABLE';

export class AccessError extends Error {
  constructor(public code: AccessCode) {
    super(code);
  }
}

/** Lower-cased, de-duplicated owner allow-list. Empty means "deny everyone". */
export function ownerEmails(): string[] {
  const raw = process.env.XTREAM_OWNER_EMAILS ?? '';
  const list = raw
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length > 0 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
  return Array.from(new Set(list));
}

export function ownerConfigured(): boolean {
  return ownerEmails().length > 0;
}

function bearer(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || !value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  // Supabase access tokens are JWTs; reject anything obviously malformed early.
  if (!token || token.length > 4096 || token.split('.').length !== 3) return null;
  return token;
}

/**
 * Verify the caller's Supabase session server-side and confirm the account is
 * an owner. The JWT is validated by Supabase Auth, never trusted from the
 * client payload alone.
 */
export async function requireOwner(req: NextApiRequest): Promise<{ email: string; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AccessError('ACCOUNTS_OFF');

  const owners = ownerEmails();
  if (owners.length === 0) throw new AccessError('OWNER_NOT_SET');

  const token = bearer(req);
  if (!token) throw new AccessError('SIGN_IN_REQUIRED');

  let email: string | null = null;
  let userId = '';
  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) throw new AccessError('SIGN_IN_REQUIRED');
    email = data.user.email ? data.user.email.toLowerCase() : null;
    userId = data.user.id;
  } catch (cause) {
    if (cause instanceof AccessError) throw cause;
    throw new AccessError('AUTH_UNAVAILABLE');
  }

  if (!email || !owners.includes(email)) throw new AccessError('NOT_AUTHORIZED');
  return { email, userId };
}

/** Map an access failure to an HTTP status without leaking which emails exist. */
export function accessStatus(code: AccessCode): number {
  if (code === 'SIGN_IN_REQUIRED') return 401;
  if (code === 'NOT_AUTHORIZED') return 403;
  return 503;
}
