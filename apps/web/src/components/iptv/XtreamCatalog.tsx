import { useRef, useState } from 'react';
type Language = 'ar' | 'en';
type Entry = { id: string; name: string };
const text = {
  ar: { label: 'قائمة قنوات IPTV', description: 'جلب التصنيفات والقنوات من السيرفر بعد إعداد الاتصال.', load: 'جلب القنوات', retry: 'إعادة المحاولة', loading: 'جاري الاتصال…', choose: 'اختَر تصنيفاً', channels: 'القنوات', emptyCategories: 'لم يُرجع السيرفر تصنيفات.', emptyChannels: 'لا توجد قنوات في هذا التصنيف.', playback: 'القائمة للعرض فقط؛ تشغيل البث الآمن لم يُربط بعد.', disabled: 'الربط معطّل حالياً. فعّله على السيرفر أولاً.', missing: 'بيانات الاتصال غير مكتملة على السيرفر.', http: 'HTTP غير مفعّل. استخدامه يعرّض بيانات الدخول للاعتراض.', blocked: 'السيرفر رفض الاتصال (403). تحقّق من إعدادات Cloudflare أو صلاحيات الوصول.', unavailable: 'تعذّر الاتصال بالسيرفر أو قراءة الاستجابة. حاول لاحقاً.', badCategory: 'التصنيف غير صالح.', rate: 'طلبات كثيرة. حاول بعد دقيقة.' },
  en: { label: 'IPTV channel catalog', description: 'Load categories and channels after the server connection is configured.', load: 'Load channels', retry: 'Try again', loading: 'Connecting…', choose: 'Choose a category', channels: 'Channels', emptyCategories: 'The server returned no categories.', emptyChannels: 'No channels in this category.', playback: 'Catalog only; secure playback is not connected yet.', disabled: 'The integration is disabled. Enable it on the server first.', missing: 'Server connection settings are incomplete.', http: 'HTTP is not enabled. Using it exposes credentials in transit.', blocked: 'The server rejected the connection (403). Check Cloudflare and access permissions.', unavailable: 'Unable to reach the server or read its response. Try again later.', badCategory: 'Invalid category.', rate: 'Too many requests. Try again in a minute.' },
};
async function getEntries(path: string): Promise<Entry[]> {
  const response = await fetch(path, { cache: 'no-store' });
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') throw new Error('UPSTREAM_ERROR');
  const record = body as { error?: unknown; data?: unknown };
  if (!response.ok) throw new Error(typeof record.error === 'string' ? record.error : 'UPSTREAM_ERROR');
  if (!Array.isArray(record.data)) throw new Error('UPSTREAM_ERROR');
  return record.data.filter((x): x is Entry => !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string');
}
export default function XtreamCatalog({ language }: { language: Language }) {
  const t = text[language];
  const [groups, setGroups] = useState<Entry[] | null>(null);
  const [streams, setStreams] = useState<Entry[] | null>(null);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const version = useRef(0);
  const showError = (code: string) => ({ DISABLED: t.disabled, NOT_CONFIGURED: t.missing, HTTP_DISABLED: t.http, UPSTREAM_BLOCKED: t.blocked, INVALID_CATEGORY: t.badCategory, RATE_LIMIT: t.rate } as Record<string, string>)[code] || t.unavailable;
  async function load() {
    const current = ++version.current; setLoading(true); setError(''); setGroups(null); setStreams(null); setSelected('');
    try { const entries = await getEntries('/api/iptv/categories'); if (current === version.current) setGroups(entries); }
    catch (e) { if (current === version.current) setError(e instanceof Error ? e.message : 'UPSTREAM_ERROR'); }
    finally { if (current === version.current) setLoading(false); }
  }
  async function selectCategory(id: string) {
    const current = ++version.current; setSelected(id); setStreams(null); setError(''); setLoading(true);
    try { const entries = await getEntries(`/api/iptv/channels?categoryId=${encodeURIComponent(id)}`); if (current === version.current) setStreams(entries); }
    catch (e) { if (current === version.current) setError(e instanceof Error ? e.message : 'UPSTREAM_ERROR'); }
    finally { if (current === version.current) setLoading(false); }
  }
  return <div className="iptv-catalog"><div className="iptv-catalog-head"><div><h3>{t.label}</h3><p>{t.description}</p></div><button className="iptv-load" onClick={load} disabled={loading}>{loading ? t.loading : groups || error ? t.retry : t.load}</button></div>
    <div aria-live="polite">{error && <p className="iptv-message iptv-error">{showError(error)}</p>}{groups && groups.length === 0 && <p className="iptv-message">{t.emptyCategories}</p>}</div>
    {groups && groups.length > 0 && <><p className="iptv-label">{t.choose}</p><div className="iptv-groups">{groups.map(group => <button key={group.id} className={selected === group.id ? 'selected' : ''} onClick={() => selectCategory(group.id)} aria-pressed={selected === group.id}>{group.name}</button>)}</div></>}
    {streams && <div><p className="iptv-label">{t.channels} · {streams.length}</p>{streams.length ? <ul className="iptv-channels">{streams.map((channel, i) => <li key={`${channel.id}-${i}`}><span className="iptv-channel-mark">▶</span><span>{channel.name}</span></li>)}</ul> : <p className="iptv-message">{t.emptyChannels}</p>}</div>}
    <p className="iptv-footnote">{t.playback}</p>
  </div>;
}
