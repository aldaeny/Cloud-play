import Head from 'next/head';
import { useEffect, useState } from 'react';
import SectionLayout from '../src/components/layout/SectionLayout';
import { VideoPlayer } from '../src/components/player/VideoPlayer';
import { getSupabase } from '../src/lib/supabase';
type Title={id:string;titleAr:string;titleEn:string};
type Option={id:string;name?:string;deviceName?:string};
export default function OrganizationLibrary(){
  const [titles,setTitles]=useState<Title[]>([]),[profiles,setProfiles]=useState<Option[]>([]),[devices,setDevices]=useState<Option[]>([]);
  const [profile,setProfile]=useState(''),[device,setDevice]=useState(''),[status,setStatus]=useState(''),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false);
  const [playing,setPlaying]=useState<{sessionId:string;url:string;title:string}|null>(null);
  async function request(action:string,body?:unknown){
    const auth=getSupabase();if(!auth)throw new Error('حسابات Supabase غير مهيأة.');
    const {data,error}=await auth.auth.getSession();if(error||!data.session)throw new Error('سجل الدخول أولاً بحساب المؤسسة.');
    const res=await fetch(`/api/vod/${action}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
    if(!res.ok)throw new Error('تعذر الطلب. تحقق من الجلسة والترخيص والحقوق وإعدادات HTTPS وGeo الموثوقة.');
    return res.json();
  }
  useEffect(()=>{
    let alive=true;
    Promise.all([request('catalog'),request('profiles'),request('devices')]).then(([t,p,d])=>{
      if(!alive)return;if(!Array.isArray(t)||!Array.isArray(p)||!Array.isArray(d))throw new Error('استجابة غير صالحة.');
      setTitles(t);setProfiles(p);setDevices(d);setProfile(p[0]?.id||'');setDevice(d[0]?.id||'');setStatus('');
    }).catch(error=>{if(alive)setStatus(error.message);});
    return()=>{alive=false;};
  },[attempt]);
  useEffect(()=>{if(!playing)return;const sessionId=playing.sessionId;let pending=false;const timer=setInterval(()=>{if(pending)return;pending=true;void request('heartbeat',{sessionId}).catch(error=>{setStatus(error.message);setPlaying(null);}).finally(()=>{pending=false;});},30000);return()=>{clearInterval(timer);void fetch('/api/vod/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId}),keepalive:true}).catch(()=>{});};},[playing]);
  return <SectionLayout title={{ar:'مكتبة المؤسسة',en:'Organization library'}} noIndex>{language=><>
    <Head><meta name="robots" content="noindex,nofollow"/></Head>
    <p>المحتوى من خادم المؤسسة. لا تعني إضافته امتلاك حقوق توزيعه. الأجهزة تُجهّز من المشغّل؛ لا تُقبل هوية جهاز غير مملوكة.</p>
    <button className="live-button" onClick={()=>setAttempt(n=>n+1)}>إعادة تحميل المكتبة</button>
    <label>الملف <select aria-label="ملف المشاهدة" value={profile} onChange={e=>setProfile(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>الجهاز <select aria-label="جهاز المشاهدة" value={device} onChange={e=>setDevice(e.target.value)}>{devices.map(d=><option key={d.id} value={d.id}>{d.deviceName}</option>)}</select></label>
    <p role="status">{status}</p>
    {playing&&<><button className="live-button" onClick={()=>setPlaying(null)}>إنهاء المشاهدة</button><VideoPlayer src={playing.url} type="hls" title={playing.title} isLive={false}/></>}
    <div className="collection-grid">{titles.map(title=><article key={title.id}><h2>{language==='ar'?title.titleAr:title.titleEn}</h2><button className="live-button" disabled={busy||!profile||!device} onClick={async()=>{if(busy)return;setBusy(true);try{setPlaying(null);const data=await request('session',{titleId:title.id,profileId:profile,deviceId:device});if(typeof data.url!=='string'||!data.url.startsWith('/api/vod/media?')||typeof data.sessionId!=='string')throw new Error('استجابة جلسة غير صالحة.');setPlaying({sessionId:data.sessionId,url:data.url,title:language==='ar'?title.titleAr:title.titleEn});setStatus('');}catch(error){setStatus((error as Error).message);}finally{setBusy(false);}}}>مشاهدة من خادم المؤسسة</button></article>)}</div>
  </>}</SectionLayout>;
}
