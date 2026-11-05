import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PlaybackPreferencesContext } from './PlaybackPreferences';
import CastControls from './CastControls';
import { notifyLibraryChanged } from '../../lib/preferences';
type Language='ar'|'en';
type State='loading'|'ready'|'playing'|'blocked'|'failed';
type Track={label:string;id:number};
type Props={language:Language;title:string;url:string;kind:'hls'|'mp4';onClose:()=>void;className?:string;footer?:ReactNode;progressKey?:string};
export default function MediaViewer({language,title,url,kind,onClose,className='',footer,progressKey}:Props){
 const preferences=useContext(PlaybackPreferencesContext);const preferencesRef=useRef(preferences);const [initialScroll]=useState(preferences.scrollToPlayer);
 useEffect(()=>{preferencesRef.current=preferences},[preferences]);
 const lastSaved=useRef(0);
 function saveProgress(video:HTMLVideoElement, ended=false){if(!progressKey)return;try{const k=`cloudplay-progress-v1-${progressKey}`;if(ended||(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime>=video.duration-10)){localStorage.removeItem(k);notifyLibraryChanged();return;}if(Number.isFinite(video.duration)&&video.duration>20&&Number.isFinite(video.currentTime)&&video.currentTime>=5){localStorage.setItem(k,JSON.stringify({position:Math.floor(video.currentTime),duration:Math.floor(video.duration)}));lastSaved.current=Date.now();notifyLibraryChanged();}}catch{/* Playback remains usable without storage. */}}
 function restoreProgress(video:HTMLVideoElement){if(!progressKey)return;try{const p=JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${progressKey}`)||'null');if(p&&Number.isFinite(p.position)&&p.position>=5&&Number.isFinite(video.duration)&&p.position<video.duration-10)video.currentTime=p.position;}catch{/* Ignore unavailable or invalid storage. */}}
 const hlsRef=useRef<import('hls.js').default|null>(null);const [levels,setLevels]=useState<Track[]>([]);const [audio,setAudio]=useState<Track[]>([]);const [subtitles,setSubtitles]=useState<Track[]>([]);const [qualityChoice,setQualityChoice]=useState(-1);const [audioChoice,setAudioChoice]=useState(-1);const [subtitleChoice,setSubtitleChoice]=useState(-1);
 const ar=language==='ar';const videoRef=useRef<HTMLVideoElement>(null);const viewerRef=useRef<HTMLDivElement>(null);const [state,setState]=useState<State>('loading');const [slow,setSlow]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{if(initialScroll)viewerRef.current?.scrollIntoView({behavior:(viewerRef.current?.closest('.motion-off') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'instant':'smooth',block:'center'})},[initialScroll]);
 useEffect(()=>{
  const video=videoRef.current;if(!video)return;const {autoPlay,startMuted}=preferencesRef.current;video.muted=startMuted;let cancelled=false;let hls:import('hls.js').default|null=null;setState('loading');setSlow(false);setLevels([]);setAudio([]);setSubtitles([]);setQualityChoice(-1);setAudioChoice(-1);setSubtitleChoice(-1);
  const timer=window.setTimeout(()=>{if(!cancelled)setSlow(true)},18000);
  async function playAutomatically(){try{await video!.play()}catch(e){if(cancelled)return;const name=e instanceof Error?e.name:'';if(name==='AbortError')return;if(name==='NotAllowedError')setState('blocked');else if(video!.error)setState('failed');else setState('ready')}}
  async function attach(){
   if(!video)return;
   if(kind==='mp4'||video.canPlayType('application/vnd.apple.mpegurl')){video.src=url;setState('ready');if(autoPlay)void playAutomatically();return}
   try{const Hls=(await import('hls.js')).default;if(cancelled)return;if(!Hls.isSupported()){setState('failed');return}hls=new Hls({enableWorker:true});hlsRef.current=hls;
   const updateLevels=()=>{if(!cancelled&&hls){setLevels(hls.levels.map((v,id)=>({id,label:v.height?`${v.height}p`:(v.name||`${Math.round(v.bitrate/1000)} kbps`)})));setQualityChoice(hls.manualLevel)}};
   const updateAudio=()=>{if(!cancelled&&hls){setAudio(hls.audioTracks.map((v,id)=>({id,label:v.name||v.lang||`Track ${id+1}`})));setAudioChoice(hls.audioTrack)}};
   const updateSubtitles=()=>{if(!cancelled&&hls){setSubtitles(hls.subtitleTracks.map((v,id)=>({id,label:v.name||v.lang||`Track ${id+1}`})));setSubtitleChoice(hls.subtitleTrack)}};
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&!cancelled)setState('failed')});hls.on(Hls.Events.LEVELS_UPDATED,updateLevels);hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,updateAudio);hls.on(Hls.Events.AUDIO_TRACK_SWITCHED,updateAudio);hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,updateSubtitles);hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH,updateSubtitles);hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){updateLevels();updateAudio();updateSubtitles();setState('ready');if(autoPlay)void playAutomatically()}});hls.loadSource(url);hls.attachMedia(video)}catch{if(!cancelled)setState('failed')}
  }
  void attach();return()=>{cancelled=true;window.clearTimeout(timer);if(hlsRef.current===hls)hlsRef.current=null;hls?.destroy();video.pause();video.removeAttribute('src');video.load()};
 },[url,kind,attempt]);
 function closePlayer(){if(videoRef.current)saveProgress(videoRef.current);onClose()}
 function playFromClick(){const video=videoRef.current;if(!video)return;void video.play().catch(e=>{if(e?.name==='NotAllowedError')setState('blocked');else if(e?.name!=='AbortError')setState('failed')})}
 return <div ref={viewerRef} className={`firebase-viewer media-viewer ${className}`}><div className="firebase-viewer-top"><strong>{title}</strong><button onClick={closePlayer}>{ar?'إغلاق المشغّل':'Close player'}</button></div>
  <video key={attempt} ref={videoRef} controls playsInline preload="metadata" onPlaying={()=>setState('playing')} onLoadedMetadata={e=>restoreProgress(e.currentTarget)} onTimeUpdate={e=>{if(Date.now()-lastSaved.current>=5000)saveProgress(e.currentTarget)}} onPause={e=>{saveProgress(e.currentTarget);setState(s=>s==='playing'?'ready':s)}} onEnded={e=>saveProgress(e.currentTarget,true)} onError={()=>setState('failed')}/>
  <CastControls language={language} title={title} url={url} kind={kind} videoRef={videoRef}/>
  {(levels.length>1||audio.length>1||subtitles.length>0)&&<div className="media-tracks" aria-label={ar?'خيارات البث':'Stream options'}>
   {levels.length>1&&<label>{ar?'الجودة':'Quality'} <select value={qualityChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.currentLevel=n;setQualityChoice(n)}}}><option value={-1}>{ar?'تلقائي':'Auto'}</option>{levels.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   {audio.length>1&&<label>{ar?'الصوت':'Audio'} <select value={audioChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current&&n>=0){hlsRef.current.audioTrack=n;setAudioChoice(n)}}}><option value={-1} disabled>{ar?'اختر':'Select'}</option>{audio.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   {subtitles.length>0&&<label>{ar?'الترجمة':'Subtitles'} <select value={subtitleChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.subtitleTrack=n;hlsRef.current.subtitleDisplay=n>=0;setSubtitleChoice(n)}}}><option value={-1}>{ar?'إيقاف':'Off'}</option>{subtitles.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
  </div>}
  <div className="media-actions">{state==='failed'?<button className="media-play" onClick={()=>setAttempt(n=>n+1)}>{ar?'↻ إعادة المحاولة':'↻ Retry'}</button>:<button className="media-play" disabled={state==='loading'} onClick={playFromClick}>{state==='playing'?(ar?'▶ يستمر التشغيل':'▶ Playing'):(ar?'▶ تشغيل الآن':'▶ Play now')}</button>}
  <p className={state==='failed'?'firebase-error':'firebase-note'} role="status">{state==='loading'?(slow?(ar?'التحميل يستغرق وقتاً أطول من المعتاد؛ المصدر قد يكون بطيئاً.':'Loading is taking longer than usual; the source may be slow.'):(ar?'جاري تجهيز الفيديو…':'Preparing video…')):state==='blocked'?(ar?'المتصفح يحتاج ضغطتك لبدء التشغيل. اضغط «تشغيل الآن».':'Your browser requires a tap to start. Press “Play now”.'):state==='failed'?(ar?'تعذّر تشغيل الفيديو من المصدر. قد يكون متوقفاً أو محظوراً أو غير مدعوم.':'Could not play this video. Its source may be offline, blocked or unsupported.'):state==='playing'?(ar?'يعمل الآن؛ استخدم أزرار الفيديو للصوت وملء الشاشة.':'Playing; use video controls for sound and fullscreen.'):(ar?'اضغط «تشغيل الآن» إذا لم يبدأ الفيديو.':'Press “Play now” if the video does not start.')}</p></div>{footer}
 </div>;
}
