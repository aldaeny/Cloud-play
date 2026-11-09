import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '../../lib/supabase';
import { useAccount } from '../account/AccountProvider';
import PlaylistImport from './PlaylistImport';
import { matchesSearch } from '../../lib/search-normalize';

type Language = 'ar' | 'en';
type Kind = 'live' | 'movie' | 'series';
type Group = { id: string; name: string };
type Item = { id: string; name: string; icon?: string; ext?: string; season?: string; episode?: string };
type AccountStatus = { status: string; expiresAt: number | null; activeConnections: number | null; maxConnections: number | null };
type Playing = { url: string; name: string; hls: boolean; kind: Kind; container: string };
type Gate = 'loading' | 'ready' | 'guest' | 'denied' | 'unconfigured';

const T = {
  ar: {
    title: 'مشغّلي الخاص',
    subtitle: 'قنوات وأفلام ومسلسلات من سيرفرك أنت. هذه الصفحة خاصة بحسابك ولا تظهر لبقية الزوار.',
    live: 'قنوات مباشرة', movie: 'أفلام', series: 'مسلسلات',
    groups: 'التصنيفات', search: 'ابحث بالاسم…', back: 'رجوع للتصنيفات',
    episodes: 'الحلقات', season: 'الموسم', episode: 'حلقة',
    play: 'تشغيل', close: 'إغلاق', loading: 'جاري التحميل…', retry: 'إعادة المحاولة',
    emptyGroups: 'لم يُرجع السيرفر تصنيفات.', emptyItems: 'لا توجد عناصر في هذا التصنيف.',
    noResults: 'لا نتائج مطابقة للبحث.', pickGroup: 'اختر تصنيفاً لعرض محتواه.',
    signInTitle: 'هذه الصفحة خاصة', signInBody: 'سجّل الدخول بحساب المالك لفتح مشغّلك الخاص.',
    signIn: 'تسجيل الدخول', deniedTitle: 'غير مصرّح',
    deniedBody: 'هذا الحساب ليس ضمن قائمة المالكين لهذا المشغّل.',
    unconfiguredTitle: 'المشغّل غير مهيأ', unconfiguredBody: 'أكمل إعداد متغيرات البيئة على السيرفر أولاً.',
    expires: 'ينتهي الاشتراك', connections: 'الاتصالات', status: 'الحالة',
    privateNote: 'بيانات الدخول تبقى على السيرفر فقط، والتشغيل يمر عبر وكيل مشفّر.',
    playerError: 'تعذّر تشغيل هذا المصدر. قد يكون غير متاح أو بصيغة لا يدعمها المتصفح.',
    formatNote: 'صيغة الملف قد لا يدعمها المتصفح؛ جرّب عنصراً آخر بصيغة MP4.',
  },
  en: {
    title: 'My private player',
    subtitle: 'Live channels, movies and series from your own server. This page is private to your account.',
    live: 'Live TV', movie: 'Movies', series: 'Series',
    groups: 'Categories', search: 'Search by name…', back: 'Back to categories',
    episodes: 'Episodes', season: 'Season', episode: 'Episode',
    play: 'Play', close: 'Close', loading: 'Loading…', retry: 'Try again',
    emptyGroups: 'The server returned no categories.', emptyItems: 'Nothing in this category.',
    noResults: 'No matches for your search.', pickGroup: 'Pick a category to browse its content.',
    signInTitle: 'This page is private', signInBody: 'Sign in with the owner account to open your player.',
    signIn: 'Sign in', deniedTitle: 'Not authorized',
    deniedBody: 'This account is not on the owner list for this player.',
    unconfiguredTitle: 'Player not configured', unconfiguredBody: 'Finish the server environment setup first.',
    expires: 'Subscription ends', connections: 'Connections', status: 'Status',
    privateNote: 'Credentials stay on the server; playback goes through an encrypted proxy.',
    playerError: 'This source could not be played. It may be offline or in a format the browser cannot decode.',
    formatNote: 'This container may not be browser-playable; try an MP4 title instead.',
  },
};

