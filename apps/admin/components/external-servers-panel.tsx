import { FormEvent, useCallback, useEffect, useState } from 'react';
type Server = { id: string; name: string; providerName: string; protocol: string; country: string; category: string; status: string; lastCheckedAt: string | null; lastSuccessfulCheck: string | null; licenseId: string | null };
type Document = { id: string; mimeType: string; byteLength: number; sha256: string };
type License = { id: string; provider: string; contentOwner: string; status: string; expiryDate: string };
const cls = 'block w-full mt-1 p-3 rounded-lg bg-[#171820] border border-white/15';
const statuses = ['verified_authorized', 'provider_authorized', 'public_access_only', 'permission_pending', 'licensing_unverified', 'restricted', 'expired', 'revoked'];
export default function ExternalServersPanel({ token }: { token: string }) {
  const [servers, setServers] = useState<Server[]>([]), [licenses, setLicenses] = useState<License[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [next, setNext] = useState<string | null>(null), [history, setHistory] = useState<unknown>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editing, setEditing] = useState<Server | null>(null);
  const call = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`/api/admin/external-servers${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(22000) });
    if (!response.ok) throw new Error('تعذر تنفيذ العملية. تحقق من الصلاحيات والبيانات واتصال الخادم.');
    return response.json();
  }, [token]);
  const load = useCallback(async (cursor?: string) => {
    setLoading(true); setError('');
    try {
      const [page, rights] = await Promise.all([call(cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''), call('/licenses')]);
      setServers(previous => cursor ? [...previous, ...page.items] : page.items); setNext(page.nextCursor); setLicenses(rights);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [call]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) return load(); }); return () => { active = false; }; }, [load]);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function createServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    void action(async () => { await call(editing ? `/${editing.id}` : '', editing ? 'PUT' : 'POST', { ...data, priority: Number(data.priority) }); form.reset(); setEditing(null); });
  }
  function createLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
    const body = Object.fromEntries(data);
    void action(async () => { await call('/licenses', 'POST', { ...body, allowedPlatforms: String(data.get('allowedPlatforms')).split(',').map(s => s.trim()), allowedCountries: String(data.get('allowedCountries')).split(',').map(s => s.trim()), commercialUse: data.has('commercialUse'), redistributionPermission: data.has('redistributionPermission') }); form.reset(); });
  }
  return <section className="mt-8 space-y-4 border-t border-white/10 pt-6" aria-label="External Servers">
    <h2 className="text-xl font-bold text-[#00e5ff]">External Servers — المصادر المرشحة وحقوق المحتوى</h2>
    <p className="text-sm text-gray-400">الاتصال التقني لا يثبت الترخيص. جميع المصادر تبقى candidate؛ النشر والتحويل التلقائي غير مفعّلين. أعداد هذه الصفحة فقط: {servers.length} مصدر، {licenses.length} ترخيص (حتى 100).</p>
    {error && <p role="alert" className="text-red-400">{error}</p>}
    <button disabled={busy} onClick={() => void load()} className="border border-white/20 rounded p-2">تحديث المصادر</button>
    <form key={editing?.id || 'new'} onSubmit={createServer} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-[#0a0a0c] rounded-xl">
      <h3 className="md:col-span-2 font-bold">{editing ? 'تعديل المصدر يعيده إلى مرشح ويلغي ربط الترخيص' : 'إضافة مصدر مرشح — لا يتطلب مستنداً'}</h3>
      <label>اسم المصدر<input className={cls} name="name" required maxLength={80} defaultValue={editing?.name} /></label>
      <label>المزود<input className={cls} name="providerName" required maxLength={120} defaultValue={editing?.providerName} /></label>
      <label>البروتوكول<select className={cls} name="protocol" defaultValue={editing?.protocol || 'hls'}>{['hls', 'm3u', 'dash', 'direct', 'xtream'].map(p => <option key={p}>{p}</option>)}</select></label>
      <label>رابط HTTPS السري<input className={cls} name="url" type="url" required autoComplete="off" placeholder="لا يُعاد الرابط المخزن إلى المتصفح" /></label>
      <label>رمز الدولة<input className={cls} name="country" required minLength={2} maxLength={2} defaultValue={editing?.country || 'IQ'} /></label>
      <label>التصنيف<input className={cls} name="category" required maxLength={80} defaultValue={editing?.category} /></label>
      <label>الأولوية<input className={cls} name="priority" type="number" min={1} max={1000} defaultValue={100} required /></label>
      <label>معرّف Xtream الموجود (لـ Xtream فقط)<input className={cls} name="xtreamServerId" autoComplete="off" /></label>
      <label>ملاحظات<textarea className={cls} name="notes" maxLength={2000} /></label>
      <div><button disabled={busy} className="p-3 bg-[#00e5ff] text-black rounded">حفظ كمرشح</button>{editing && <button type="button" onClick={() => setEditing(null)} className="p-3">إلغاء التعديل</button>}</div>
    </form>
    {loading && <p role="status">جاري تحميل المصادر…</p>}
    {!loading && !servers.length && <p>لا توجد مصادر مرشحة.</p>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{servers.map(server => <article key={server.id} className="p-4 rounded border border-white/15 min-w-0 space-y-2">
      <h3 className="font-bold break-words">{server.name} · {server.providerName}</h3><p>{server.status} · {server.protocol}</p>
      <p className="text-sm text-gray-400">آخر فحص: {server.lastCheckedAt || 'لم يفحص'} · آخر قائمة HLS صالحة: {server.lastSuccessfulCheck || 'غير مثبتة'}</p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => setEditing(server)}>تعديل</button>
        <button disabled={busy} onClick={() => { if (confirm('تأكيد السماح بالوصول التقني؟ لن تُجلب مقاطع ولن يُنشر المصدر.')) void action(async () => setHistory(await call(`/${server.id}/check`, 'POST', { technicalAccessConfirmed: true }))); }}>فحص تقني</button>
        <button disabled={busy} onClick={() => void action(async () => setHistory(await call(`/${server.id}/history`)))}>سجل الفحوص</button>
        <button disabled={busy} onClick={() => { if (confirm('إزالة المصدر مع الاحتفاظ بسجله؟')) void action(() => call(`/${server.id}`, 'DELETE')); }}>حذف آمن</button>
      </div>
      <label>ربط ترخيص دون نشر<select className={cls} value={server.licenseId || ''} disabled={busy} onChange={e => { if (e.target.value) void action(() => call(`/${server.id}/license/${e.target.value}`, 'POST', {})); }}><option value="">بدون ترخيص</option>{licenses.map(l => <option key={l.id} value={l.id}>{l.provider} · {l.status}</option>)}</select></label>
    </article>)}</div>
    {next && <button disabled={loading} onClick={() => void load(next)}>تحميل المزيد</button>}
    <details><summary className="font-bold cursor-pointer">Content Rights &amp; Licensing Manager</summary>
      <form onSubmit={createLicense} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        {[['provider','المزود'],['contentOwner','مالك المحتوى'],['authorizedContact','جهة الاتصال المخولة'],['authorizationType','نوع التصريح'],['allowedPlatforms','المنصات، مفصولة بفواصل'],['allowedCountries','رموز الدول، مفصولة بفواصل'],['territoryRestrictions','قيود الإقليم']].map(([name,label]) => <label key={name}>{label}<input className={cls} name={name} required maxLength={200} /></label>)}
        <label>بداية التصريح<input className={cls} type="date" name="startDate" required /></label><label>انتهاء التصريح<input className={cls} type="date" name="expiryDate" required /></label>
        <label><input type="checkbox" name="commercialUse" /> الاستخدام التجاري مسموح</label><label><input type="checkbox" name="redistributionPermission" /> إعادة التوزيع مسموحة</label>
        <button disabled={busy} className="p-3 border border-white/20 rounded">حفظ ترخيص غير متحقق</button>
      </form>
      {licenses.map(l => <article key={l.id} className="mt-3 p-3 border border-white/15 rounded"><p>{l.provider} · {l.contentOwner} · {l.status} · {l.expiryDate}</p>
        <label className="block mt-2">إرفاق دليل سري (PDF/PNG/JPEG/نص/رسالة، حد 48KiB؛ لا يمنح اعتماداً تلقائياً)
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.eml" disabled={busy} className={cls} onChange={e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
            if (file.size > 49152 || !file.size) { setError('حجم المستند يجب أن يكون بين 1 بايت و48KiB.'); return; }
            void action(async () => {
              const data = new Uint8Array(await file.arrayBuffer());
              let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
              const mimeType = file.name.endsWith('.eml') ? 'message/rfc822' : file.type || 'text/plain';
              await call(`/licenses/${l.id}/documents`, 'POST', { mimeType, contentBase64: btoa(binary) });
              setDocuments(await call(`/licenses/${l.id}/documents`));
            });
          }} />
        </label>
        <button disabled={busy} onClick={() => void action(async () => setDocuments(await call(`/licenses/${l.id}/documents`)))}>عرض أدلة هذا الترخيص</button>
        <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void action(() => call(`/licenses/${l.id}/review`, 'POST', { status: data.get('status'), notes: data.get('notes'), scopeReviewed: data.has('scopeReviewed'), issuerVerified: data.has('issuerVerified') })); }} className="space-y-2">
          <select name="status" className={cls} defaultValue="licensing_unverified">{statuses.map(s => <option key={s}>{s}</option>)}</select>
          <label>ملاحظات المراجعة<input name="notes" className={cls} required maxLength={2000} /></label>
          <label className="block"><input name="scopeReviewed" type="checkbox" /> راجعت المدة والإقليم والمنصات والتوزيع التجاري</label><label className="block"><input name="issuerVerified" type="checkbox" /> تحققت من هوية وصلاحية جهة الإصدار</label>
          <button disabled={busy}>تسجيل مراجعة الحقوق (يتطلب rights:manage)</button>
        </form>
      </article>)}
    </details>
    {documents.map(d => <div key={d.id} className="text-xs break-all p-2 border border-white/10"><p>{d.id} · {d.mimeType} · {d.byteLength} bytes · SHA256: {d.sha256}</p>
      <button disabled={busy} onClick={() => void action(async () => {
        const result = await call(`/documents/${d.id}`);
        const bytes = Uint8Array.from(atob(result.contentBase64), ch => ch.charCodeAt(0));
        // Download only. Never inline-render untrusted evidence or create an HTML data URL.
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
        const link = document.createElement('a'); link.href = url; link.download = `${d.id}.evidence`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>تنزيل الدليل للمراجعة (يتطلب rights:manage)</button>
    </div>)}
    <button disabled={busy} onClick={() => void action(async () => setHistory(await call('/audit')))}>سجل التدقيق</button>
    {history !== null && <pre dir="ltr" className="text-xs overflow-auto max-h-80 p-3 bg-black rounded" aria-label="نتيجة العملية">{JSON.stringify(history, null, 2)}</pre>}
  </section>;
}
