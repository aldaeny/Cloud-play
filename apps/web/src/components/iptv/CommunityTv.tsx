import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import MediaViewer from '../player/MediaViewer';
import { LIBRARY_EVENT, notifyLibraryChanged } from '../../lib/preferences';
import { countryFlag } from '../../lib/country-flag';
import type { CommunityChannel, CommunityFacet } from '../../server/community-tv';

type Language = 'ar' | 'en';

const FAVORITES = 'cloudplay-tv-favorites-v1';
const PAGE = 60;

const T = {
  ar: {
    heading: 'الدليل العالمي',
    intro: 'قنوات من دليل iptv-org المفتوح الذي يجمعه المجتمع. لم نتحقق من كل قناة على حدة، فبعضها قد لا يعمل في منطقتك أو يتوقف مؤقتاً.',
    search: 'ابحث عن قناة…', country: 'كل الدول', allCategories: 'كل التصنيفات',
    favoritesOnly: 'المفضلة فقط', loading: 'جاري تحميل الدليل…',
    failed: 'تعذّر تحميل الدليل العالمي حالياً. حاول بعد قليل.',
    retry: 'إعادة المحاولة', empty: 'لا توجد قنوات مطابقة.',
    loadMore: 'تحميل المزيد', remaining: 'قناة إضافية',
    count: 'قناة', play: 'تشغيل', addFav: 'إضافة للمفضلة', removeFav: 'إزالة من المفضلة',
    source: 'المصدر', upstream: 'قائمة iptv-org',
    note: 'الدليل يجمعه المجتمع ولا يستضيف أي فيديو؛ التشغيل يتطلب تسجيل الدخول وموافقة المصدر والحقوق عبر الخادم. الحقوق والتوفر يختلفان لكل قناة، وتُحذف أي قناة بطلب من صاحبها عبر المشروع.',
    favNote: 'المفضلة محفوظة على هذا الجهاز، وتُزامَن مع حسابك المجاني إذا سجّلت الدخول.',
    browserNote: 'نستبعد تلقائياً القنوات التي تحتاج ترويسات خاصة أو اتصالاً غير مشفّر، لأنها لا تعمل داخل المتصفح.',
  },
  en: {
    heading: 'World directory',
    intro: 'Channels from the open, community-maintained iptv-org directory. Not individually verified by us — some may not work in your region or may be temporarily down.',
    search: 'Search channels…', country: 'All countries', allCategories: 'All categories',
    favoritesOnly: 'Favorites only', loading: 'Loading directory…',
    failed: 'Could not load the world directory right now. Please try again shortly.',
    retry: 'Retry', empty: 'No matching channels.',
    loadMore: 'Load more', remaining: 'more channels',
    count: 'channels', play: 'Play', addFav: 'Add favorite', removeFav: 'Remove favorite',
    source: 'Source', upstream: 'iptv-org playlist',
    note: 'The directory is community-maintained and hosts no video; playback requires sign-in and backend source and rights approval. Rights and availability vary per channel, and entries are removed on the owner’s request via the project.',
    favNote: 'Favorites are stored on this device and sync to your free account if you sign in.',
    browserNote: 'Channels that require special headers or an unencrypted connection are filtered out automatically, because browsers cannot play them.',
  },
};

