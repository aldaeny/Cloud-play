import React, { useCallback, useEffect, useState } from 'react';

type XtreamServer = {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  enabled: boolean;
  connectionStatus: string;
  lastCheckedAt: string | null;
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
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  useEffect(() => { void load(); }, [load]);

  async function addServer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/xtream-servers', {
        method: 'POST', headers, body: JSON.stringify({ name, baseUrl, username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.message === 'string' ? data.message : 'فشل حفظ السيرفر');
      setName(''); setBaseUrl(''); setUsername(''); setPassword('');
      setNotice('تمت إضافة السيرفر. لم يتم اختبار الاتصال بعد.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل حفظ السيرفر');
    } finally { setSaving(false); }
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
        <button onClick={() => void load()} className="px-3 py-2 rounded-lg border border-white/15 text-sm">تحديث القائمة</button>
      </div>

      <form onSubmit={addServer} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-[#0a0a0c] border border-white/10">
        <label className="text-sm">اسم السيرفر<input required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Main Server" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">رابط السيرفر<input required type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://example.com:2052" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">اسم المستخدم<input required value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <label className="text-sm">كلمة المرور<input required type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className="block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15" /></label>
        <div className="md:col-span-2 flex justify-end"><button disabled={saving} className="px-5 py-2 rounded-lg bg-[#00e5ff] text-black font-bold disabled:opacity-50">{saving ? 'جاري الحفظ…' : 'إضافة السيرفر'}</button></div>
      </form>

      {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
      {notice && <p role="status" className="text-emerald-400 text-sm">{notice}</p>}
      {loading ? <p className="text-gray-400">جاري تحميل السيرفرات…</p> : servers.length === 0 ? <p className="text-gray-400 text-sm">لا توجد سيرفرات مضافة حالياً.</p> : (
        <div className="space-y-3">{servers.map(server => (
          <article key={server.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0a0a0c] p-4">
            <div className="min-w-0"><div className="font-bold">{server.name} <span className={server.enabled ? 'text-emerald-400 text-xs' : 'text-gray-500 text-xs'}>{server.enabled ? 'مفعّل' : 'متوقف'}</span></div><p dir="ltr" className="text-sm text-gray-400 truncate">{server.baseUrl}</p><p className="text-xs text-gray-500">الحساب: {server.username} · حالة الاتصال: {server.connectionStatus}</p></div>
            <div className="flex gap-2 shrink-0"><button onClick={() => void toggleServer(server)} className="px-3 py-2 rounded-lg border border-white/15 text-sm">{server.enabled ? 'تعطيل' : 'تفعيل'}</button><button onClick={() => void deleteServer(server)} className="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 text-sm">حذف</button></div>
          </article>
        ))}</div>
      )}
      <p className="text-xs text-amber-300/80">تنبيه: كلمة المرور تُرسل إلى خادم الإدارة لتشفيرها قبل التخزين. لا تستخدم HTTP بين المتصفح والخادم في بيئة الإنتاج.</p>
    </section>
  );
}
