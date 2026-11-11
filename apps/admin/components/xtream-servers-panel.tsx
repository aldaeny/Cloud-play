import React, { useCallback, useEffect, useState } from 'react';

type XtreamServer = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  connectionStatus: string;
  lastCheckedAt: string | null;
};

/** Honest labels: an unreachable origin is not the same as a bad credential. */
const STATUS_LABEL: Record<string, string> = {
  healthy: 'يعمل',
  unhealthy: 'غير متاح حالياً',
  unknown: 'لم يُفحص بعد',
};

const REASON_LABEL: Record<string, string> = {
  OK: 'تم التحقق من الاتصال والحساب.',
  AUTH_REJECTED: 'السيرفر يعمل لكن بيانات الدخول مرفوضة.',
  ORIGIN_UNREACHABLE: 'تعذّر الوصول إلى السيرفر حالياً. هذا لا يعني توقفه نهائياً.',
  HTTP_DISABLED: 'الرابط يستخدم HTTP وهو غير مسموح في الإعدادات الحالية.',
  INVALID_URL: 'رابط السيرفر غير صالح أو غير مسموح.',
  UNEXPECTED_RESPONSE: 'ردّ السيرفر غير متوقع.',
  RECENTLY_CHECKED: 'تم فحصه حديثاً؛ لم يُكرر الطلب لتجنّب الضغط على السيرفر.',
};

type Props = { token: string };

