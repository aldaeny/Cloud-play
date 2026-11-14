'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useNavigation } from '../navigation/NavigationProvider';
import { getSupabase } from '../../lib/supabase';
import { useAccount } from '../account/AccountProvider';

type Language = 'ar' | 'en';

/**
 * One-tap entry to the private player, shown ONLY to the owner account.
 *
 * Anonymous visitors never trigger a request: we bail out before fetching when
 * nobody is signed in, so the public site pays no cost for this. The answer is
 * cached per user id for the lifetime of the page session, so navigating
 * between sections does not re-ask the server.
 */
const decisions = new Map<string, boolean>();

export default function OwnerPlayerLink({ language }: { language: Language }) {
  const { user, loading } = useAccount();
  const navigation = useNavigation();
  const userId = user?.id ?? null;
  const [owner, setOwner] = useState(() => (userId ? decisions.get(userId) === true : false));

  useEffect(() => {
    if (loading || !userId) return;
    const cached = decisions.get(userId);
    if (cached !== undefined) {
      Promise.resolve().then(() => setOwner(cached));
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase!.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch('/api/xtream/session', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await response.json()) as { owner?: boolean };
        const answer = body.owner === true;
        decisions.set(userId, answer);
        if (!cancelled) setOwner(answer);
      } catch {
        // Stay hidden on any failure — this is an enhancement, never a blocker.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, loading]);

  if (navigation.pathname === '/my-tv') return null;

  const ar = language === 'ar';
  return (
    <Link href="/my-tv" className="owner-link">
      <span className="owner-link-mark" aria-hidden="true">▶</span>
      <span className="owner-link-text">
        <strong>{ar ? 'مشغل البث المباشر والأفلام' : 'IPTV Player & Cinema'}</strong>
        <small>{ar ? 'قنوات وأفلام ومسلسلات السيرفر المباشرة مجاناً' : 'Server channels, movies & series'}</small>
      </span>
      <span className="owner-link-arrow" aria-hidden="true">{ar ? '←' : '→'}</span>
    </Link>
  );
}
