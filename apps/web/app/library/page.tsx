'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { VideoPlayerModal } from '../../src/components/player/VideoPlayerModal';
import { getStreamType } from '../../src/lib/player-utils';
import { categoryOf, qualityOf } from '../../src/lib/channels';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs } from '../../src/lib/preferences';
import type { Channel } from '../../src/types/channel';

type Row = { id: string; title: string; year: string; poster: string };
type Details = { id: string; title: string; year: string; description: string; url: string; poster: string };
type Enrich = { found?: boolean; name?: string; overview?: string; poster?: string };

const PAGE_SIZE = 40;
const FAVORITES = 'cloudplay-library-favorites-v1';

const T = {
  ar: {
    heading: 'مكتبة الأفلام الكاملة',
    intro: 'آلاف الأفلام الطويلة من الملك العام على Internet Archive — ابحث وشاهد مباشرة. الأسماء العربية والبوسترات والأوصاف تُثرَى من TMDB عندما يتوفر مفتاحه.',
    search: 'ابحث عن فيلم بالإنجليزية…',
    loading: 'جاري تحميل المكتبة…', loadingMore: 'جاري تحميل المزيد…',
    failed: 'تعذّر تحميل المكتبة الآن. حاول بعد قليل.', retry: 'إعادة المحاولة',
    empty: 'لا توجد نتائج مطابقة. جرّب اسماً بالإنجليزية.',
    loadMore: 'تحميل المزيد', remaining: 'فيلم إضافي', count: 'فيلم',
    play: 'تشغيل الفيلم', addFav: 'إضافة للمفضلة', removeFav: 'إزالة من المفضلة',
    loadingDetails: 'جاري تجهيز الفيلم…',
    detailsFailed: 'تعذر تجهيز هذا الفيلم — قد لا يحتوي ملفاً قابلاً للتشغيل.',
    source: 'المصدر', archive: 'Internet Archive',
    tmdbNote: 'الاسم والصورة والوصف بالعربية من TMDB عندما تتوفر ترجمة.',
    favNote: 'المفضلة محفوظة على هذا الجهاز.',
    moviesPage: 'مكتبة المشغّل',
  },
  en: {
    heading: 'Full film library',
    intro: 'Thousands of full-length public-domain films on Internet Archive — search and watch instantly. Arabic names, posters and descriptions are enriched from TMDB when its key is set.',
    search: 'Search films…',
    loading: 'Loading library…', loadingMore: 'Loading more…',
    failed: 'Could not load the library right now. Try again shortly.', retry: 'Retry',
    empty: 'No matching results. Try an English title.',
    loadMore: 'Load more', remaining: 'more films', count: 'films',
    play: 'Play film', addFav: 'Add favorite', removeFav: 'Remove favorite',
    loadingDetails: 'Preparing film…',
    detailsFailed: 'This film could not be prepared — it may have no playable file.',
    source: 'Source', archive: 'Internet Archive',
    tmdbNote: 'Arabic name, poster and overview from TMDB when a translation exists.',
    favNote: 'Favorites are stored on this device.',
    moviesPage: 'Operator library',
  },
};

