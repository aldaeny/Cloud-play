/**
 * Live TV section.
 *
 * Data path: GET /api/iptv/live -> channel list (id, name, group, opaque stream
 * id) -> CloudPlayer -> GET /api/stream/<token> -> rewritten manifest -> segments.
 *
 * There is no hardcoded playlist and no placeholder video anywhere in this
 * component. Every row that says "Play" has a real stream id minted by the
 * server from a real playlist entry.
 */
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloudPlayer from '../player/CloudPlayer';
import type { PublicChannel } from '../../server/live/types';

type Language = 'ar' | 'en';
type Region = 'iq' | 'arab' | 'world';

type FeedInfo = { key: string; host: string | null; ok: boolean; error?: string; ms?: number };
type LiveResponse = {
  data: PublicChannel[];
  total: number;
  page: number;
  pageSize: number;
  groups: string[];
  region: Region;
  source: string;
  stale: boolean;
  age: number;
  counts: { total: number; playable: number; blocked: number; duplicates: number; raw: number };
  feeds: FeedInfo[];
};

const FAVORITES_KEY = 'cloudplay-live-favorites-v2';
const REGION_KEY = 'cloudplay-live-region-v1';

const text = {
  ar: {
    title: 'البث المباشر',
    intro: 'قنوات عامة مباشرة من مصدرها. التشغيل يمر عبر خادمنا ليعمل في المتصفح دون قيود CORS.',
    load: 'تحديث القنوات',
    loading: 'جاري تحميل القنوات…',
    refreshing: 'جاري التحديث…',
    search: 'بحث في القنوات',
    searchPlaceholder: 'اكتب اسم القناة',
    allGroups: 'كل التصنيفات',
    favoritesOnly: 'المفضلة فقط',
    availableOnly: 'القابلة للتشغيل فقط',
    count: 'قناة',
    of: 'من',
    playable: 'تشغيل',
    blocked: 'غير متاحة',
    blockedWhy: 'هذه القناة تبث عبر HTTP غير مشفّر أو تتطلب إعدادات مشغّل خاصة.',
    empty: 'لا توجد قنوات مطابقة لبحثك.',
    error: 'تعذّر تحميل قائمة القنوات حالياً.',
    retry: 'إعادة المحاولة',
    pick: 'اختر قناة ثم اضغط تشغيل.',
    stale: 'القائمة معروضة من آخر نسخة ناجحة؛ تعذّر تحديث المصدر الآن.',
    age: 'آخر تحديث منذ',
    seconds: 'ثانية',
    minutes: 'دقيقة',
    hours: 'ساعة',
    regions: { iq: 'العراق', arab: 'العربية', world: 'العالم' },
    source: 'المصدر',
    playableCount: 'قابلة للتشغيل',
    totalCount: 'إجمالي',
    duplicates: 'مكررة أُزيلت',
    favorite: 'إضافة للمفضلة',
    unfavorite: 'إزالة من المفضلة',
    offline: 'المشغّل لم يستطع الوصول إلى هذه القناة الآن. جرّب قناة أخرى أو أعد المحاولة.',
    playerHint: 'التشغيل يتم عبر خادمنا (وسيط HLS) لأن المزوّد لا يسمح بالوصول المباشر من المتصفح.',
  },
  en: {
    title: 'Live TV',
    intro: 'Public channels played from their source. Playback is routed through our server so it works in the browser without CORS problems.',
    load: 'Refresh channels',
    loading: 'Loading channels…',
    refreshing: 'Refreshing…',
    search: 'Search channels',
    searchPlaceholder: 'Enter a channel name',
    allGroups: 'All categories',
    favoritesOnly: 'Favorites only',
    availableOnly: 'Playable only',
    count: 'channels',
    of: 'of',
    playable: 'Play',
    blocked: 'Unavailable',
    blockedWhy: 'This channel streams over plain HTTP or needs special player options.',
    empty: 'No channels match your search.',
    error: 'Unable to load the channel list right now.',
    retry: 'Try again',
    pick: 'Choose a channel, then press play.',
    stale: 'Showing the last successful list; the source could not be refreshed.',
    age: 'Updated',
    seconds: 's ago',
    minutes: 'min ago',
    hours: 'h ago',
    regions: { iq: 'Iraq', arab: 'Arab', world: 'World' },
    source: 'Source',
    playableCount: 'playable',
    totalCount: 'total',
    duplicates: 'duplicates removed',
    favorite: 'Add to favorites',
    unfavorite: 'Remove from favorites',
    offline: 'The player could not reach this channel right now. Try another channel or retry.',
    playerHint: 'Playback goes through our HLS proxy because the provider does not allow direct browser access.',
  },
} as const;

