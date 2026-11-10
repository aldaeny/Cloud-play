'use client';

import { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Star, RotateCcw } from 'lucide-react';
import type { Channel } from '../../src/types/channel';
import { fetchChannels } from '../../src/lib/channels';
import { WatchHistory } from '../../src/lib/storage';
import { useChannelFavorites } from '../../src/lib/use-channel-library';
import { ChannelGrid, CategoryFilter, CountryFilter, QualityFilter, ChannelSearch } from '../../src/components/channels/ChannelCard';
import { ChannelList } from '../../src/components/channels/ChannelList';
import { SortDropdown } from '../../src/components/channels/SortDropdown';
import { ViewModeToggle } from '../../src/components/channels/ViewModeToggle';
import { VideoPlayerModal } from '../../src/components/player/VideoPlayerModal';
import { CATEGORIES } from '../../src/constants/categories';
import { filterChannels } from '../../src/lib/player-utils';
import { applyChannelSort } from '../../src/lib/channel-sort';
import { useChannelView } from '../../src/lib/use-channel-view';
import OwnerPlayerLink from '../../src/components/account/OwnerPlayerLink';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs } from '../../src/lib/preferences';
import { useSyncExternalStore } from 'react';

const PAGE_SIZE = 40;

export default function LivePage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState('all');
  const [country, setCountry] = useState('');
  const [quality, setQuality] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [playing, setPlaying] = useState<Channel | null>(null);
  const { favorites, toggle } = useChannelFavorites();
  const { view, sort, setView, setSort } = useChannelView();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const ar = prefs.language === 'ar';
  useEffect(() => {
    const controller = new AbortController();
    void fetchChannels(controller.signal).then(data => {
      if (controller.signal.aborted) return;
      setChannels(data); setFailed(false); setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) { setFailed(true); setLoading(false); } });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { document.title = ar ? 'تلفزيون | Cloud Play Iraq' : 'TV | Cloud Play Iraq'; }, [ar]);
  const filtered = useMemo(() => {
    const matched = filterChannels(channels, favorites, deferredSearch, onlyFavorites ? 'favorites' : category, country, quality);
    return applyChannelSort(matched, sort, favorites, prefs.language);
  }, [channels, favorites, deferredSearch, category, country, quality, onlyFavorites, sort, prefs.language]);
  const grouped = useMemo(() => {
    const groups = new Map<string, Channel[]>();
    for (const channel of filtered.slice(0, limit)) { const group = groups.get(channel.category) ?? []; group.push(channel); groups.set(channel.category, group); }
    return groups;
  }, [filtered, limit]);
  const resetFilters = () => { setSearch(''); setCategory('all'); setCountry(''); setQuality(''); setOnlyFavorites(false); setLimit(PAGE_SIZE); };
  const changeFilter = (setter: (value: string) => void) => (value: string) => { setter(value); setLimit(PAGE_SIZE); };
  // Playback opens the pop-up player; the full channel page stays available for EPG/sharing.
  const play = useCallback((channel: Channel) => { if (!channel.playable) return; WatchHistory.add(channel); setPlaying(channel); }, []);
  const closePlayer = useCallback(() => setPlaying(null), []);
  return <main className="live-page shell">
    <div className="live-heading"><div><h1>{ar ? 'البث المباشر (TV)' : 'Live TV'}</h1><p>{ar ? 'قنواتك في مكان واحد. ابحث، صفّ واحفظ ما تحب.' : 'Your channels in one place. Search, filter and save your favorites.'}</p></div><button type="button" className="live-chip live-favorite-toggle" aria-pressed={onlyFavorites} onClick={() => { setOnlyFavorites(value => !value); setLimit(PAGE_SIZE); }}><Star size={17} fill={onlyFavorites ? 'currentColor' : 'none'}/>{ar ? 'المفضلة فقط' : 'Favorites only'}</button></div>
    <OwnerPlayerLink language={prefs.language}/>
    <div className="live-filters"><ChannelSearch value={search} onChange={changeFilter(setSearch)} language={prefs.language}/><CategoryFilter active={category} onChange={changeFilter(setCategory)} language={prefs.language}/><div className="live-filter-row"><CountryFilter active={country} onChange={changeFilter(setCountry)} channels={channels} language={prefs.language}/><QualityFilter active={quality} onChange={changeFilter(setQuality)} language={prefs.language}/></div></div>
    <div className="cp-tw live-toolbar" dir={ar ? 'rtl' : 'ltr'}>
      <ViewModeToggle value={view} onChange={setView} language={prefs.language}/>
      <SortDropdown value={sort} onChange={setSort} language={prefs.language}/>
      {!loading && !failed && channels.length > 0 && <span className="tw-ms-auto tw-shrink-0 tw-text-xs tw-text-muted" role="status">{filtered.length} {ar ? 'قناة' : 'channels'}</span>}
    </div>
    <div aria-live="polite" aria-busy={loading}>
      {loading ? <div className="live-skeleton" role="status" aria-label={ar ? 'جاري تحميل القنوات' : 'Loading channels'}><span/><span/><span/><span/></div> : failed ? <div className="live-empty" role="alert"><h2>{ar ? 'تعذر تحميل القنوات' : 'Could not load channels'}</h2><p>{ar ? 'تحقق من الاتصال بالشبكة. مصدر القنوات قد يكون غير متاح مؤقتاً.' : 'Check your network. The channel source may be temporarily unavailable.'}</p><button type="button" className="live-button primary" onClick={() => { setLoading(true); setFailed(false); setAttempt(value => value + 1); }}><RotateCcw size={17}/>{ar ? 'إعادة المحاولة' : 'Try again'}</button></div> : channels.length === 0 ? <div className="live-empty" role="status"><h2>{ar ? 'لم تُربط قائمة قنوات مرخّصة بعد' : 'No licensed channel list is connected yet'}</h2><p>{ar ? 'تظهر هنا القنوات التي يضيفها مسؤول المنصة بعد التحقق من حقوق بثها. لا نعرض قنوات تجريبية أو روابط غير حقيقية.' : 'Channels appear after the operator connects a rights-reviewed playlist. We do not show invented channels or placeholder streams.'}</p><Link className="live-button" href="/settings">{ar ? 'إعدادات الحساب' : 'Account settings'}</Link></div> : filtered.length === 0 ? <div className="live-empty" role="status"><h2>{onlyFavorites && favorites.length === 0 ? (ar ? 'لا توجد قنوات مفضلة بعد' : 'No favorite channels yet') : (ar ? 'لا توجد قنوات مطابقة' : 'No matching channels')}</h2><p>{ar ? 'جرّب تغيير البحث أو التصنيف، أو أزل الفلاتر لعرض القنوات المتاحة.' : 'Change your search or category, or clear filters to see available channels.'}</p><button type="button" className="live-button" onClick={resetFilters}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</button></div> : view === 'list' ? <div className="cp-tw" dir={ar ? 'rtl' : 'ltr'}>
        <ChannelList channels={filtered} favorites={favorites} language={prefs.language} activeId={playing?.id} onPlay={play} onFavoriteToggle={toggle}/>
      </div> : <>
        <p className="live-count">{filtered.length} {ar ? 'قناة مطابقة' : 'matching channels'} · {channels.length} {ar ? 'قناة في المصدر' : 'channels in source'}</p>
        {CATEGORIES.filter(item => grouped.has(item.id)).map(item => <section className="live-channel-section" key={item.id} aria-labelledby={`category-${item.id}`}><div className="live-section-head"><h2 id={`category-${item.id}`}>{item[ prefs.language ]}</h2><span className="live-count">{grouped.get(item.id)?.length} {ar ? 'قناة معروضة' : 'shown'}</span></div><ChannelGrid channels={grouped.get(item.id) ?? []} onPlay={play} favorites={favorites} onFavoriteToggle={toggle}/></section>)}
        {filtered.length > limit && <div className="live-more"><button type="button" className="live-button" onClick={() => setLimit(value => value + PAGE_SIZE)}>{ar ? 'عرض المزيد من القنوات' : 'Load more channels'} ({filtered.length - limit})</button></div>}
      </>}
    </div>
    <p className="live-note">{ar ? 'التشغيل يعتمد على توفر المصدر ودعمه للبث من المتصفح. الجودة المعروضة هي المعلنة من المصدر وليست ضماناً. المفضلة تُزامَن مع حسابك المجاني.' : 'Playback depends on source availability and browser support. Declared quality is not a guarantee. Favorites sync with your free account.'}</p>
    <Link className="live-button" href="/tv-sources">{ar ? 'مصادر التلفزيون الإضافية' : 'Additional TV sources'}</Link>
    {playing && <VideoPlayerModal channel={playing} language={prefs.language} favorite={favorites.includes(playing.id)} onFavoriteToggle={toggle} onClose={closePlayer}/>}
  </main>;
}