export default function LibraryPage() {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const t = T[prefs.language];
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [detailsId, setDetailsId] = useState('');
  const [details, setDetails] = useState<Details | null>(null);
  const [enrich, setEnrich] = useState<Enrich | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsFailed, setDetailsFailed] = useState(false);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = JSON.parse(localStorage.getItem(FAVORITES) || '[]');
      return Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : [];
    } catch { return []; }
  });
  const [broken, setBroken] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);

  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { document.title = `${t.heading} | Cloud Play Iraq`; }, [t.heading]);

  const load = useCallback(async (nextPage: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setFailed(false);
    try {
      const params = new URLSearchParams({ page: String(nextPage) });
      if (debounced) params.set('q', debounced);
      const response = await fetch(`/api/archive?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('bad status');
      const body = await response.json();
      const data: Row[] = Array.isArray(body.data) ? body.data : [];
      setRows(prev => nextPage === 1 ? data : [...prev, ...data]);
      setTotal(Number(body.total) || 0);
      setPage(nextPage);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { setFailed(true); if (nextPage === 1) setRows([]); }
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }, [debounced]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  useEffect(() => { void load(1); return () => request.current?.abort(); }, [load]);

  // Open a film: resolve its playable file server-side, then ask TMDB for the Arabic display.
  const open = useCallback(async (row: Row) => {
    setDetailsId(row.id); setDetails(null); setEnrich(null); setDetailsFailed(false); setDetailsLoading(true);
    try {
      const response = await fetch(`/api/archive?id=${encodeURIComponent(row.id)}`);
      if (!response.ok) throw new Error('bad status');
      const body = await response.json();
      if (!body.url) throw new Error('no file');
      setDetails(body as Details);
      const tmdb = await fetch(`/api/tmdb/enrich?title=${encodeURIComponent(body.title || row.title)}&year=${encodeURIComponent(body.year || row.year)}&kind=movie`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      if (tmdb && tmdb.configured && tmdb.found) setEnrich(tmdb as Enrich);
    } catch { setDetailsFailed(true); }
    finally { setDetailsLoading(false); }
  }, []);

  function play() {
    if (!details) return;
    const name = (enrich?.found && enrich.name) || details.title;
    setPlaying({
      id: details.id, name,
      logo: (enrich?.found && enrich.poster) || details.poster || '',
      streamUrl: details.url, streamType: getStreamType(details.url) ?? 'mp4',
      category: categoryOf('movie', name), sourceGroup: 'movie',
      country: '', countryCode: '', language: '',
      ...qualityOf(name), isLive: false, playable: true, epgId: '',
    });
  }

  function toggleFavorite(id: string) {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      try { localStorage.setItem(FAVORITES, JSON.stringify(next)); } catch { /* Session only. */ }
      return next;
    });
  }

  const displayName = details ? ((enrich?.found && enrich.name) || details.title) : '';
  const displayPoster = details ? ((enrich?.found && enrich.poster) || details.poster) : '';
  const displayOverview = details ? ((enrich?.found && enrich.overview) || details.description) : '';

  return <main className="live-page shell">
    <div className="live-heading"><div><h1>{t.heading}</h1><p>{t.intro}</p></div><Link className="live-chip live-favorite-toggle" href="/movies">{t.moviesPage}</Link></div>
    <div className="ptv-controls">
      <input className="ptv-search" type="search" value={query} maxLength={100} onChange={e => setQuery(e.target.value.slice(0, 100))} placeholder={t.search} aria-label={t.search} />
    </div>

    {details && <section className="live-open-sources" role="region" aria-label={displayName}>
      <div className="tw-flex tw-gap-4 tw-items-start tw-flex-wrap">
        {displayPoster ? <Image className="library-poster" src={displayPoster} alt="" width={160} height={240} unoptimized /> : null}
        <div className="tw-flex-1">
          <h2>{displayName}{details.year ? ` · ${details.year}` : ''}</h2>
          {displayOverview ? <p className="library-overview">{displayOverview}</p> : null}
          <div className="tw-flex tw-gap-2 tw-flex-wrap">
            <button type="button" className="live-button primary" onClick={play}>▶ {t.play}</button>
            <button type="button" className={`live-button${favorites.includes(details.id) ? ' selected' : ''}`} aria-pressed={favorites.includes(details.id)} onClick={() => toggleFavorite(details.id)}>{favorites.includes(details.id) ? `★ ${t.removeFav}` : `☆ ${t.addFav}`}</button>
          </div>
          <p className="ptv-note">{t.tmdbNote}</p>
        </div>
      </div>
    </section>}
    {detailsLoading && <p className="ptv-note" role="status">{t.loadingDetails}</p>}
    {detailsFailed && <p className="ptv-error" role="alert">{t.detailsFailed}</p>}

    <div aria-live="polite" aria-busy={loading}>
      {failed ? <p className="ptv-error" role="alert">{t.failed} <button type="button" className="live-button" onClick={() => void load(1)}>{t.retry}</button></p> : null}
      {!failed && rows.length === 0 && !loading && <p className="ptv-note">{t.empty}</p>}
      {total > 0 && <p className="ptv-count">{rows.length >= total ? total : `${rows.length} / ${total}`} {t.count}</p>}
    </div>

    <div className="ptv-grid">
      {rows.map(row => {
        const isFavorite = favorites.includes(row.id);
        const posterBroken = broken.includes(row.id);
        return (
          <div className="ptv-card" key={row.id}>
            <button className="ptv-open" onClick={() => void open(row)}>
              {row.poster && !posterBroken
                ? <span className="ctv-logo"><Image src={row.poster} alt="" fill unoptimized sizes="160px" onError={() => setBroken(prev => prev.includes(row.id) ? prev : [...prev, row.id])} /></span>
                : <span className="ptv-flag" aria-hidden="true">🎬</span>}
              <strong className="ptv-name">{row.title}</strong>
              <small className="ptv-owner">{row.year}</small>
              <span className="ptv-play">▶ {t.play}</span>
            </button>
            <button type="button" className="ptv-fav" aria-pressed={isFavorite} aria-label={`${isFavorite ? t.removeFav : t.addFav}: ${row.title}`} onClick={() => toggleFavorite(row.id)}>{isFavorite ? '★' : '☆'}</button>
          </div>
        );
      })}
    </div>

    {loading && rows.length > 0 && <p className="ptv-note" role="status">{t.loadingMore}</p>}
    {!loading && rows.length > 0 && rows.length < total && <button type="button" className="live-button" onClick={() => void load(page + 1)}>{t.loadMore} · {total - rows.length} {t.remaining}</button>}
    <p className="ptv-note ptv-footnote">{t.source}: <a href="https://archive.org/details/feature_films" target="_blank" rel="noopener noreferrer">{t.archive} ↗</a> · {t.favNote}</p>
    {playing && <VideoPlayerModal key={playing.id} channel={playing} language={prefs.language} favorite={favorites.includes(playing.id)} onFavoriteToggle={() => toggleFavorite(playing.id)} onClose={() => setPlaying(null)} />}
  </main>;
}
