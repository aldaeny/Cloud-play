import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-only Supabase client for the free Cloud Play account.
 * The publishable/anon key is safe to expose in the browser; every table is
 * protected by row-level security so a signed-in user can only read/write
 * their own favorites and watch progress.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const accountsConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!accountsConfigured || typeof window === 'undefined') return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-cloudplay-auth',
      },
    });
  }
  return client;
}
