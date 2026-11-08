import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicChannel, PublicGroup } from '../../server/public-tv';
import type { LicensedChannel } from '../../server/licensed-iptv';
import { VideoPlayerModal } from '../player/VideoPlayerModal';
import type { Channel } from '../../types/channel';
import { categoryOf, qualityOf } from '../../lib/channels';
import { getStreamType } from '../../lib/player-utils';
import { LIBRARY_EVENT, notifyLibraryChanged } from '../../lib/preferences';
import { countryFlag } from '../../lib/country-flag';

type Language = 'ar' | 'en';
type Filter = 'all' | PublicGroup;
type Selected = { id: string; name: string; url: string; officialUrl?: string; broadcaster?: string; group?: string; country?: string };

/**
 * Bridge a curated/operator row into the shared player's Channel shape so the
 * pop-up reuses the real VideoPlayer (hls.js/dash.js, quality, retry) instead of
 * a second playback stack. Quality is only labelled when the source declares it.
 */
function toPlayerChannel(row: Selected): Channel {
  const group = row.group ?? '';
  return {
    id: row.id, name: row.name, logo: '', streamUrl: row.url,
    streamType: getStreamType(row.url) ?? 'hls',
    category: categoryOf(group, row.name), sourceGroup: group,
    country: '', countryCode: row.country ?? '', language: '',
    ...qualityOf(row.name), isLive: true, playable: true, epgId: '',
  };
}

const FAVORITES = 'cloudplay-tv-favorites-v1';

const T = {
  ar: {
    heading: 'بث مباشر مجاني',
    intro: 'قنوات يبثّها أصحابها مجاناً على الإنترنت — بدون تسجيل دخول وبدون اشتراك.',
    all: 'الكل', iraq: 'العراق', news: 'أخبار واقتصاد', gulf: 'الخليج', levant: 'بلاد الشام', sport: 'رياضة', world: 'عالمية',
    search: 'ابحث عن قناة…', favoritesOnly: 'المفضلة فقط',
    loading: 'جاري تحميل القنوات…', empty: 'لا توجد قنوات مطابقة.',
    failed: 'تعذّر تحميل قائمة القنوات. حاول تحديث الصفحة.',
    count: 'قناة', play: 'تشغيل', live: 'مباشر',
    addFav: 'إضافة للمفضلة', removeFav: 'إزالة من المفضلة',
    source: 'المصدر الرسمي', nowPlaying: 'يُشغّل الآن',
    attribution: 'كل قناة هنا تُبثّ من سيرفر المالك نفسه ومتاحة مجاناً للعموم. التشغيل يتصل بالمصدر مباشرة ويعتمد على توفره.',
    playbackHelp: 'إذا لم تعمل قناة، قد يكون المصدر متوقفاً مؤقتاً أو يمنع التشغيل من مواقع أخرى — افتح صفحتها الرسمية.',
    favNote: 'المفضلة محفوظة على هذا الجهاز، وتُزامَن مع حسابك المجاني إذا سجّلت الدخول.',
    operator: 'قنوات المشغّل',
  },
  en: {
    heading: 'Free live TV',
    intro: 'Channels the broadcasters themselves stream free online — no sign-in, no subscription.',
    all: 'All', iraq: 'Iraq', news: 'News & business', gulf: 'Gulf', levant: 'Levant', sport: 'Sport', world: 'International',
    search: 'Search channels…', favoritesOnly: 'Favorites only',
    loading: 'Loading channels…', empty: 'No matching channels.',
    failed: 'Could not load the channel list. Try refreshing the page.',
    count: 'channels', play: 'Play', live: 'LIVE',
    addFav: 'Add favorite', removeFav: 'Remove favorite',
    source: 'Official source', nowPlaying: 'Now playing',
    attribution: 'Every channel here is streamed from the owner’s own servers and published free to the public. Playback connects directly to the source and depends on its availability.',
    playbackHelp: 'If a channel does not play, its source may be temporarily down or may block other sites — open its official page.',
    favNote: 'Favorites are stored on this device and sync to your free account if you sign in.',
    operator: 'Operator channels',
  },
};

