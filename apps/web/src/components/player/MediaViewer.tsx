import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PlaybackPreferencesContext } from './PlaybackPreferences';
type Language='ar'|'en';
type State='loading'|'ready'|'playing'|'blocked'|'failed';
type Props={language:Language;title:string;url:string;kind:'hls'|'mp4';onClose:()=>void;className?:string;footer?:ReactNode;progressKey?:string};
export default function MediaViewer({language,title,url,kind,onClose,className='',footer,progressKey}:Props){
 const preferences=useContext(PlaybackPreferencesContext);const preferencesRef=useRef(preferences);const [initialScroll]=useState(preferences.scrollToPlayer);
 useEffect(()=>{preferencesRef.current=preferences},[preferences]);
 const lastSaved=useRef(0);
 function saveProgress(video:HTMLVideoElement, ended=false){if(!progressKey)return;try{const k=`cloudplay-progress-v1-${progressKey}`;if(ended||(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime>=video.duration-10)){localStorage.removeItem(k);return;}if(Number.isFinite(video.duration)&&video.duration>20&&Number.isFinite(video.currentTime)&&video.currentTime>=5){localStorage.setItem(k,JSON.stringify({position:Math.floor(video.currentTime),duration:Math.floor(video.duration)}));lastSaved.current=Date.now();}}catch{/* Playback remains usable without storage. */}}
 function restoreProgress(video:HTMLVideoElement){if(!progressKey)return;try{const p=JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${progressKey}`)||'null');if(p&&Number.isFinite(p.position)&&p.position>=5&&Number.isFinite(video.duration)&&p.position<video.duration-10)video.currentTime=p.position;}catch{/* Ignore unavailable or invalid storage. */}}
 const ar=language==='ar';const videoRef=useRef<HTMLVideoElement>(null);const viewerRef=useRef<HTMLDivElement>(null);const [state,setState]=useState<State>('loading');const [slow,setSlow]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{if(initialScroll)viewerRef.current?.scrollIntoView({behavior:(viewerRef.current?.closest('.motion-off') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'instant':'smooth',block:'center'})},[initialScroll]);
 useEffect(()=>{
  const video=videoRef.current;if(!video)return;const {autoPlay,startMuted}=preferencesRef.current;video.muted=startMuted;let cancelled=false;let hls:import('hls.js').default|null=null;setState('loading');setSlow(false);
  const timer=window.setTimeout(()=>{if(!cancelled)setSlow(true)},18000);
  async function playAutomatically(){try{await video!.play()}catch(e){if(cancelled)return;const name=e instanceof Error?e.name:'';if(name==='AbortError')return;if(name==='NotAllowedError')setState('blocked');else if(video!.error)setState('failed');else setState('ready')}}
  async function attach(){
   if(!video)return;
   if(kind==='mp4'||video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;setState('ready');if(autoPlay)void playAutomatically();return}
   try{const Hls=(await import('hls.js')).default;if(cancelled)return;if(!Hls.isSupported()){setState('failed');return}hls=new Hls({enableWorker:true});hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled)setState('failed')});hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){setState('ready');if(autoPlay)void playAutomatically()}});hls.loadSource(url);hls.attachMedia(video)}catch{if(!cancelled)setState('failed')}
  }
  void attach();return()=>{cancelled=true;window.clearTimeout(timer);hls?.destroy();video.pause();video.removeAttribute('src');video.load()};
 },[url,kind,attempt]);
 function closePlayer(){if(videoRef.current)saveProgress(videoRef.current);onClose()}
 function playFromClick(){const video=videoRef.current;if(!video)return;void video.play().catch(e=>{if(e?.name==='NotAllowedError')setState('blocked');else if(e?.name!=='AbortError')setState('failed')})}
 return <div ref={viewerRef} className={`firebase-viewer media-viewer ${className}`}><div className="firebase-viewer-top"><strong>{title}</strong><button onClick={closePlayer}>{ar?'إغلاق المشغّل':'Close player'}</button></div>
  <video key={attempt} ref={videoRef} controls playsInline preload="metadata" onPlaying={()=>setState('playing')} onLoadedMetadata={e=>restoreProgress(e.currentTarget)} onTimeUpdate={e=>{if(Date.now()-lastSaved.current>=5000)saveProgress(e.currentTarget)}} onPause={e=>{saveProgress(e.currentTarget);setState(s=>s==='playing'?'ready':s)}} onEnded={e=>saveProgress(e.currentTarget,true)} onError={()=>setState('failed')}/>
  <div className="media-actions">{state==='failed'?<button className="media-play" onClick={()=>setAttempt(n=>n+1)}>{ar?'↻ إعادة المحاولة':'↻ Retry'}</button>:<button className="media-play" disabled={state==='loading'} onClick={playFromClick}>{state==='playing'?(ar?'▶ يستمر التشغيل':'▶ Playing'):(ar?'▶ تشغيل الآن':'▶ Play now')}</button>}
  <p className={state==='failed'?'firebase-error':'firebase-note'} role="status">{state==='loading'?(slow?(ar?'التحميل يستغرق وقتاً أطول من المعتاد؛ المصدر قد يكون بطيئاً.':'Loading is taking longer than usual; the source may be slow.'):(ar?'جاري تجهيز الفيديو…':'Preparing video…')):state==='blocked'?(ar?'المتصفح يحتاج ضغطتك لبدء التشغيل. اضغط «تشغيل الآن».':'Your browser requires a tap to start. Press “Play now”.'):state==='failed'?(ar?'تعذّر تشغيل الفيديو من المصدر. قد يكون متوقفاً أو محظوراً أو غير مدعوم.':'Could not play this video. Its source may be offline, blocked or unsupported.'):state==='playing'?(ar?'يعمل الآن؛ استخدم أزرار الفيديو للصوت وملء الشاشة.':'Playing; use video controls for sound and fullscreen.'):(ar?'اضغط «تشغيل الآن» إذا لم يبدأ الفيديو.':'Press “Play now” if the video does not start.')}</p></div>{footer}
 </div>;
}
