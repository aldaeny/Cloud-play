import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import XtreamServersPanel from '../components/xtream-servers-panel';

type Title = { id: string; titleAr: string; titleEn: string; state: string };

export default function AdminDashboard() {
  // Keep the short-lived token in memory only. Removing it here does not revoke it on the server.
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [titles, setTitles] = useState<Title[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data: unknown = await res.json();
      if (!res.ok || !data || typeof data !== 'object' || !('accessToken' in data) || typeof data.accessToken !== 'string') throw new Error('login failed');
      setPassword('');
      setToken(data.accessToken);
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من بياناتك واتصال الخادم.');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    fetch('/api/admin/titles', { headers: { authorization: `Bearer ${token}` }, signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('titles unavailable');
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error('invalid response');
        setTitles(data);
        setError('');
      })
      .catch(() => { if (!abort.signal.aborted) { setError('تعذر تحميل العناوين؛ قد تكون الجلسة انتهت.'); setTitles([]); } });
    return () => abort.abort();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-inter p-6" dir="rtl">
      <Head><title>Cloud Play — الإدارة</title></Head>
      <header className="flex justify-between items-center mb-8 border-b border-white/10 pb-4">
        <h1 className="text-2xl font-black tracking-tight">Cloud Play <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] to-[#ff2085]">Admin</span></h1>
        {token && <button onClick={() => { setToken(null); setTitles(null); }} className="px-4 py-2 rounded-xl bg-[#121217] border border-white/10 text-sm">مسح الجلسة من الصفحة</button>}
      </header>
      {!token ? (
        <form onSubmit={login} className="max-w-md bg-[#121217] border border-white/10 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-[#00e5ff]">دخول الإدارة</h2>
          <label className="block">البريد الإلكتروني<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-1 p-3 rounded bg-[#0a0a0c] border border-white/20" /></label>
          <label className="block">كلمة المرور<input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-1 p-3 rounded bg-[#0a0a0c] border border-white/20" /></label>
          {error && <p role="alert" className="text-red-400">{error}</p>}
          <button disabled={loading} className="px-5 py-2 rounded bg-[#00e5ff] text-black font-bold disabled:opacity-50">{loading ? 'جاري الدخول…' : 'دخول'}</button>
        </form>
      ) : (
        <main className="bg-[#121217] border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-[#00e5ff] mb-4">العناوين</h2>
          <p className="text-sm text-gray-400 mb-4">تجربة محلية للقراءة فقط. مسح الجلسة من الصفحة لا يُبطل الرمز على الخادم.</p>
          {error && <p role="alert" className="text-red-400">{error}</p>}
          {titles === null ? <p>جاري التحميل…</p> : titles.length === 0 ? <p className="text-gray-400">لا توجد عناوين.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{titles.map(title => (
              <article key={title.id} className="p-4 bg-[#0a0a0c] rounded-xl border border-white/10"><p className="font-bold">{title.titleAr || title.titleEn}</p><p className="text-sm text-gray-400">الحالة: {title.state}</p></article>
            ))}</div>
          )}
          <XtreamServersPanel token={token} />
        </main>
      )}
    </div>
  );
}