function ageLabel(age: number, t: (typeof text)['ar'] | (typeof text)['en']): string {
  if (!Number.isFinite(age) || age < 0) return '';
  if (age < 90) return `${Math.round(age)} ${t.seconds}`;
  if (age < 5400) return `${Math.round(age / 60)} ${t.minutes}`;
  return `${Math.round(age / 3600)} ${t.hours}`;
}

export default function LiveTv({ language }: { language: Language }) {
  const ar = language === 'ar';
  const t = text[language];

  const [region, setRegion] = useState<Region>('iq');
  const [payload, setPayload] = useState<LiveResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<PublicChannel | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  /* Favorites and the last region are device-local, like the rest of the app. */
  useEffect(() => {
    try {
      const storedFavorites = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      if (Array.isArray(storedFavorites)) {
        Promise.resolve().then(() => setFavorites(storedFavorites.filter((value): value is string => typeof value === 'string').slice(0, 2000)));
      }
      const storedRegion = localStorage.getItem(REGION_KEY);
      if (storedRegion === 'iq' || storedRegion === 'arab' || storedRegion === 'world') {
        Promise.resolve().then(() => setRegion(storedRegion));
      }
    } catch {
      /* Storage is optional. */
    }
  }, []);

  const load = useCallback(
    async (target: Region, refresh = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));
      try {
        const response = await fetch(`/api/iptv/live?region=${target}&pageSize=240${refresh ? '&refresh=1' : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = (await response.json()) as LiveResponse & { error?: string };
        if (!response.ok || !Array.isArray(body.data)) throw new Error(body.error || 'LIVE_FEED_UNAVAILABLE');
        if (controller.signal.aborted) return;
        setPayload(body);
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    },
    [],
  );

  /* Load on mount and whenever the region changes. */
  useEffect(() => {
    void load(region);
    return () => requestRef.current?.abort();
  }, [region, load]);

  function chooseRegion(next: Region) {
    setRegion(next);
    setSelected(null);
    try {
      localStorage.setItem(REGION_KEY, next);
    } catch {
      /* Storage is optional. */
    }
  }

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter((value) => value !== id) : [...favorites, id];
    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* Works for this session. */
    }
  }

  const channels = payload?.data ?? [];
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return channels.filter((channel) => {
      if (availableOnly && !channel.playable) return false;
      if (favoritesOnly && !favorites.includes(channel.id)) return false;
      if (group && channel.group !== group) return false;
      if (needle && !`${channel.name} ${channel.group} ${channel.epgId}`.toLocaleLowerCase().includes(needle)) return false;
      return true;
    });
  }, [channels, query, group, favoritesOnly, availableOnly, favorites]);

  const counts = payload?.counts;
  const groups = payload?.groups ?? [];

  return (
    <div className="live-tv">
      <section className="live-banner">
        <div className="live-banner-copy">
          <span className="live-pill">
            <span className="live-dot" aria-hidden="true" />
            {t.title}
          </span>
          <p>{t.intro}</p>
          {counts && (
            <p className="live-stats" aria-live="polite">
              <span>
                <strong>{counts.total}</strong> {t.totalCount}
              </span>
              <span>
                <strong>{counts.playable}</strong> {t.playableCount}
              </span>
              {counts.duplicates > 0 && (
                <span>
                  <strong>{counts.duplicates}</strong> {t.duplicates}
                </span>
              )}
              {payload && payload.age >= 0 && (
                <span>
                  {t.age} {ageLabel(payload.age, t)}
                </span>
              )}
            </p>
          )}
          {payload?.stale && (
            <p className="live-warning" role="status">
              {t.stale}
            </p>
          )}
        </div>
        <button className="iptv-load" onClick={() => void load(region, true)} disabled={status === 'loading'}>
          {status === 'loading' ? t.loading : t.load}
        </button>
      </section>

      <div className="live-regions" role="tablist" aria-label={t.title}>
        {(['iq', 'arab', 'world'] as Region[]).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={region === value}
            className={region === value ? 'live-region active' : 'live-region'}
            onClick={() => chooseRegion(value)}
          >
            {t.regions[value]}
          </button>
        ))}
      </div>

      <div className="licensed-filters live-filters">
        <label>
          {t.search}
          <input type="search" value={query} maxLength={100} placeholder={t.searchPlaceholder} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          {t.allGroups}
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">{t.allGroups}</option>
            {groups.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button aria-pressed={availableOnly} onClick={() => setAvailableOnly((value) => !value)}>
          {t.availableOnly}
        </button>
        <button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
          {t.favoritesOnly}
        </button>
      </div>

      {status === 'loading' && !channels.length && (
        <div className="tv-skeleton" role="status" aria-label={t.loading}>
          <span />
          <span />
          <span />
          <span />
        </div>
      )}

      {status === 'error' && (
        <p className="firebase-error" role="alert">
          {t.error}{' '}
          <button className="live-inline-button" onClick={() => void load(region)}>
            {t.retry}
          </button>
        </p>
      )}

      {channels.length > 0 && (
        <>
          <p className="iptv-label" aria-live="polite">
            {visible.length} {t.count} {t.of} {channels.length}
            {payload ? ` · ${t.source}: ${payload.source}` : ''}
          </p>
          {visible.length === 0 ? (
            <p className="firebase-note">{t.empty}</p>
          ) : (
            <ul className="live-grid">
              {visible.map((channel) => {
                const isFavorite = favorites.includes(channel.id);
                return (
                  <li key={channel.id} className={selected?.id === channel.id ? 'live-card selected' : 'live-card'}>
                    <button
                      className="live-card-main"
                      disabled={!channel.playable}
                      title={channel.playable ? channel.name : t.blockedWhy}
                      onClick={() => setSelected(channel)}
                    >
                      <span className="live-card-logo">
                        {channel.logo ? (
                          <Image src={channel.logo} alt="" width={40} height={40} unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <span className={channel.playable ? 'live-card-play' : 'live-card-play muted'}>{channel.playable ? '▶' : '—'}</span>
                        )}
                      </span>
                      <span className="live-card-body">
                        <strong>{channel.name}</strong>
                        <small>{channel.group || channel.epgId || '—'}</small>
                      </span>
                      <span className={channel.playable ? 'live-card-state' : 'live-card-state blocked'}>
                        {channel.playable ? t.playable : t.blocked}
                      </span>
                    </button>
                    <button
                      className="licensed-favorite"
                      aria-label={`${isFavorite ? t.unfavorite : t.favorite}: ${channel.name}`}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite(channel.id)}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="firebase-note">{t.playerHint}</p>
          <p className="firebase-note">{t.blockedWhy}</p>
        </>
      )}

      {selected?.stream && (
        <CloudPlayer
          key={selected.id}
          language={language}
          title={selected.name}
          url={selected.stream}
          kind="hls"
          onClose={() => setSelected(null)}
          testId="live-cloud-player"
        />
      )}
    </div>
  );
}
