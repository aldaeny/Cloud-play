import React, { useCallback, useEffect, useState } from 'react';
export type Branding = { displayName: string; brandDark: string; cyanGlow: string; logoUrl: string | null };
export default function TenantSettingsPanel({ token, onBranding }: { token: string; onBranding: (branding: Branding) => void }) {
  const [branding, setBranding] = useState<Branding>({ displayName: 'Cloud Play', brandDark: '#0a0a0c', cyanGlow: '#00e5ff', logoUrl: null });
  const [status, setStatus] = useState('');
  const [plans, setPlans] = useState<{ id: string; code: string }[]>([]);
  const [userId, setUserId] = useState('');
  const [planId, setPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const request = useCallback(async (action: string, method = 'GET', body?: unknown) => {
    const res = await fetch(`/api/admin/tenant-settings?action=${action}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json();
    if (!res.ok) throw new Error('تعذر إتمام الطلب؛ تحقق من الصلاحيات والاتصال.');
    return data;
  }, [token]);
  useEffect(() => {
    let alive = true;
    request('branding').then(data => { if (alive && data) { setBranding(data); onBranding(data); } }).catch(() => { if (alive) setStatus('إعدادات المؤسسة غير متاحة لهذه الجلسة.'); });
    return () => { alive = false; };
  }, [request, onBranding]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      const saved = await request('branding', 'PUT', { displayName: branding.displayName, brandDark: branding.brandDark, cyanGlow: branding.cyanGlow, logoUrl: branding.logoUrl });
      onBranding(saved); setStatus('تم حفظ الهوية البصرية في قاعدة البيانات.');
    } catch (error) { setStatus((error as Error).message); }
  }
  return <section className="p-5 my-6 rounded-xl border border-white/10 bg-[#121217]">
    <h2 className="text-xl font-bold mb-4">هوية المؤسسة والتراخيص الداخلية</h2>
    <form onSubmit={save} className="flex flex-wrap gap-3">
      <label>اسم المؤسسة <input aria-label="اسم المؤسسة" maxLength={80} required value={branding.displayName} onChange={e => setBranding({ ...branding, displayName: e.target.value })} className="bg-black p-2 rounded" /></label>
      <label>الخلفية <input type="color" value={branding.brandDark} onChange={e => setBranding({ ...branding, brandDark: e.target.value })} /></label>
      <label>لون التمييز <input type="color" value={branding.cyanGlow} onChange={e => setBranding({ ...branding, cyanGlow: e.target.value })} /></label>
      <label>مسار شعار محلي <input placeholder="/brand-assets/logo.png" value={branding.logoUrl || ''} onChange={e => setBranding({ ...branding, logoUrl: e.target.value || null })} className="bg-black p-2 rounded" /></label>
      <button className="border p-2 rounded" type="submit">حفظ الهوية</button>
    </form>
    <p className="text-sm my-4">تراخيص يدوية غير مالية للمستخدمين: Starter / Professional / Business. ليست عملية دفع ولا ترخيص SaaS للمؤسسة. يتطلب فرض الاشتراك FREE_ACCESS=false؛ الحماية لا تُعطّل هنا.</p>
    <button className="border p-2 rounded" onClick={async () => { try { const data = await request('plans', 'POST'); setPlans(data.plans); setStatus('تم تجهيز الخطط الداخلية دون رسوم.'); } catch (error) { setStatus((error as Error).message); } }}>تجهيز الخطط الداخلية</button>
    <form className="flex flex-wrap gap-3 mt-4" onSubmit={async event => { event.preventDefault(); try { await request('licenses', 'POST', { userId, planId, expiresAt: new Date(expiresAt).toISOString() }); setStatus('تم تفعيل ترخيص يدوي؛ لم يُحصّل أي مبلغ.'); } catch (error) { setStatus((error as Error).message); } }}>
      <input aria-label="معرف المستخدم" required placeholder="UUID المستخدم" value={userId} onChange={e => setUserId(e.target.value)} className="bg-black p-2 rounded" />
      <select aria-label="الخطة الداخلية" required value={planId} onChange={e => setPlanId(e.target.value)} className="bg-black p-2 rounded"><option value="">الخطة</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.code}</option>)}</select>
      <input aria-label="انتهاء الترخيص" required type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="bg-black p-2 rounded" />
      <button className="border p-2 rounded">تفعيل ترخيص غير مالي</button>
    </form>
    <p role="status" className="mt-3">{status}</p>
  </section>;
}
