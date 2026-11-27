import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';

type Language = 'ar' | 'en';

type ArchiveItem = {
  id: string;
  title: string;
  year: number | null;
  description: string;
  thumb: string;
  embed: string;
  details: string;
};

type Reply = { data: ArchiveItem[]; total: number; page: number; pageSize: number };

const PAGE_SIZE = 60;

const COPY = {
  ar: {
    heading: 'مكتبة الأفلام الكلاسيكية',
    intro: 'آلاف الأفلام الكاملة من الملك العام مستضافة على Internet Archive — تشغيل مباشر بلا حساب.',
    search: 'ابحث عن فيلم…',
    loadMore: 'تحميل المزيد',
    loading: 'جاري تحميل المكتبة…',
    failed: 'تعذّر تحميل المكتبة حالياً. حاول بعد قليل.',
    retry: 'إعادة المحاولة',
    empty: 'لا توجد نتائج مطابقة.',
    count: 'فيلم',
    play: 'شاهد الآن',
    close: 'إغلاق',
    source: 'المصدر الرسمي',
    note: 'هذه الأفلام من الملك العام وتُستضيف وتُبثّ من Internet Archive نفسها.',
  },
  en: {
    heading: 'Classic film library',
    intro: 'Thousands of full public-domain films hosted on Internet Archive — direct playback, no account.',
    search: 'Search films…',
    loadMore: 'Load more',
    loading: 'Loading the library…',
    failed: 'Could not load the library right now. Try again shortly.',
    retry: 'Retry',
    empty: 'No matching films.',
    count: 'films',
    play: 'Watch now',
    close: 'Close',
    source: 'Official source',
    note: 'These films are public domain and are hosted and streamed by Internet Archive itself.',
  },
};

/**
 * Public-domain feature films straight from Internet Archive, browsed via the
 * site's own /api/movies/archive route and played through Archive's official
 * embed player. Everything here is hosted by archive.org — the platform hosts
 * and transcodes nothing.
 */
export default function ArchiveLibrary({ language }: { language: Language }) {
  const t = COPY[language];
  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState<ArchiveItem | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (nextPage: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ page: String(nextPage) });
    if (debounced) params.set('search', debounced);
    try {
      const response = await fetch(`/api/movies/archive?${params}`, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('bad status');
      const body = (await response.json()) as Partial<Reply>;
      if (!Array.isArray(body.data)) throw new Error('bad body');
      setItems(current => (nextPage === 1 ? (body.data as ArchiveItem[]) : [...current, ...(body.data as ArchiveItem[])]));
      setTotal(typeof body.total === 'number' ? body.total : 0);
      setPage(nextPage);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setFailed(true);
        if (nextPage === 1) setItems([]);
      }
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }, [debounced]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  useEffect(() => { void load(1); return () => request.current?.abort(); }, [load]);

  const cardStyle = { background: '#101014', border: '1px solid #26262e', borderRadius: '14px', overflow: 'hidden', textAlign: 'start' as const };
  const playStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#7b83ff', color: '#fff', borderRadius: '999px', padding: '7px 14px', fontSize: '13px', fontWeight: 600 };

  return (
    <section style={{ marginTop: '56px' }}>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 6px' }}>{t.heading}</h2>
        <p style={{ color: '#9a9aa5', fontSize: '14px', margin: '0 0 14px' }}>{t.intro}</p>
        <input
          type="search"
          value={search}
          maxLength={80}
          onChange={event => setSearch(event.target.value.slice(0, 80))}
          placeholder={t.search}
          aria-label={t.search}
          style={{ width: 'min(420px, 100%)', background: '#16161c', border: '1px solid #2c2c36', borderRadius: '12px', padding: '11px 16px', color: '#f2f2f5', fontSize: '14px' }}
        />
      </div>

      <div aria-live="polite">
        {failed && <p role="alert" style={{ color: '#ff6d8a', fontSize: '14px' }}>{t.failed} <button type="button" onClick={() => void load(1)} style={{ background: 'none', border: 'none', color: '#8b9bff', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}>{t.retry}</button></p>}
        {loading && items.length === 0 && !failed && <p style={{ color: '#9a9aa5', fontSize: '14px' }} role="status">{t.loading}</p>}
        {!loading && items.length === 0 && !failed && <p style={{ color: '#9a9aa5', fontSize: '14px' }}>{t.empty}</p>}
        {total > 0 && <p style={{ color: '#9a9aa5', fontSize: '13px' }}>{total} {t.count}</p>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '14px' }}>
        {items.map(item => (
          <button key={item.id} type="button" style={cardStyle} onClick={() => setPlaying(item)} aria-label={`${t.play}: ${item.title}`}>
            <Image src={item.thumb} alt="" width={400} height={225} unoptimized loading="lazy" style={{ width: '100%', height: 'auto', display: 'block', background: '#191920' }} />
            <div style={{ padding: '10px 12px 12px' }}>
              <strong style={{ display: 'block', fontSize: '14px', color: '#f2f2f5', lineHeight: 1.35 }}>{item.title}</strong>
              {item.year !== null && <small style={{ color: '#9a9aa5', fontSize: '12px' }}>{item.year}</small>}
              <span style={{ ...playStyle, marginTop: '10px' }}>▶ {t.play}</span>
            </div>
          </button>
        ))}
      </div>

      {items.length > 0 && items.length < total && (
        <button type="button" disabled={loading} onClick={() => void load(page + 1)} style={{ marginTop: '18px', background: '#16161c', border: '1px solid #2c2c36', borderRadius: '999px', padding: '10px 22px', color: '#f2f2f5', fontSize: '14px', cursor: 'pointer' }}>
          {loading ? t.loading : `${t.loadMore} · ${total - items.length}`}
        </button>
      )}

      {playing && (
        <div role="dialog" aria-modal="true" aria-label={playing.title} onClick={() => setPlaying(null)} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(4,4,8,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={event => event.stopPropagation()} style={{ width: 'min(960px, 100%)', background: '#0c0c11', border: '1px solid #26262e', borderRadius: '16px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <strong style={{ fontSize: '16px', color: '#f2f2f5' }}>{playing.title}{playing.year !== null ? ` · ${playing.year}` : ''}</strong>
              <button type="button" onClick={() => setPlaying(null)} aria-label={t.close} style={{ background: '#16161c', border: '1px solid #2c2c36', borderRadius: '999px', padding: '6px 14px', color: '#f2f2f5', fontSize: '13px', cursor: 'pointer' }}>✕ {t.close}</button>
            </div>
            <iframe
              src={playing.embed}
              title={playing.title}
              allow="fullscreen"
              allowFullScreen
              style={{ width: '100%', aspectRatio: '16 / 9', border: '0', borderRadius: '10px', background: '#000' }}
            />
            <p style={{ color: '#9a9aa5', fontSize: '12px', margin: '10px 0 0' }}>
              {t.note} <a href={playing.details} target="_blank" rel="noopener noreferrer" style={{ color: '#8b9bff' }}>{t.source} ↗</a>
            </p>
          </div>
        </div>
      )}

      <p style={{ color: '#77777f', fontSize: '12px', marginTop: '16px' }}>{t.note}</p>
    </section>
  );
}
