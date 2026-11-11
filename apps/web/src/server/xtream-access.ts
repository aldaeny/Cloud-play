/**
 * Owner-only access control for the private Xtream player.
 *
 * The public Cloud Play site allows anyone to create a free account, so
 * "signed in" is NOT enough to reach a personal IPTV subscription — that would
 * just be the public site with an extra step. Access is therefore restricted to
 * an explicit allow-list of immutable Auth IDs (`XTREAM_OWNER_USER_IDS`).
 * Legacy owner email strings are labels only and never authorize access.
 *
 * Fail-closed: with no allow-list configured, nobody gets in.
 */
import {authorizeMedia,setMediaCookie,MediaAccessError,type MediaBinding} from './private-media-session';
import type {NextApiResponse, NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

export type AccessCode =
  | 'ACCOUNTS_OFF'
  | 'OWNER_NOT_SET'
  | 'SIGN_IN_REQUIRED'
  | 'NOT_AUTHORIZED'
  | 'AUTH_UNAVAILABLE'
  | 'PRIVATE_MEDIA_DENIED'
  | 'TRUSTED_GEO_REQUIRED';

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

/** Immutable verified Auth IDs, never email addresses, grant private access.
 * Autoconfirmed email is not ownership proof and cannot be an ACL principal. */
export function ownerUserIds(): string[] {
  return Array.from(new Set((process.env.XTREAM_OWNER_USER_IDS || '').split(',').map(value => value.trim().toLowerCase())
    .filter(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))));
}
export function ownerConfigured(): boolean {
  return ownerUserIds().length > 0;
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
 * Verify the caller's Supabase session server-side and confirm its immutable user ID is
 * explicitly authorized. The JWT is validated by Supabase Auth, never trusted from the
 * client payload alone.
 */
export async function requireOwner(req: NextApiRequest, res?: NextApiResponse): Promise<{ email: string; userId: string; media?:MediaBinding }> {
  if(process.env.NODE_ENV==='production'){
    try{const media=await authorizeMedia(req,false);if(res)setMediaCookie(req,res,media);return {email:'',userId:media.userId,media};}
    catch(error){if(error instanceof MediaAccessError){if(error.status===401)throw new AccessError('SIGN_IN_REQUIRED');if(error.status===403)throw new AccessError('PRIVATE_MEDIA_DENIED');}throw new AccessError('AUTH_UNAVAILABLE');}
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new AccessError('ACCOUNTS_OFF');

  const owners = ownerUserIds();
  if (owners.length === 0) throw new AccessError('OWNER_NOT_SET');

  const token = bearer(req);
  if (!token) throw new AccessError('SIGN_IN_REQUIRED');

  let origin: string;
  try {
    const target = new URL(url);
    if (target.protocol !== 'https:' || target.username || target.password || target.pathname !== '/' || target.search || target.hash) throw new Error();
    origin = target.origin;
  } catch { throw new AccessError('ACCOUNTS_OFF'); }

  let email: string | null = null;
  let userId = '';
  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => {
        if (new URL(String(input)).origin !== origin) throw new AccessError('AUTH_UNAVAILABLE');
        return fetch(input, { ...init, redirect: 'error', signal: init?.signal
          ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
      } },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) throw new AccessError('SIGN_IN_REQUIRED');
    email = data.user.email ? data.user.email.toLowerCase() : null;
    userId = data.user.id;
  } catch (cause) {
    if (cause instanceof AccessError) throw cause;
    throw new AccessError('AUTH_UNAVAILABLE');
  }

  if (!userId || !owners.includes(userId.toLowerCase())) throw new AccessError('NOT_AUTHORIZED');
  return { email: email || '', userId };
}

/** Map an access failure to an HTTP status without leaking which emails exist. */
export function accessStatus(code: AccessCode): number {
  if (code === 'SIGN_IN_REQUIRED') return 401;
  if (code === 'NOT_AUTHORIZED'||code==='PRIVATE_MEDIA_DENIED'||code==='TRUSTED_GEO_REQUIRED') return 403;
  return 503;
}