const COUNTRY_NAMES: Record<string, { ar: string; en: string }> = {
  iq: { ar: 'العراق', en: 'Iraq' }, sa: { ar: 'السعودية', en: 'Saudi Arabia' },
  ae: { ar: 'الإمارات', en: 'UAE' }, eg: { ar: 'مصر', en: 'Egypt' },
  qa: { ar: 'قطر', en: 'Qatar' }, kw: { ar: 'الكويت', en: 'Kuwait' },
  jo: { ar: 'الأردن', en: 'Jordan' }, lb: { ar: 'لبنان', en: 'Lebanon' },
  sy: { ar: 'سوريا', en: 'Syria' }, ps: { ar: 'فلسطين', en: 'Palestine' },
  ye: { ar: 'اليمن', en: 'Yemen' }, om: { ar: 'عُمان', en: 'Oman' },
  bh: { ar: 'البحرين', en: 'Bahrain' }, ma: { ar: 'المغرب', en: 'Morocco' },
  dz: { ar: 'الجزائر', en: 'Algeria' }, tn: { ar: 'تونس', en: 'Tunisia' },
  ly: { ar: 'ليبيا', en: 'Libya' }, sd: { ar: 'السودان', en: 'Sudan' },
  so: { ar: 'الصومال', en: 'Somalia' }, mr: { ar: 'موريتانيا', en: 'Mauritania' },
  tr: { ar: 'تركيا', en: 'Türkiye' }, ir: { ar: 'إيران', en: 'Iran' },
  us: { ar: 'الولايات المتحدة', en: 'United States' }, gb: { ar: 'بريطانيا', en: 'United Kingdom' },
  fr: { ar: 'فرنسا', en: 'France' }, de: { ar: 'ألمانيا', en: 'Germany' },
  it: { ar: 'إيطاليا', en: 'Italy' }, es: { ar: 'إسبانيا', en: 'Spain' },
  pt: { ar: 'البرتغال', en: 'Portugal' }, nl: { ar: 'هولندا', en: 'Netherlands' },
  ru: { ar: 'روسيا', en: 'Russia' }, ua: { ar: 'أوكرانيا', en: 'Ukraine' },
  in: { ar: 'الهند', en: 'India' }, pk: { ar: 'باكستان', en: 'Pakistan' },
  cn: { ar: 'الصين', en: 'China' }, jp: { ar: 'اليابان', en: 'Japan' },
  kr: { ar: 'كوريا الجنوبية', en: 'South Korea' }, id: { ar: 'إندونيسيا', en: 'Indonesia' },
  my: { ar: 'ماليزيا', en: 'Malaysia' }, br: { ar: 'البرازيل', en: 'Brazil' },
  mx: { ar: 'المكسيك', en: 'Mexico' }, ar: { ar: 'الأرجنتين', en: 'Argentina' },
  ca: { ar: 'كندا', en: 'Canada' }, au: { ar: 'أستراليا', en: 'Australia' },
  za: { ar: 'جنوب أفريقيا', en: 'South Africa' }, ng: { ar: 'نيجيريا', en: 'Nigeria' },
  ke: { ar: 'كينيا', en: 'Kenya' }, af: { ar: 'أفغانستان', en: 'Afghanistan' },
  se: { ar: 'السويد', en: 'Sweden' }, no: { ar: 'النرويج', en: 'Norway' },
  pl: { ar: 'بولندا', en: 'Poland' }, gr: { ar: 'اليونان', en: 'Greece' },
  ro: { ar: 'رومانيا', en: 'Romania' }, th: { ar: 'تايلاند', en: 'Thailand' },
};

const flag = countryFlag;

function countryLabel(code: string, language: Language): string {
  return COUNTRY_NAMES[code]?.[language] ?? code.toUpperCase();
}

type Selected = { id: string; name: string; url: string };

