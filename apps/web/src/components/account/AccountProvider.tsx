'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { accountsConfigured, getSupabase } from '../../lib/supabase';
import { LIBRARY_EVENT } from '../../lib/preferences';
import { clearCloudLibrary, mergeCloudIntoLocal, pushLocalToCloud } from '../../lib/library-sync';

export type AccountUser = { id: string; email: string | null };

type AccountContextValue = {
  configured: boolean;
  loading: boolean;
  user: AccountUser | null;
  syncState: 'idle' | 'syncing' | 'synced' | 'error';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /**
   * True while the visitor arrived from a password-recovery link and must choose
   * a new password before continuing. Supabase grants a temporary session for
   * this; without a completion step the user is signed in but cannot change the
   * password they just reset.
   */
  recoveryActive: boolean;
  updatePassword: (password: string) => Promise<void>;
  clearAccountLibrary: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

function toAccountUser(user: User | null | undefined): AccountUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * Free Cloud Play account provider.
 *
 * Supabase Auth handles email/password sign-in and sign-up. There is no
 * payment step. Once signed in, the device library (favorites + watch
 * progress) is merged with the user's cloud rows and kept in sync.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(accountsConfigured);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [recoveryActive, setRecoveryActive] = useState(false);
  const pushTimer = useRef<number | null>(null);
  const userId = session?.user?.id ?? null;

  const runSync = useCallback(async (id: string, merge: boolean) => {
    setSyncState('syncing');
    try {
      if (merge) await mergeCloudIntoLocal(id);
      await pushLocalToCloud(id);
      setSyncState('synced');
    } catch {
      setSyncState('error');
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      // Defer so we never call setState synchronously in the effect body.
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
      if (data.session?.user) void runSync(data.session.user.id, true);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
      // Supabase emits this when the visitor opens a password-recovery link.
      // The temporary session it grants exists so the user can choose a new
      // password; surface that state so the UI can ask for one.
      if (event === 'PASSWORD_RECOVERY') setRecoveryActive(true);
      if (event === 'SIGNED_IN' && nextSession?.user) void runSync(nextSession.user.id, true);
      if (event === 'SIGNED_OUT') {
        setSyncState('idle');
        setRecoveryActive(false);
      }
    });
    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [runSync]);

  // Debounced push whenever the local library changes while signed in.
  useEffect(() => {
    if (!userId) return;
    const schedule = () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
      pushTimer.current = window.setTimeout(() => { void runSync(userId, false); }, 900);
    };
    window.addEventListener(LIBRARY_EVENT, schedule);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, schedule);
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [userId, runSync]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Accounts are not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Accounts are not configured.');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Accounts are not configured.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }, []);

  /**
   * Complete password recovery (or change a password while signed in).
   *
   * Supabase Auth remains the only credential authority: this calls
   * `auth.updateUser` on the recovery session and never stores a password
   * ourselves. The recovery flag is cleared only after Supabase confirms the
   * change, so a failed attempt cannot silently drop the user back into the app
   * with the old password still in place.
   */
  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Accounts are not configured.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecoveryActive(false);
  }, []);

  const clearAccountLibrary = useCallback(async () => {
    if (!userId) return;
    await clearCloudLibrary(userId);
    setSyncState('synced');
  }, [userId]);

  const value = useMemo<AccountContextValue>(() => ({
    configured: accountsConfigured,
    loading,
    user: toAccountUser(session?.user),
    syncState,
    signIn,
    signUp,
    signOut,
    resetPassword,
    recoveryActive,
    updatePassword,
    clearAccountLibrary,
  }), [loading, session, syncState, signIn, signUp, signOut, resetPassword, recoveryActive, updatePassword, clearAccountLibrary]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    return {
      configured: accountsConfigured,
      loading: false,
      user: null,
      syncState: 'idle',
      signIn: async () => { throw new Error('Account provider missing.'); },
      signUp: async () => { throw new Error('Account provider missing.'); },
      signOut: async () => {},
      resetPassword: async () => { throw new Error('Account provider missing.'); },
      recoveryActive: false,
      updatePassword: async () => { throw new Error('Account provider missing.'); },
      clearAccountLibrary: async () => {},
    };
  }
  return ctx;
}