export default function PublicTv({ language, initialChannels }: { language: Language; initialChannels?: PublicChannel[] }) {
  const t = T[language];
  // Server-rendered on /live, so the grid is present in the initial HTML.
  const [channels, setChannels] = useState<PublicChannel[] | null>(initialChannels ?? null);
  const [extra, setExtra] = useState<LicensedChannel[]>([]);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  // Favorites: same storage key as the rest of the TV library, so account sync works.
  useEffect(() => {
    const refresh = () => {
      try {
        const value = JSON.parse(localStorage.getItem(FAVORITES) || '[]');
        if (Array.isArray(value)) setFavorites(value.filter((x): x is string => typeof x === 'string').slice(0, 1200));
      } catch { /* Storage unavailable. */ }
    };
    Promise.resolve().then(refresh);
    window.addEventListener(LIBRARY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(LIBRARY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // Load immediately — no button to press.
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void (async () => {
      // Skip the round-trip when the list already came from the server.
      if (!initialChannels) {
        try {
          const response = await fetch('/api/iptv/public', { signal: controller.signal });
          const body = await response.json();
          if (!response.ok || !Array.isArray(body.data)) throw new Error('bad response');
          if (!controller.signal.aborted) setChannels(body.data as PublicChannel[]);
        } catch {
          if (!controller.signal.aborted) setFailed(true);
        }
      }
      // Optional operator-curated list; absence is normal and silent.
      try {
        const response = await fetch('/api/iptv/licensed', { signal: controller.signal });
        const body = await response.json();
        if (response.ok && Array.isArray(body.data) && !controller.signal.aborted) setExtra(body.data as LicensedChannel[]);
      } catch { /* Not configured — public list stands on its own. */ }
    })();
    return () => controller.abort();
  }, [initialChannels]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(current => {
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
      try { localStorage.setItem(FAVORITES, JSON.stringify(next)); } catch { /* Session only. */ }
      notifyLibraryChanged();
      return next;
    });
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return (channels ?? []).filter(channel => {
      if (filter !== 'all' && channel.group !== filter) return false;
      if (onlyFavorites && !favorites.includes(channel.id)) return false;
      if (!needle) return true;
      return `${channel.nameAr} ${channel.nameEn} ${channel.broadcaster}`.toLocaleLowerCase().includes(needle);
    });
  }, [channels, filter, query, onlyFavorites, favorites]);

  const tabs: Filter[] = ['all', 'iraq', 'news', 'gulf', 'levant', 'sport', 'world'];

  return (
    <div className="ptv">
      <div className="ptv-head">
        <h2>{t.heading}</h2>
        <p>{t.intro}</p>
      </div>

      <div className="ptv-controls">
        <div className="ptv-tabs" role="tablist">
          {tabs.map(value => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? 'ptv-tab selected' : 'ptv-tab'}
              onClick={() => setFilter(value)}
            >
              {t[value]}
            </button>
          ))}
        </div>
        <input
          className="ptv-search"
          type="search"
          value={query}
          maxLength={100}
          onChange={event => setQuery(event.target.value)}
          placeholder={t.search}
          aria-label={t.search}
        />
        <button className="ptv-fav-toggle" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(value => !value)}>
          {onlyFavorites ? '★' : '☆'} {t.favoritesOnly}
        </button>
      </div>

      <div aria-live="polite">
        {failed && <p className="ptv-error" role="status">{t.failed}</p>}
        {!channels && !failed && <p className="ptv-note">{t.loading}</p>}
        {channels && <p className="ptv-count">{visible.length} {t.count}</p>}
      </div>

      {channels && visible.length === 0 && <p className="ptv-note">{t.empty}</p>}

      <div className="ptv-grid">
        {visible.map(channel => {
          const isFavorite = favorites.includes(channel.id);
          return (
            <div className={selected?.id === channel.id ? 'ptv-card selected' : 'ptv-card'} key={channel.id} id={channel.id}>
              <button
                className="ptv-open"
                onClick={() => setSelected({
                  id: channel.id,
                  name: language === 'ar' ? channel.nameAr : channel.nameEn,
                  url: channel.streamUrl,
                  officialUrl: channel.officialUrl,
                  broadcaster: channel.broadcaster,
                  group: channel.group,
                  country: channel.country,
                })}
              >
                <span className="ptv-badge"><span className="ptv-dot" aria-hidden="true" />{t.live}</span>
                <span className="ptv-flag" aria-hidden="true">{countryFlag(channel.country)}</span>
                <strong className="ptv-name">{language === 'ar' ? channel.nameAr : channel.nameEn}</strong>
                <small className="ptv-owner">{channel.broadcaster}</small>
                <span className="ptv-play">▶ {t.play}</span>
              </button>
              <button
                className="ptv-fav"
                aria-pressed={isFavorite}
                aria-label={`${isFavorite ? t.removeFav : t.addFav}: ${channel.nameEn}`}
                onClick={() => toggleFavorite(channel.id)}
              >
                {isFavorite ? '★' : '☆'}
              </button>
            </div>
          );
        })}
      </div>

      {selected && (
        <VideoPlayerModal
          key={selected.id}
          channel={toPlayerChannel(selected)}
          language={language}
          favorite={favorites.includes(selected.id)}
          onFavoriteToggle={toggleFavorite}
          onClose={() => setSelected(null)}
        />
      )}

      {extra.length > 0 && (
        <div className="ptv-operator">
          <h3>{t.operator} · {extra.length}</h3>
          <div className="ptv-rows">
            {extra.filter(channel => channel.playable && channel.streamUrl).map(channel => (
              <button
                key={channel.id}
                className="ptv-row"
                onClick={() => setSelected({ id: channel.id, name: channel.name, url: channel.streamUrl as string })}
              >
                <span className="ptv-dot" aria-hidden="true" />
                <span>{channel.name}</span>
                <span className="ptv-play">▶</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="ptv-note ptv-footnote">{t.attribution}</p>
      <p className="ptv-note">{t.favNote}</p>
    </div>
  );
}
