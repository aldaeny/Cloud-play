/**
 * Authenticated requests to owner-only API routes.
 *
 * The Supabase access token is read fresh per call (it refreshes in the
 * background) and sent as a bearer header. The server re-verifies it and checks
 * the owner allow-list; nothing here is a security boundary, only a convenience.
 */
import { getSupabase } from './supabase';

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function ownerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(path, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || 'UPSTREAM_ERROR');
  return body;
}