export default function CommunityTv({ language }: { language: Language }) {
  const t = T[language];
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [countries, setCountries] = useState<CommunityFacet[]>([]);
  const [categories, setCategories] = useState<CommunityFacet[]>([]);
  const [total, setTotal] = useState(0);
  const [country, setCountry] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [brokenLogos, setBrokenLogos] = useState<string[]>([]);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(FAVORITES) || '[]');
        if (Array.isArray(raw)) setFavorites(raw.filter(x => typeof x === 'string'));
      } catch { /* Storage unavailable. */ }
    };
    Promise.resolve().then(refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(LIBRARY_EVENT, refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener(LIBRARY_EVENT, refresh); };
  }, []);

  const load = useCallback(async (offset: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (country) params.set('country', country);
    if (category) params.set('category', category);
    if (debounced) params.set('q', debounced);
    try {
      const response = await fetch(`/api/iptv/community?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error('bad status');
      const body = await response.json();
      const rows: CommunityChannel[] = Array.isArray(body.data) ? body.data : [];
      setChannels(prev => offset === 0 ? rows : [...prev, ...rows]);
      setTotal(Number(body.total) || 0);
      if (Array.isArray(body.countries)) setCountries(body.countries);
      if (Array.isArray(body.categories)) setCategories(body.categories);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') { setFailed(true); if (offset === 0) setChannels([]); }
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }, [country, category, debounced]);

  useEffect(() => {
    Promise.resolve().then(() => load(0));
    return () => request.current?.abort();
  }, [load]);

  function toggleFavorite(id: string) {
    const next = favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES, JSON.stringify(next)); } catch { /* Works in this session. */ }
    notifyLibraryChanged();
  }

  const visible = useMemo(
    () => onlyFavorites ? channels.filter(c => favorites.includes(c.id)) : channels,
    [channels, favorites, onlyFavorites],
  );
  const canLoadMore = !onlyFavorites && channels.length < total;

  return (
    <div className="ptv community-tv">
      <div className="ptv-head">
        <h2>{t.heading}</h2>
        <p>{t.intro}</p>
      </div>

      <div className="ptv-controls">
        <select className="ctv-select" value={country} onChange={e => setCountry(e.target.value)} aria-label={t.country}>
          <option value="">{t.country}</option>
          {countries.map(item => (
            <option key={item.value} value={item.value}>
              {flag(item.value)} {countryLabel(item.value, language)} ({item.count})
            </option>
          ))}
        </select>
        <input
          className="ptv-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value.slice(0, 120))}
          placeholder={t.search}
          aria-label={t.search}
        />
        <button className="ptv-fav-toggle" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(v => !v)}>
          ★ {t.favoritesOnly}
        </button>
      </div>

      {categories.length > 0 && (
        <div className="film-genres" role="group" aria-label={t.allCategories}>
          <button aria-pressed={category === ''} onClick={() => setCategory('')}>{t.allCategories}</button>
          {categories.slice(0, 14).map(item => (
            <button key={item.value} aria-pressed={category === item.value} onClick={() => setCategory(item.value)}>
              {item.value}
            </button>
          ))}
        </div>
      )}

      {failed && (
        <p className="ptv-error" role="alert">
          {t.failed} <button className="ctv-retry" onClick={() => load(0)}>{t.retry}</button>
        </p>
      )}
      {loading && channels.length === 0 && !failed && <p className="ptv-note" role="status">{t.loading}</p>}
      {!loading && visible.length === 0 && !failed && <p className="ptv-note">{t.empty}</p>}
      {total > 0 && <p className="ptv-count">{onlyFavorites ? visible.length : total} {t.count}</p>}

      <div className="ptv-grid">
        {visible.map(channel => {
          const isFavorite = favorites.includes(channel.id);
          const broken = brokenLogos.includes(channel.id);
          return (
            <div className={selected?.id === channel.id ? 'ptv-card selected' : 'ptv-card'} key={channel.id}>
              <button
                className="ptv-open"
                onClick={() => setSelected({ id: channel.id, name: channel.name, url: channel.url })}
              >
                <span className="ptv-badge"><span className="ptv-dot" aria-hidden="true" />LIVE</span>
                {channel.logo && !broken
                  ? <span className="ctv-logo">
                      <Image
                        src={channel.logo} alt="" fill unoptimized sizes="80px"
                        onError={() => setBrokenLogos(prev => prev.includes(channel.id) ? prev : [...prev, channel.id])}
                      />
                    </span>
                  : <span className="ptv-flag" aria-hidden="true">{flag(channel.country)}</span>}
                <strong className="ptv-name">{channel.name}</strong>
                <small className="ptv-owner">
                  {channel.country ? `${flag(channel.country)} ${countryLabel(channel.country, language)}` : ''}
                  {channel.categories.length > 0 ? ` · ${channel.categories[0]}` : ''}
                </small>
                <span className="ptv-play">▶ {t.play}</span>
              </button>
              <button
                className="ptv-fav"
                aria-pressed={isFavorite}
                aria-label={`${isFavorite ? t.removeFav : t.addFav}: ${channel.name}`}
                onClick={() => toggleFavorite(channel.id)}
              >{isFavorite ? '★' : '☆'}</button>
            </div>
          );
        })}
      </div>

      {canLoadMore && (
        <button className="ctv-more" disabled={loading} onClick={() => load(channels.length)}>
          {loading ? t.loading : `${t.loadMore} · ${total - channels.length} ${t.remaining}`}
        </button>
      )}

      {selected && (
        <div className="ptv-player">
          <MediaViewer
            key={selected.id}
            language={language}
            title={selected.name}
            url={selected.url}
            kind="hls"
            onClose={() => setSelected(null)}
          />
          <p className="ptv-note">{t.browserNote}</p>
        </div>
      )}

      <p className="ptv-note ptv-footnote">{t.note}</p>
      <p className="ptv-note">
        {t.source}:{' '}
        <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noopener noreferrer">iptv-org ↗</a>
        {' · '}
        <a href="https://iptv-org.github.io/iptv/index.m3u" target="_blank" rel="noopener noreferrer">{t.upstream} ↗</a>
      </p>
      <p className="ptv-note">{t.favNote}</p>
    </div>
  );
}
