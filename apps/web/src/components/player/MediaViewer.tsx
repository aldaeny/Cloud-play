import { usePlaybackMetrics } from '../../lib/use-playback-metrics';
import { prepareMediaSession, releaseMediaSession } from '../../lib/media-session';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PlaybackPreferencesContext } from './PlaybackPreferences';
import CastControls from './CastControls';
import { notifyLibraryChanged } from '../../lib/preferences';
type Language='ar'|'en';
type State='loading'|'ready'|'playing'|'buffering'|'blocked'|'failed';
type Track={label:string;id:number};
type Props={language:Language;title:string;url:string;kind:'hls'|'mp4'|'dash';onClose:()=>void;className?:string;footer?:ReactNode;progressKey?:string};
export default function MediaViewer({language,title,url,kind,onClose,className='',footer,progressKey}:Props){
 useEffect(()=>()=>{if(url.startsWith('/api/external/'))void releaseMediaSession(url).catch(()=>{});},[url]);
 const preferences=useContext(PlaybackPreferencesContext);const preferencesRef=useRef(preferences);const [initialScroll]=useState(preferences.scrollToPlayer);
 useEffect(()=>{preferencesRef.current=preferences},[preferences]);
 const lastSaved=useRef(0);
 function saveProgress(video:HTMLVideoElement, ended=false){if(!progressKey)return;try{const k=`cloudplay-progress-v1-${progressKey}`;if(ended||(Number.isFinite(video.duration)&&video.duration>0&&video.currentTime>=video.duration-10)){localStorage.removeItem(k);notifyLibraryChanged();return;}if(Number.isFinite(video.duration)&&video.duration>20&&Number.isFinite(video.currentTime)&&video.currentTime>=5){localStorage.setItem(k,JSON.stringify({position:Math.floor(video.currentTime),duration:Math.floor(video.duration)}));lastSaved.current=Date.now();notifyLibraryChanged();}}catch{/* Playback remains usable without storage. */}}
 function restoreProgress(video:HTMLVideoElement){if(!progressKey)return;try{const p=JSON.parse(localStorage.getItem(`cloudplay-progress-v1-${progressKey}`)||'null');if(p&&Number.isFinite(p.position)&&p.position>=5&&Number.isFinite(video.duration)&&p.position<video.duration-10)video.currentTime=p.position;}catch{/* Ignore unavailable or invalid storage. */}}
 const hlsRef=useRef<import('hls.js').default|null>(null);const dashRef=useRef<import('dashjs').MediaPlayerClass|null>(null);const failTimerRef=useRef<number|null>(null);const [levels,setLevels]=useState<Track[]>([]);const [audio,setAudio]=useState<Track[]>([]);const [subtitles,setSubtitles]=useState<Track[]>([]);const [qualityChoice,setQualityChoice]=useState(-1);const [audioChoice,setAudioChoice]=useState(-1);const [subtitleChoice,setSubtitleChoice]=useState(-1);
 const ar=language==='ar';const videoRef=useRef<HTMLVideoElement>(null);const viewerRef=useRef<HTMLDivElement>(null);const [state,setState]=useState<State>('loading');const [slow,setSlow]=useState(false);const [attempt,setAttempt]=useState(0);
 usePlaybackMetrics(url,videoRef);
 useEffect(()=>{if(initialScroll)viewerRef.current?.scrollIntoView({behavior:(viewerRef.current?.closest('.motion-off') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)?'instant':'smooth',block:'center'})},[initialScroll]);
 useEffect(()=>{
  const video=videoRef.current;if(!video)return;const {autoPlay,startMuted}=preferencesRef.current;video.muted=startMuted;let cancelled=false;let hls:import('hls.js').default|null=null;setState('loading');setSlow(false);setLevels([]);setAudio([]);setSubtitles([]);setQualityChoice(-1);setAudioChoice(-1);setSubtitleChoice(-1);
  let networkRetries=0;let mediaRetries=0;let recovered=false;
  const slowTimer=window.setTimeout(()=>{if(!cancelled)setSlow(true)},18000);
  const failTimer=window.setTimeout(()=>{if(!cancelled&&!recovered)setState('failed')},30000);failTimerRef.current=failTimer;
  const markRecovered=()=>{recovered=true;window.clearTimeout(failTimer)};
  const retryNetwork=(retry:()=>void)=>{if(cancelled)return;if(!navigator.onLine){setState('failed');return}if(networkRetries++<2){setState('buffering');window.setTimeout(()=>{if(!cancelled)retry()},1000*networkRetries)}else setState('failed')};
  async function playAutomatically(){try{await video!.play()}catch(e){if(cancelled)return;const name=e instanceof Error?e.name:'';if(name==='AbortError')return;if(name==='NotAllowedError')setState('blocked');else if(video!.error)setState('failed');else setState('ready')}}
  async function attach(){
   try{await prepareMediaSession(url)}catch{if(!cancelled)setState('failed');return}
   if(cancelled)return;
   if(!video)return;
   if(kind==='mp4'||(kind==='hls'&&video.canPlayType('application/vnd.apple.mpegurl'))){video.src=url;setState('ready');if(autoPlay)void playAutomatically();return}
   if(kind==='dash'){try{const dashjs=await import('dashjs');if(cancelled)return;const dash=dashjs.MediaPlayer().create();dashRef.current=dash;dash.updateSettings({streaming:{retryAttempts:{MPD:2,MediaSegment:2}}});dash.on('streamInitialized',()=>{if(!cancelled){markRecovered();setState('ready');if(autoPlay)void playAutomatically()}});dash.on('error',()=>retryNetwork(()=>dash.attachSource(url)));dash.on('playbackNotAllowed',()=>{if(!cancelled)setState('blocked')});dash.initialize(video,url,autoPlay);return}catch{if(!cancelled)setState('failed');return}}
   try{const Hls=(await import('hls.js')).default;if(cancelled)return;if(!Hls.isSupported()){setState('failed');return}hls=new Hls({enableWorker:true});hlsRef.current=hls;
   const updateLevels=()=>{if(!cancelled&&hls){setLevels(hls.levels.map((v,id)=>({id,label:v.height?`${v.height}p`:(v.name||`${Math.round(v.bitrate/1000)} kbps`)})));setQualityChoice(hls.manualLevel)}};
   const updateAudio=()=>{if(!cancelled&&hls){setAudio(hls.audioTracks.map((v,id)=>({id,label:v.name||v.lang||`Track ${id+1}`})));setAudioChoice(hls.audioTrack)}};
   const updateSubtitles=()=>{if(!cancelled&&hls){setSubtitles(hls.subtitleTracks.map((v,id)=>({id,label:v.name||v.lang||`Track ${id+1}`})));setSubtitleChoice(hls.subtitleTrack)}};
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(cancelled||!hls)return;if(data.details===Hls.ErrorDetails.BUFFER_STALLED_ERROR)return;if(!data.fatal)return;if(data.type===Hls.ErrorTypes.NETWORK_ERROR)retryNetwork(()=>hls?.startLoad());else if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&mediaRetries++<1)hls.recoverMediaError();else setState('failed')});hls.on(Hls.Events.LEVELS_UPDATED,updateLevels);hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,updateAudio);hls.on(Hls.Events.AUDIO_TRACK_SWITCHED,updateAudio);hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,updateSubtitles);hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH,updateSubtitles);hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){markRecovered();updateLevels();updateAudio();updateSubtitles();setState('ready');if(autoPlay)void playAutomatically()}});hls.loadSource(url);hls.attachMedia(video)}catch{if(!cancelled)setState('failed')}
  }
  void attach();return()=>{cancelled=true;window.clearTimeout(slowTimer);window.clearTimeout(failTimer);if(hlsRef.current===hls)hlsRef.current=null;hls?.destroy();dashRef.current?.reset();dashRef.current=null;video.pause();video.removeAttribute('src');video.load()};
 },[url,kind,attempt]);
 function closePlayer(){if(videoRef.current)saveProgress(videoRef.current);onClose()}
 function playFromClick(){const video=videoRef.current;if(!video)return;void video.play().catch(e=>{if(e?.name==='NotAllowedError')setState('blocked');else if(e?.name!=='AbortError')setState('failed')})}
 return <div ref={viewerRef} className={`firebase-viewer media-viewer ${className}`}><div className="firebase-viewer-top"><strong>{title}</strong><button onClick={closePlayer}>{ar?'إغلاق المشغّل':'Close player'}</button></div>
  <video key={attempt} ref={videoRef} controls playsInline preload="metadata" onPlaying={()=>{if(failTimerRef.current)window.clearTimeout(failTimerRef.current);setState('playing')}} onWaiting={()=>setState(s=>s==='failed'?s:'buffering')} onCanPlay={()=>setState(s=>s==='playing'||s==='failed'?s:'ready')} onLoadedMetadata={e=>{if(failTimerRef.current)window.clearTimeout(failTimerRef.current);restoreProgress(e.currentTarget)}} onTimeUpdate={e=>{if(Date.now()-lastSaved.current>=5000)saveProgress(e.currentTarget)}} onPause={e=>{saveProgress(e.currentTarget);setState(s=>s==='playing'?'ready':s)}} onEnded={e=>saveProgress(e.currentTarget,true)} onError={()=>setState('failed')}/>
  <CastControls language={language} title={title} url={url} kind={kind} videoRef={videoRef}/>
  {(levels.length>1||audio.length>1||subtitles.length>0)&&<div className="media-tracks" aria-label={ar?'خيارات البث':'Stream options'}>
   {levels.length>1&&<label>{ar?'الجودة':'Quality'} <select value={qualityChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.currentLevel=n;setQualityChoice(n)}}}><option value={-1}>{ar?'تلقائي':'Auto'}</option>{levels.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   {audio.length>1&&<label>{ar?'الصوت':'Audio'} <select value={audioChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current&&n>=0){hlsRef.current.audioTrack=n;setAudioChoice(n)}}}><option value={-1} disabled>{ar?'اختر':'Select'}</option>{audio.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   {subtitles.length>0&&<label>{ar?'الترجمة':'Subtitles'} <select value={subtitleChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.subtitleTrack=n;hlsRef.current.subtitleDisplay=n>=0;setSubtitleChoice(n)}}}><option value={-1}>{ar?'إيقاف':'Off'}</option>{subtitles.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
  </div>}
  <div className="media-actions">{state==='failed'?<button className="media-play" onClick={()=>setAttempt(n=>n+1)}>{ar?'↻ إعادة المحاولة':'↻ Retry'}</button>:<button className="media-play" disabled={state==='loading'} onClick={()=>{const video=videoRef.current;if(video&&!video.paused){video.pause();return}playFromClick()}}>{state==='playing'?(ar?'⏸ إيقاف مؤقت':'⏸ Pause'):(ar?'▶ تشغيل الآن':'▶ Play now')}</button>}
  <p className={state==='failed'?'firebase-error':'firebase-note'} role="status">{state==='loading'?(slow?(ar?'التحميل يستغرق وقتاً أطول من المعتاد؛ المصدر قد يكون بطيئاً.':'Loading is taking longer than usual; the source may be slow.'):(ar?'جاري تجهيز الفيديو…':'Preparing video…')):state==='blocked'?(ar?'المتصفح يحتاج ضغطتك لبدء التشغيل. اضغط «تشغيل الآن».':'Your browser requires a tap to start. Press “Play now”.'):state==='failed'?(ar?'تعذّر تشغيل الفيديو من المصدر. قد يكون متوقفاً أو محظوراً أو غير مدعوم.':'Could not play this video. Its source may be offline, blocked or unsupported.'):state==='buffering'?(ar?'جاري تحميل البث… تحقق من الاتصال إذا استمر الانتظار.':'Buffering… check your connection if this continues.'):state==='playing'?(ar?'يعمل الآن؛ استخدم أزرار الفيديو للصوت وملء الشاشة.':'Playing; use video controls for sound and fullscreen.'):(ar?'اضغط «تشغيل الآن» إذا لم يبدأ الفيديو.':'Press “Play now” if the video does not start.')}</p></div>{footer}
 </div>;
}
