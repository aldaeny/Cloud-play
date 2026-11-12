import Head from 'next/head';
import { useEffect, useState, useRef } from 'react';
import SectionLayout from '../src/components/layout/SectionLayout';
import { VideoPlayer } from '../src/components/player/VideoPlayer';
import { ViewerIdentity } from '../src/lib/viewer-identity';
import { getSupabase } from '../src/lib/supabase';
type Title={id:string;titleAr:string;titleEn:string;kind?:string};
type Option={id:string;name?:string;deviceName?:string};
export default function OrganizationLibrary(){
  const [titles,setTitles]=useState<Title[]>([]),[profiles,setProfiles]=useState<Option[]>([]),[devices,setDevices]=useState<Option[]>([]);
  const [profile,setProfile]=useState(''),[device,setDevice]=useState(''),[status,setStatus]=useState(''),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false);
  const progressAt=useRef(0),identity=useRef(new ViewerIdentity()),pendingPlay=useRef(false);
  const [episodes,setEpisodes]=useState<Array<{id:string;titleId:string;number:number}>>([]);
  const [playing,setPlaying]=useState<{sessionId:string;url:string;title:string;titleId:string;profileId:string;episodeId?:string;resumeAtSec:number}|null>(null);
  async function request(action:string,body?:unknown){
    const turn=identity.current.capture();
    const auth=getSupabase();if(!auth)throw new Error('حسابات Supabase غير مهيأة.');
    const {data,error}=await auth.auth.getSession();if(error||!data.session)throw new Error('سجل الدخول أولاً بحساب المؤسسة.');
    if(!identity.current.current(turn))throw new Error('VIEWER_IDENTITY_CHANGED');
    const res=await fetch(`/api/vod/${action}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
    if(!res.ok)throw new Error('تعذر الطلب. تحقق من الجلسة والترخيص والحقوق وإعدادات HTTPS وGeo الموثوقة.');
    const result=await res.json();
    if(!identity.current.current(turn)){
      // A late session response must not become playback for the next account.
      if(action==='session'&&typeof result.sessionId==='string')void fetch('/api/vod/end',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({sessionId:result.sessionId}),keepalive:true}).catch(()=>{});
      throw new Error('VIEWER_IDENTITY_CHANGED');
    }
    return result;
  }
  async function play(title:Title,episodeId?:string){
    if(pendingPlay.current)return;pendingPlay.current=true;const turn=identity.current.capture();setBusy(true);try{
      setPlaying(null);
      if(title.kind==='SERIES'&&!episodeId){const rows=await request(`episodes?title=${encodeURIComponent(title.id)}`);if(!Array.isArray(rows))throw new Error('Invalid episode response');if(!identity.current.current(turn))return;setEpisodes(rows.map(e=>({...e,titleId:title.id})));return;}
      const data=await request('session',{titleId:title.id,profileId:profile,deviceId:device,...(episodeId?{episodeId}:{})});
      if(typeof data.url!=='string'||!data.url.startsWith('/api/vod/media?')||typeof data.sessionId!=='string')throw new Error('Invalid session response');
      if(!identity.current.current(turn))return;
      progressAt.current=0;setPlaying({sessionId:data.sessionId,url:data.url,title:title.titleEn,titleId:title.id,profileId:profile,episodeId,resumeAtSec:Number.isFinite(data.resumeAtSec)?data.resumeAtSec:0});setStatus('');
    }catch(error){if(identity.current.current(turn))setStatus((error as Error).message);}finally{if(identity.current.current(turn)){pendingPlay.current=false;setBusy(false);}}
  }
  useEffect(()=>{
    const auth=getSupabase();if(!auth)return;
    const fence=identity.current;
    const {data}=auth.auth.onAuthStateChange((_event,session)=>{
      if(!fence.update(session?.user.id??null))return;
      pendingPlay.current=false;setBusy(false);setPlaying(null);setEpisodes([]);
      setTitles([]);setProfiles([]);setDevices([]);setProfile('');setDevice('');setStatus('');
      setAttempt(n=>n+1);
    });
    return()=>{data.subscription.unsubscribe();fence.invalidate();};
  },[]);
  useEffect(()=>{
    let alive=true;const turn=identity.current.capture();
    Promise.all([request('catalog'),request('profiles'),request('devices')]).then(([t,p,d])=>{
      if(!alive||!identity.current.current(turn))return;if(!Array.isArray(t)||!Array.isArray(p)||!Array.isArray(d))throw new Error('استجابة غير صالحة.');
      setTitles(t);setProfiles(p);setDevices(d);setProfile(p[0]?.id||'');setDevice(d[0]?.id||'');setStatus('');
    }).catch(error=>{if(alive&&identity.current.current(turn))setStatus(error.message);});
    return()=>{alive=false;};
  },[attempt]);
  useEffect(()=>{if(!playing)return;const sessionId=playing.sessionId,turn=identity.current.capture();let pending=false;const timer=setInterval(()=>{if(pending)return;pending=true;void request('heartbeat',{sessionId}).catch(error=>{if(identity.current.current(turn)){setStatus(error.message);setPlaying(null);}}).finally(()=>{pending=false;});},30000);return()=>{clearInterval(timer);void fetch('/api/vod/end',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId}),keepalive:true}).catch(()=>{});};},[playing]);
  return <SectionLayout title={{ar:'مكتبة المؤسسة',en:'Organization library'}} noIndex>{language=><>
    <Head><meta name="robots" content="noindex,nofollow"/></Head>
    <p>المحتوى من خادم المؤسسة. لا تعني إضافته امتلاك حقوق توزيعه. الأجهزة تُجهّز من المشغّل؛ لا تُقبل هوية جهاز غير مملوكة.</p>
    <button className="live-button" onClick={()=>setAttempt(n=>n+1)}>إعادة تحميل المكتبة</button>
    <label>الملف <select aria-label="ملف المشاهدة" value={profile} onChange={e=>setProfile(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>الجهاز <select aria-label="جهاز المشاهدة" value={device} onChange={e=>setDevice(e.target.value)}>{devices.map(d=><option key={d.id} value={d.id}>{d.deviceName}</option>)}</select></label>
    <p role="status">{status}</p>
    {playing&&<><button className="live-button" onClick={()=>setPlaying(null)}>إنهاء المشاهدة</button><VideoPlayer key={playing.sessionId} src={playing.url} type="hls" title={playing.title} isLive={false} initialPositionSec={playing.resumeAtSec} onProgress={(positionSec,durationSec)=>{
      if(Date.now()-progressAt.current<15000)return;progressAt.current=Date.now();
      const turn=identity.current.capture();
      void request('progress',{titleId:playing.titleId,profileId:playing.profileId,...(playing.episodeId?{episodeId:playing.episodeId}:{}),positionSec,durationSec}).catch(()=>{if(identity.current.current(turn))setStatus('تعذر حفظ تقدم المشاهدة.');});
    }}/></>}
    <div className="collection-grid">{titles.map(title=><article key={title.id}><h2>{language==='ar'?title.titleAr:title.titleEn}</h2><button className="live-button" disabled={busy||!profile||!device} onClick={()=>void play(title)}>مشاهدة من خادم المؤسسة</button>{episodes.filter(e=>e.titleId===title.id).map(e=><button className="live-button" disabled={busy||!profile||!device} key={e.id} onClick={()=>void play(title,e.id)}>الحلقة {e.number}</button>)}</article>)}</div>
  </>}</SectionLayout>;
}