const ERRORS: Record<Language, Record<string, string>> = {
  ar: {
    DISABLED: 'الربط معطّل على السيرفر.', NOT_CONFIGURED: 'بيانات الاتصال غير مكتملة.',
    HTTP_DISABLED: 'HTTP غير مفعّل في الإعدادات.', UPSTREAM_BLOCKED: 'السيرفر رفض الاتصال — تحقّق من الحساب.',
    UPSTREAM_ERROR: 'تعذّر الاتصال بالسيرفر.', INVALID_INPUT: 'طلب غير صالح.',
    RATE_LIMIT: 'طلبات كثيرة، انتظر دقيقة.', SIGN_IN_REQUIRED: 'يلزم تسجيل الدخول.',
    NOT_AUTHORIZED: 'هذا الحساب غير مصرّح.', OWNER_NOT_SET: 'لم يُحدَّد حساب المالك بعد.',
    ACCOUNTS_OFF: 'نظام الحسابات غير مهيأ.', AUTH_UNAVAILABLE: 'تعذّر التحقق من الحساب.',
  },
  en: {
    DISABLED: 'The integration is disabled on the server.', NOT_CONFIGURED: 'Connection settings are incomplete.',
    HTTP_DISABLED: 'HTTP is not enabled in settings.', UPSTREAM_BLOCKED: 'The server rejected the connection — check the account.',
    UPSTREAM_ERROR: 'Could not reach the server.', INVALID_INPUT: 'Invalid request.',
    RATE_LIMIT: 'Too many requests, wait a minute.', SIGN_IN_REQUIRED: 'Sign-in required.',
    NOT_AUTHORIZED: 'This account is not authorized.', OWNER_NOT_SET: 'No owner account configured yet.',
    ACCOUNTS_OFF: 'Accounts are not configured.', AUTH_UNAVAILABLE: 'Could not verify the account.',
  },
};

async function accessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = await accessToken();
  const response = await fetch(path, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) throw new Error(body?.error || 'UPSTREAM_ERROR');
  return body;
}

/** HLS via hls.js where needed, native HLS on Safari, progressive otherwise. */
function PrivateVideo({ source, onError }: { source: Playing; onError: (message: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let disposed = false;
    let hls: { destroy: () => void } | null = null;

    if (!source.hls) {
      video.src = source.url;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.url;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    void import('hls.js').then(({ default: Hls }) => {
      if (disposed) return;
      if (!Hls.isSupported()) {
        onError('HLS_UNSUPPORTED');
        return;
      }
      const instance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hls = instance;
      instance.loadSource(source.url);
      instance.attachMedia(video);
      instance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) onError('PLAYBACK_FAILED');
      });
    }).catch(() => onError('HLS_UNSUPPORTED'));

    return () => {
      disposed = true;
      hls?.destroy();
      video.removeAttribute('src');
      video.load();
    };
  }, [source, onError]);

  return <video ref={ref} className="pp-video" controls autoPlay playsInline />;
}

