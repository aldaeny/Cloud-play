'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRight, Share2, Star, RotateCcw, Tv } from 'lucide-react';
import { VideoPlayer } from '../../../src/components/player/VideoPlayer';
import type { Channel, EPGProgram } from '../../../src/types/channel';
import { fetchChannels, fetchEPG } from '../../../src/lib/channels';
import { WatchHistory } from '../../../src/lib/storage';
import { useChannelFavorites } from '../../../src/lib/use-channel-library';
import { CATEGORIES } from '../../../src/constants/categories';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs } from '../../../src/lib/preferences';


type GuideState = 'loading' | 'ready' | 'unavailable';
export default function ChannelDetailPage() {
  const params = useParams<{ id: string }>();
  const rawId = params?.id;
  const id = typeof rawId === 'string' ? rawId : '';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [guide, setGuide] = useState<Record<string, EPGProgram[]>>({});
  const [guideState, setGuideState] = useState<GuideState>('loading');
  const [guideAttempt, setGuideAttempt] = useState(0);
  const [guideTime, setGuideTime] = useState(0);
  useEffect(() => { const timer = setInterval(() => setGuideTime(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const [shareNotice, setShareNotice] = useState('');
  const { favorites, toggle } = useChannelFavorites();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const ar = prefs.language === 'ar';
  const channel = channels.find(item => item.id === id);
  useEffect(() => {
    const controller = new AbortController();
    void fetchChannels(controller.signal).then(data => { if (!controller.signal.aborted) { setChannels(data); setLoading(false); setFailed(false); } }).catch(() => { if (!controller.signal.aborted) { setLoading(false); setFailed(true); } });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { if (channel) WatchHistory.add(channel); }, [channel]);
  useEffect(() => { document.title = channel ? `${channel.name} | Cloud Play Iraq` : ar ? 'القناة | Cloud Play Iraq' : 'Channel | Cloud Play Iraq'; }, [channel, ar]);
  useEffect(() => {
    if (!channel?.epgId) return;
    const controller = new AbortController();
    void fetchEPG(controller.signal).then(data => { if (!controller.signal.aborted) { setGuide(data); setGuideTime(Date.now()); setGuideState('ready'); } }).catch(() => { if (!controller.signal.aborted) setGuideState('unavailable'); });
    return () => controller.abort();
  }, [channel?.epgId, guideAttempt]);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: channel?.name ?? 'Cloud Play Iraq', url });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(url); setShareNotice(ar ? 'نُسخ رابط القناة.' : 'Channel link copied.'); }
      else setShareNotice(ar ? 'انسخ رابط القناة من شريط العنوان.' : 'Copy the channel link from the address bar.');
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setShareNotice(ar ? 'تعذرت المشاركة. يمكنك نسخ الرابط من شريط العنوان.' : 'Sharing failed. Copy the link from the address bar.'); }
  };
  const back = <Link className="live-button" href="/live"><ArrowRight size={17}/>{ar ? 'العودة إلى القنوات' : 'Back to channels'}</Link>;
  if (loading) return <main className="live-page shell"><div className="live-empty" role="status"><span className="cp-player-spinner" aria-hidden="true"/><p>{ar ? 'جاري تحميل القناة…' : 'Loading channel…'}</p></div></main>;
  if (failed || !channel) return <main className="live-page shell"><div className="live-empty" role="status"><Tv size={36} aria-hidden="true"/><h1>{failed ? (ar ? 'تعذر تحميل القناة' : 'Could not load channel') : (ar ? 'القناة غير موجودة' : 'Channel not found')}</h1><p>{failed ? (ar ? 'تحقق من الشبكة ثم أعد المحاولة.' : 'Check your network and try again.') : (ar ? 'قد تكون القناة أُزيلت من المصدر أو الرابط غير صحيح.' : 'The channel may have been removed, or this link is incorrect.')}</p><div className="live-actions">{failed && <button type="button" className="live-button primary" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}><RotateCcw size={17}/>{ar ? 'إعادة المحاولة' : 'Try again'}</button>}{back}</div></div></main>;
  const isFavorite = favorites.includes(channel.id);
  const programs = (guide[channel.epgId] ?? []).filter(program => Date.parse(program.end) > guideTime);
  const related = channels.filter(item => item.id !== channel.id && item.playable && (item.category === channel.category || (channel.countryCode && item.countryCode === channel.countryCode))).slice(0, 6);
  const time = (value: string) => new Date(value).toLocaleTimeString(ar ? 'ar-IQ' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' });
  return <main className="live-page shell">
    {back}
    {channel.playable ? <div style={{ marginTop: 18 }}><VideoPlayer key={channel.id} src={channel.streamUrl} type={channel.streamType} poster={channel.logo || undefined} title={channel.name} isLive={channel.isLive}/></div> : <div className="live-empty" role="status"><h2>{ar ? 'هذه القناة غير متاحة للتشغيل' : 'This channel is unavailable'}</h2><p>{ar ? 'المصدر لا يوفر رابط بث متوافقاً مع المتصفح. اختر قناة أخرى.' : 'The source does not provide a browser-compatible stream. Choose another channel.'}</p></div>}
    <div className="live-heading" style={{ marginTop: 22 }}><h1>{channel.name}</h1><div className="live-actions"><button type="button" className="live-button" aria-pressed={isFavorite} onClick={() => toggle(channel.id)}><Star size={18} fill={isFavorite ? 'currentColor' : 'none'}/>{isFavorite ? (ar ? 'إزالة من المفضلة' : 'Remove favorite') : (ar ? 'إضافة للمفضلة' : 'Add favorite')}</button><button type="button" className="live-button" onClick={() => void share()}><Share2 size={18}/>{ar ? 'مشاركة' : 'Share'}</button></div></div>
    {shareNotice && <p className="live-note" role="status">{shareNotice}</p>}
    <div className="live-detail-grid"><div>
      <section className="live-info-panel" aria-labelledby="epg-heading"><h2 id="epg-heading">{ar ? 'دليل البرامج (EPG)' : 'Program guide'}</h2>
        {!channel.epgId || (guideState === 'ready' && programs.length === 0) ? <p className="live-note" role="status">{ar ? 'لا يتوفر دليل برامج لهذه القناة حالياً. لا نعرض برامج تقديرية.' : 'No program guide is available for this channel. We do not invent schedule entries.'}</p> : guideState === 'loading' ? <p className="live-note" role="status">{ar ? 'جاري تحميل دليل البرامج…' : 'Loading program guide…'}</p> : guideState === 'unavailable' ? <><p className="live-note" role="status">{ar ? 'دليل البرامج غير متاح حالياً. يمكنك الاستمرار في مشاهدة القناة.' : 'The guide is unavailable. You can still watch the channel.'}</p><button type="button" className="live-button" onClick={() => { setGuideState('loading'); setGuideAttempt(value => value + 1); }}>{ar ? 'إعادة تحميل الدليل' : 'Retry guide'}</button></> : programs.map((program, index) => <div className="live-program" key={program.id}><time dateTime={program.start}>{time(program.start)} – {time(program.end)}</time><p>{program.title}</p>{index === 0 && Date.parse(program.start) <= guideTime && <span className="live-badge live-badge-live">{ar ? 'الآن' : 'Now'}</span>}{program.description && <p className="live-note">{program.description}</p>}</div>)}
        <p className="live-note">{ar ? 'الأوقات بتوقيت بغداد.' : 'Times shown in Baghdad time.'}</p>
      </section>
      <section className="live-info-panel" style={{ marginTop: 20 }}><h2>{ar ? 'معلومات القناة' : 'Channel information'}</h2><dl><dt>{ar ? 'الدولة' : 'Country'}</dt><dd>{channel.country || (ar ? 'غير محددة' : 'Not declared')}</dd><dt>{ar ? 'التصنيف' : 'Category'}</dt><dd>{CATEGORIES.find(item => item.id === channel.category)?.[prefs.language] ?? channel.sourceGroup}</dd><dt>{ar ? 'تصنيف المصدر' : 'Source group'}</dt><dd>{channel.sourceGroup}</dd><dt>{ar ? 'الجودة المعلنة' : 'Declared quality'}</dt><dd>{channel.qualityLabel || (ar ? 'غير محددة؛ تتوفر الجودة الفعلية داخل المشغل عند دعم المصدر لها.' : 'Not declared; actual stream qualities appear in the player when available.')}</dd><dt>{ar ? 'اللغة' : 'Language'}</dt><dd>{channel.language || (ar ? 'غير محددة من المصدر' : 'Not declared by source')}</dd></dl></section>
    </div><aside className="live-info-panel"><h2>{ar ? 'قنوات مشابهة' : 'Related channels'}</h2>{related.length ? related.map(item => <Link className="live-related" href={`/live/${encodeURIComponent(item.id)}`} key={item.id}><Tv size={22} aria-hidden="true"/><span><strong>{item.name}</strong><small className="live-note" style={{ display: 'block' }}>{item.country || item.sourceGroup}</small></span></Link>) : <p className="live-note">{ar ? 'لا توجد قنوات مشابهة متاحة في المصدر الحالي.' : 'No related playable channels in the current source.'}</p>}</aside></div>
  </main>;
}