export default function XtreamServersPanel({ token }: Props) {
  const [servers, setServers] = useState<XtreamServer[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [priority, setPriority] = useState('100');
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/xtream-servers', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data: unknown = await response.json();
      if (!response.ok || !Array.isArray(data)) throw new Error('تعذر تحميل السيرفرات');
      setServers(data as XtreamServer[]);
      setError('');
    } catch {
      setError('تعذر تحميل السيرفرات. تحقق من اتصال الـ API وصلاحية xtream:manage.');
    } finally { setLoading(false); }
  }, [token]);

  // Defer to a microtask so the initial setLoading(true) inside load() is not a
  // synchronous setState in the effect body (react-hooks/set-state-in-effect).
  // Same pattern AccountProvider uses for its initial load.
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function addServer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(editingId ? `/api/admin/xtream-servers/${encodeURIComponent(editingId)}` : '/api/admin/xtream-servers', {
        method: editingId ? 'PATCH' : 'POST', headers,
        body: JSON.stringify({
          name, baseUrl, username,
          ...(password ? { password } : {}),
          ...(Number.isInteger(Number(priority)) ? { priority: Number(priority) } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'فشل حفظ السيرفر');
      setName(''); setBaseUrl(''); setUsername(''); setPassword(''); setPriority('100'); setEditingId(null);
      setNotice(editingId ? 'تم تحديث السيرفر.' : 'تمت إضافة السيرفر. لم يتم اختبار الاتصال بعد.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل حفظ السيرفر');
    } finally { setSaving(false); }
  }

  function beginEdit(server: XtreamServer) {
    setEditingId(server.id); setName(server.name); setBaseUrl(server.baseUrl); setUsername(server.username); setPassword(''); setPriority(String(server.priority ?? 100)); setError(''); setNotice('');
  }

  function cancelEdit() {
    setEditingId(null); setName(''); setBaseUrl(''); setUsername(''); setPassword(''); setPriority('100');
  }

  async function toggleServer(server: XtreamServer) {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/xtream-servers/${encodeURIComponent(server.id)}/toggle`, {
        method: 'PATCH', headers, body: JSON.stringify({ enabled: !server.enabled }),
      });
      if (!response.ok) throw new Error('تعذر تغيير حالة السيرفر');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تغيير الحالة'); }
  }

  async function makeDefault(server: XtreamServer) {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/xtream-servers/${encodeURIComponent(server.id)}/default`, { method: 'PATCH', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'تعذر تعيين السيرفر الافتراضي');
      setNotice(`تم تعيين "${server.name}" سيرفراً افتراضياً.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تعيين الافتراضي'); }
  }

  async function changePriority(server: XtreamServer, value: number) {
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/xtream-servers/${encodeURIComponent(server.id)}/priority`, {
        method: 'PATCH', headers, body: JSON.stringify({ priority: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'تعذر تحديث الأولوية');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحديث الأولوية'); }
  }

  async function checkServer(server: XtreamServer) {
    setCheckingId(server.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/xtream-servers/${encodeURIComponent(server.id)}/check`, { method: 'POST', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'تعذر فحص السيرفر');
      const reason = REASON_LABEL[data?.reason] ?? '';
      const latency = typeof data?.latencyMs === 'number' ? ` (${data.latencyMs} مللي ثانية)` : '';
      setNotice(`${server.name}: ${STATUS_LABEL[data?.connectionStatus] ?? data?.connectionStatus}${latency}. ${reason}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر فحص السيرفر');
    } finally { setCheckingId(null); }
  }

  async function checkAll() {
    setSweeping(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/xtream-servers/check-all', { method: 'POST', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'تعذر فحص السيرفرات');
      setNotice(`تم فحص ${data?.checked ?? 0} سيرفر، وتخطّي ${data?.skipped ?? 0} تم فحصه حديثاً.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر فحص السيرفرات');
    } finally { setSweeping(false); }
  }

  async function deleteServer(server: XtreamServer) {
    if (!window.confirm(`حذف السيرفر "${server.name}"؟`)) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/xtream-servers/${encodeURIComponent(server.id)}`, { method: 'DELETE', headers });
      if (!response.ok) throw new Error('تعذر حذف السيرفر');
      setNotice('تم حذف السيرفر.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر حذف السيرفر'); }
  }

  return (
    <section className="mt-8 bg-[#121217] border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><h2 className="text-xl font-bold text-[#00e5ff]">سيرفرات Xtream</h2><p className="text-sm text-gray-400 mt-1">إدارة مصادر البث التابعة لك فقط.</p></div>
        <div className="flex gap-2"><button onClick={() => void checkAll()} disabled={sweeping} className="px-3 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-50">{sweeping ? 'جاري الفحص…' : 'فحص كل السيرفرات'}</button><button onClick={() => void load()} className="px-3 py-2 rounded-lg border border-white/15 text-sm">تحديث القائمة</button></div>
      </div>

      <form onSubmit={addServer} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-[#0a0a0c] border border-white/10">
        <label className="text-sm">اسم السيرفر<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Main Server" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">رابط السيرفر<input required type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://example.com:2052" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">اسم المستخدم<input required value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">كلمة المرور<input required={!editingId} type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">الأولوية (1 = الأعلى)<input required type="number" min={1} max={1000} step={1} value={priority} onChange={e => setPriority(e.target.value)} className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <div className="md:col-span-2 flex justify-end gap-2">{editingId && <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-lg border border-white/15">إلغاء</button>}<button disabled={saving} className="px-5 py-2 rounded-lg bg-[#00e5ff] text-black font-bold disabled:opacity-50">{saving ? 'جاري الحفظ…' : editingId ? 'حفظ التعديلات' : 'إضافة السيرفر'}</button></div>
      </form>

      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {notice && <p role="status" className="text-emerald-400 text-sm">{notice}</p>}
      {loading ? <p className="text-gray-400">جاري تحميل السيرفرات…</p> : servers.length === 0 ? <p className="text-gray-400 text-sm">لا توجد سيرفرات مضافة حالياً.</p> : (
        <div className="space-y-3">{servers.map(server => (
          <article key={server.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0a0c] p-4">
            <div className="min-w-0"><div className="font-bold">{server.name} <span className={server.enabled ? 'text-emerald-400 text-xs' : 'text-gray-500 text-xs'}>{server.enabled ? 'مفعّل' : 'متوقف'}</span>{server.isDefault && <span className="text-[#00e5ff] text-xs"> · الافتراضي</span>}</div><p dir="ltr" className="text-sm text-gray-400 truncate">{server.baseUrl}</p><p className="text-xs text-gray-500">الحساب: {server.username} · الأولوية: {server.priority ?? 100}</p><p className="text-xs mt-1"><span className={server.connectionStatus === 'healthy' ? 'text-emerald-400' : server.connectionStatus === 'unhealthy' ? 'text-amber-300' : 'text-gray-500'}>الاتصال: {STATUS_LABEL[server.connectionStatus] ?? 'لم يُفحص بعد'}</span>{server.lastCheckedAt && <span className="text-gray-500"> · آخر فحص: {new Date(server.lastCheckedAt).toLocaleString('ar-IQ')}</span>}</p></div>
            <CatalogSyncControls id={server.id} token={token} enabled={server.enabled} />
            <div className="flex gap-2 shrink-0 flex-wrap"><button onClick={() => void checkServer(server)} disabled={checkingId === server.id} className="px-3 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-50">{checkingId === server.id ? 'جاري الفحص…' : 'فحص الاتصال'}</button>{!server.isDefault && <button onClick={() => void makeDefault(server)} disabled={!server.enabled} title={server.enabled ? '' : 'فعّل السيرفر أولاً'} className="px-3 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-40">تعيين افتراضي</button>}<button onClick={() => void changePriority(server, Math.max(1, (server.priority ?? 100) - 1))} disabled={(server.priority ?? 100) <= 1} className="px-3 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-40" aria-label="رفع الأولوية">▲</button><button onClick={() => void changePriority(server, Math.min(1000, (server.priority ?? 100) + 1))} disabled={(server.priority ?? 100) >= 1000} className="px-3 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-40" aria-label="خفض الأولوية">▼</button><button onClick={() => beginEdit(server)} className="px-3 py-2 rounded-lg border border-white/15 text-sm">تعديل</button><button onClick={() => void toggleServer(server)} className="px-3 py-2 rounded-lg border border-white/15 text-sm">{server.enabled ? 'تعطيل' : 'تفعيل'}</button><button onClick={() => void deleteServer(server)} className="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 text-sm">حذف</button></div>
          </article>
        ))}</div>
      )}
      <p className="text-xs text-gray-500">«غير متاح حالياً» يعني تعذّر الوصول وقت الفحص، وليس توقّف السيرفر نهائياً. الفحص محاولة واحدة محدودة المهلة، ولا يُكرر تلقائياً خلال دقيقة لتجنّب الضغط على السيرفر.</p>
      <p className="text-xs text-amber-300/80">تنبيه: كلمة المرور تُرسل إلى خادم الإدارة لتشفيرها قبل التخزين. لا تستخدم HTTP بين المتصفح والخادم في بيئة الإنتاج.</p>
    </section>
  );
}

/** Existing design tokens, no page/layout replacement. Metadata only; never
 * renders provider response bodies, passwords or playback URLs. */
function CatalogSyncControls({ id, token, enabled }: { id: string; token: string; enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<{ itemCount: number; lastSuccessAt: string | null; history: { status: string; reason: string; at: string }[] } | null>(null);
  async function update(pull: boolean) {
    if (pull && !window.confirm('أؤكد أن لدي تصريحاً لاستخدام هذا المزوّد وسحب بيانات الكتالوج منه. متابعة؟')) return;
    setBusy(true); setMessage('');
    const base = `/api/admin/xtream-servers/${encodeURIComponent(id)}/catalog-sync`;
    try {
      if (pull) {
        const result = await fetch(`${base}/pull`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ authorizationConfirmed: true }) });
        if (!result.ok) throw new Error('SYNC_FAILED');
      }
      const response = await fetch(base, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
      const data: unknown = await response.json();
      if (!response.ok || !data || typeof data !== 'object' || !('itemCount' in data) || typeof data.itemCount !== 'number' || !('history' in data) || !Array.isArray(data.history)) throw new Error('STATUS_FAILED');
      const row = data as Record<string, unknown>;
      const history = (row.history as unknown[]).slice(0, 20).flatMap(value => {
        if (!value || typeof value !== 'object') return [];
        const event = value as Record<string, unknown>;
        return typeof event.status === 'string' && typeof event.reason === 'string' && typeof event.at === 'string'
          ? [{ status: event.status, reason: event.reason, at: event.at }] : [];
      });
      setState({ itemCount: data.itemCount, lastSuccessAt: typeof row.lastSuccessAt === 'string' ? row.lastSuccessAt : null, history });
    } catch { setMessage('تعذرت العملية. تحقق من التصريح والاتصال، ثم حدّث السجل لمعرفة النتيجة قبل إعادة المحاولة. آخر كتالوج ناجح محفوظ.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-2 text-xs text-gray-400">
    <div className="flex gap-2"><button disabled={busy || !enabled} onClick={() => void update(true)} className="px-3 py-2 rounded-lg border border-white/15 disabled:opacity-40">{busy ? 'جاري العمل…' : 'مزامنة الكتالوج'}</button><button disabled={busy} onClick={() => void update(false)} className="px-3 py-2 rounded-lg border border-white/15 disabled:opacity-40">تحديث سجل المزامنة</button></div>
    {message && <p role="alert" className="mt-2 text-amber-300">{message}</p>}
    {state && <div className="mt-2"><p>عدد العناصر: {state.itemCount} · آخر نجاح: {state.lastSuccessAt ? new Date(state.lastSuccessAt).toLocaleString('ar-IQ') : 'لم تتم مزامنة ناجحة'}</p>{state.history.length === 0 ? <p>لا توجد عمليات سابقة.</p> : <ul>{state.history.map((event, index) => <li key={`${event.at}-${index}`}>{event.status === 'SUCCEEDED' ? 'نجاح' : 'فشل'} · {event.reason} · {new Date(event.at).toLocaleString('ar-IQ')}</li>)}</ul>}</div>}
  </div>;
}