export default function PrivatePlayer({ language }: { language: Language }) {
  const t = T[language];
  const { user, loading: accountLoading } = useAccount();
  const [gate, setGate] = useState<Gate>('loading');
  const [reason, setReason] = useState('');
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [kind, setKind] = useState<Kind>('live');
  const [groups, setGroups] = useState<Group[]>([]);
  const [category, setCategory] = useState<Group | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [series, setSeries] = useState<Item | null>(null);
  const [episodes, setEpisodes] = useState<Item[]>([]);
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [filter, setFilter] = useState('');
  const requestId = useRef(0);

  const message = useCallback((code: string) => ERRORS[language][code] || ERRORS[language].UPSTREAM_ERROR, [language]);

  // Gate: ask the server whether THIS account owns the player.
  useEffect(() => {
    if (accountLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await apiGet<{ owner: boolean; reason?: string; account?: AccountStatus | null }>('/api/xtream/session');
        if (cancelled) return;
        if (result.owner) {
          setGate('ready');
          setAccount(result.account ?? null);
        } else {
          const code = result.reason || 'SIGN_IN_REQUIRED';
          setReason(code);
          setGate(code === 'SIGN_IN_REQUIRED' ? 'guest' : code === 'NOT_AUTHORIZED' ? 'denied' : 'unconfigured');
        }
      } catch (cause) {
        if (cancelled) return;
        setReason(cause instanceof Error ? cause.message : 'AUTH_UNAVAILABLE');
        setGate('unconfigured');
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, accountLoading]);

  // Load categories whenever the tab changes and access is granted.
  useEffect(() => {
    if (gate !== 'ready') return;
    let cancelled = false;
    const current = ++requestId.current;
    void (async () => {
      setBusy(true);
      setError('');
      setGroups([]);
      setCategory(null);
      setItems([]);
      setSeries(null);
      setEpisodes([]);
      setFilter('');
      try {
        const result = await apiGet<{ data: Group[] }>(`/api/xtream/catalog?kind=${kind}&view=groups`);
        if (!cancelled && current === requestId.current) setGroups(result.data ?? []);
      } catch (cause) {
        if (!cancelled && current === requestId.current) setError(cause instanceof Error ? cause.message : 'UPSTREAM_ERROR');
      } finally {
        if (!cancelled && current === requestId.current) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind, gate]);

  const openCategory = useCallback(async (group: Group) => {
    const current = ++requestId.current;
    setBusy(true);
    setError('');
    setCategory(group);
    setItems([]);
    setSeries(null);
    setEpisodes([]);
    setFilter('');
    try {
      const result = await apiGet<{ data: Item[] }>(`/api/xtream/catalog?kind=${kind}&view=items&category=${encodeURIComponent(group.id)}`);
      if (current === requestId.current) setItems(result.data ?? []);
    } catch (cause) {
      if (current === requestId.current) setError(cause instanceof Error ? cause.message : 'UPSTREAM_ERROR');
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }, [kind]);

  const openSeries = useCallback(async (item: Item) => {
    const current = ++requestId.current;
    setBusy(true);
    setError('');
    setSeries(item);
    setEpisodes([]);
    try {
      const result = await apiGet<{ data: Item[] }>(`/api/xtream/catalog?kind=series&view=episodes&series=${encodeURIComponent(item.id)}`);
      if (current === requestId.current) setEpisodes(result.data ?? []);
    } catch (cause) {
      if (current === requestId.current) setError(cause instanceof Error ? cause.message : 'UPSTREAM_ERROR');
    } finally {
      if (current === requestId.current) setBusy(false);
    }
  }, []);

  const play = useCallback(async (item: Item, playKind: Kind) => {
    setPlayerError('');
    setError('');
    try {
      const result = await apiGet<{ url: string; hls: boolean; container: string }>(
        `/api/xtream/play?kind=${playKind}&id=${encodeURIComponent(item.id)}&ext=${encodeURIComponent(item.ext ?? '')}`,
      );
      setPlaying({ url: result.url, name: item.name, hls: result.hls, kind: playKind, container: result.container });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'UPSTREAM_ERROR');
    }
  }, []);

  const onPlayerError = useCallback(() => setPlayerError('PLAYER'), []);

  const visible = useMemo(
    () => items.filter(item => matchesSearch(item.name, filter)),
    [items, filter],
  );

  if (gate === 'loading') {
    return <div className="pp-gate" role="status"><p>{t.loading}</p></div>;
  }

  if (gate !== 'ready') {
    const heading = gate === 'guest' ? t.signInTitle : gate === 'denied' ? t.deniedTitle : t.unconfiguredTitle;
    const body = gate === 'guest' ? t.signInBody : gate === 'denied' ? t.deniedBody : `${t.unconfiguredBody}${reason ? ` (${message(reason)})` : ''}`;
    return (
      <div className="pp-gate">
        <h2>{heading}</h2>
        <p>{body}</p>
        {gate === 'guest' && <Link className="pp-primary" href="/login">{t.signIn}</Link>}
      </div>
    );
  }

  const list = series ? episodes : visible;

  return (
    <div className="pp">
      <div className="pp-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        {account && (
          <dl className="pp-account">
            <div><dt>{t.status}</dt><dd>{account.status}</dd></div>
            {account.expiresAt && <div><dt>{t.expires}</dt><dd>{new Date(account.expiresAt).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-GB')}</dd></div>}
            {account.maxConnections !== null && <div><dt>{t.connections}</dt><dd>{account.activeConnections ?? 0} / {account.maxConnections}</dd></div>}
          </dl>
        )}
      </div>

      <div className="pp-tabs" role="tablist">
        {(['live', 'movie', 'series'] as Kind[]).map(value => (
          <button key={value} role="tab" aria-selected={kind === value} className={kind === value ? 'pp-tab selected' : 'pp-tab'} onClick={() => setKind(value)}>
            {t[value]}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {error && <p className="pp-error">{message(error)}</p>}
        {busy && <p className="pp-note">{t.loading}</p>}
      </div>

      {!category && !busy && groups.length === 0 && !error && <p className="pp-note">{t.emptyGroups}</p>}

      {!category && groups.length > 0 && (
        <>
          <p className="pp-label">{t.groups} · {groups.length}</p>
          <div className="pp-groups">
            {groups.map(group => (
              <button key={group.id} className="pp-group" onClick={() => void openCategory(group)}>{group.name}</button>
            ))}
          </div>
        </>
      )}

      {category && (
        <>
          <div className="pp-toolbar">
            <button className="pp-ghost" onClick={() => {
              if (series) { setSeries(null); setEpisodes([]); return; }
              setCategory(null); setItems([]); setFilter('');
            }}>
              ← {series ? category.name : t.back}
            </button>
            <strong>{series ? series.name : category.name}</strong>
            {!series && (
              <input className="pp-search" value={filter} onChange={event => setFilter(event.target.value)} placeholder={t.search} aria-label={t.search} />
            )}
          </div>

          {!busy && list.length === 0 && !error && <p className="pp-note">{filter ? t.noResults : series ? t.episodes : t.emptyItems}</p>}

          <div className={series || kind === 'live' ? 'pp-rows' : 'pp-grid'}>
            {list.map(item => (
              <button
                key={`${item.id}-${item.episode ?? ''}`}
                className={series || kind === 'live' ? 'pp-row' : 'pp-card'}
                onClick={() => {
                  if (kind === 'series' && !series) void openSeries(item);
                  else void play(item, kind === 'series' ? 'series' : kind);
                }}
              >
                {item.icon
                  ? <img className="pp-art" src={item.icon} alt="" loading="lazy" />
                  : <span className="pp-art pp-art-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>}
                <span className="pp-name">
                  {series && item.season ? `${t.season} ${item.season} · ${t.episode} ${item.episode} — ${item.name}` : item.name}
                </span>
                <span className="pp-play">{kind === 'series' && !series ? t.episodes : t.play}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="pp-note pp-footnote">{t.privateNote}</p>

      <PlaylistImport language={language} />

      {playing && (
        <div className="pp-modal" role="dialog" aria-modal="true" aria-label={playing.name}>
          <div className="pp-modal-inner">
            <div className="pp-modal-head">
              <strong>{playing.name}</strong>
              <button className="pp-ghost" onClick={() => { setPlaying(null); setPlayerError(''); }}>{t.close} ✕</button>
            </div>
            <PrivateVideo source={playing} onError={onPlayerError} />
            {playerError && <p className="pp-error">{t.playerError}</p>}
            {!playing.hls && playing.container !== 'mp4' && <p className="pp-note">{t.formatNote}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
