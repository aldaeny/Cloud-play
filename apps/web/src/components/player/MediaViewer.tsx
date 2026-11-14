import { usePlaybackMetrics } from '../../lib/use-playback-metrics';
import { prepareMediaSession, releaseMediaSession } from '../../lib/media-session';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PlaybackPreferencesContext } from './PlaybackPreferences';
import CastControls from './CastControls';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, X, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
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
 const [playing,setPlaying]=useState(false);const [time,setTime]=useState(0);const [duration,setDuration]=useState(0);const [muted,setMuted]=useState(preferences.startMuted);const [full,setFull]=useState(false);
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
   hls.on(Hls.Events.ERROR,(_event,data)=>{if(cancelled||!hls)return;if(data.details===Hls.ErrorDetails.BUFFER_STALLED_ERROR)return;if(!data.fatal)return;if(data.type===Hls.ErrorTypes.NETWORK_ERROR)retryNetwork(()=>{if(url.startsWith('/api/external/'))void prepareMediaSession(url).then(()=>hls?.loadSource(url),()=>{if(!cancelled)setState('failed')});else hls?.startLoad()});else if(data.type===Hls.ErrorTypes.MEDIA_ERROR&&mediaRetries++<1)hls.recoverMediaError();else setState('failed')});hls.on(Hls.Events.LEVELS_UPDATED,updateLevels);hls.on(Hls.Events.AUDIO_TRACKS_UPDATED,updateAudio);hls.on(Hls.Events.AUDIO_TRACK_SWITCHED,updateAudio);hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,updateSubtitles);hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH,updateSubtitles);hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(!cancelled){markRecovered();updateLevels();updateAudio();updateSubtitles();setState('ready');if(autoPlay)void playAutomatically()}});hls.loadSource(url);hls.attachMedia(video)}catch{if(!cancelled)setState('failed')}
  }
  void attach();return()=>{cancelled=true;window.clearTimeout(slowTimer);window.clearTimeout(failTimer);if(hlsRef.current===hls)hlsRef.current=null;hls?.destroy();dashRef.current?.reset();dashRef.current=null;video.pause();video.removeAttribute('src');video.load()};
 },[url,kind,attempt]);
 function closePlayer(){if(videoRef.current)saveProgress(videoRef.current);onClose()}
 function playFromClick(){const video=videoRef.current;if(!video)return;void video.play().catch(e=>{if(e?.name==='NotAllowedError')setState('blocked');else if(e?.name!=='AbortError')setState('failed')})}
 function togglePlay(){const v=videoRef.current;if(!v)return;if(v.paused)playFromClick();else v.pause()}
 function seekTo(value:number){const v=videoRef.current;if(v&&Number.isFinite(v.duration)){v.currentTime=Math.max(0,Math.min(v.duration,value));setTime(v.currentTime)}}
 function toggleMute(){const v=videoRef.current;if(v){v.muted=!v.muted;setMuted(v.muted)}}
 function toggleFull(){const stage=viewerRef.current?.querySelector('.cp-player');if(!stage)return;if(document.fullscreenElement)void document.exitFullscreen();else void (stage as HTMLElement).requestFullscreen?.()}
 useEffect(()=>{const onChange=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange)},[]);
 const fmt=(value:number)=>!Number.isFinite(value)?'0:00':`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
 const notice=state==='failed'?(ar?'تعذّر تشغيل الفيديو من المصدر. قد يكون متوقفاً أو محظوراً أو غير مدعوم.':'Could not play this video. Its source may be offline, blocked or unsupported.'):state==='blocked'?(ar?'المتصفح يحتاج ضغطتك لبدء التشغيل.':'Your browser requires a tap to start playback.'):slow?(ar?'التحميل يستغرق وقتاً أطول من المعتاد.':'Loading is taking longer than usual.'):'';
 return <div ref={viewerRef} className={`cp-viewer ${className}`}>
  <div className="cp-player" role="region" aria-label={`${ar ? 'مشغل' : 'Player'}: ${title}`} data-playback-status={state}>
   <video key={attempt} ref={videoRef} playsInline preload="metadata"
    onPlaying={()=>{if(failTimerRef.current)window.clearTimeout(failTimerRef.current);setState('playing');setPlaying(true)}}
    onPlay={()=>setPlaying(true)} onPause={e=>{saveProgress(e.currentTarget);setState(s=>s==='playing'?'ready':s);setPlaying(false)}}
    onWaiting={()=>setState(s=>s==='failed'?s:'buffering')} onCanPlay={()=>setState(s=>s==='playing'||s==='failed'?s:'ready')}
    onLoadedMetadata={e=>{if(failTimerRef.current)window.clearTimeout(failTimerRef.current);restoreProgress(e.currentTarget);setDuration(e.currentTarget.duration);setMuted(e.currentTarget.muted)}}
    onTimeUpdate={e=>{setTime(e.currentTarget.currentTime);setDuration(e.currentTarget.duration);if(Date.now()-lastSaved.current>=5000)saveProgress(e.currentTarget)}}
    onVolumeChange={e=>setMuted(e.currentTarget.muted)}
    onEnded={e=>{saveProgress(e.currentTarget,true);setPlaying(false)}} onError={()=>setState('failed')}/>
   <div className="cp-player-top"><strong dir="auto">{title}</strong>
    <button type="button" className="cp-player-pill" onClick={toggleFull} aria-label={ar?'ملء الشاشة':'Full screen'}>{full?<Minimize size={17}/>:<Maximize size={17}/>}</button>
    <button type="button" className="cp-player-pill" onClick={closePlayer} aria-label={ar?'إغلاق المشغّل':'Close player'}><X size={17}/></button>
   </div>
   {(state==='loading'||state==='buffering')&&<div className="cp-player-status" role="status"><span className="cp-player-spinner" aria-hidden="true"/><p>{ar?'جارٍ تجهيز الفيديو…':'Preparing video…'}</p></div>}
   {(state==='failed'||state==='blocked')&&<div className="cp-player-status" role="alert"><p>{notice}</p><button type="button" className="cp-btn" data-variant="primary" onClick={()=>state==='failed'?setAttempt(n=>n+1):playFromClick()}>{state==='failed'?<RotateCcw size={17}/>:<Play size={17}/>}{state==='failed'?(ar?'إعادة المحاولة':'Try again'):(ar?'تشغيل':'Play')}</button></div>}
   {!playing && state!=='failed' && state!=='blocked' && <button type="button" className="cp-player-center" onClick={togglePlay} aria-label={ar?'تشغيل':'Play'}><Play size={30} fill="currentColor"/></button>}
   <div className="cp-player-bottom">
    <div className="cp-player-seekrow">
     <input className="cp-player-seek" type="range" min={0} max={Number.isFinite(duration)&&duration>0?duration:0} step={0.5} value={Math.min(time,duration||0)} onChange={e=>seekTo(Number(e.target.value))} aria-label={ar?'موضع التشغيل':'Seek'} style={{['--cp-slider-progress' as string]:`${duration?(Math.min(time,duration)/duration)*100:0}%`}}/>
     <span className="cp-player-time cp-num">{fmt(time)}</span>
     <span className="cp-player-time cp-player-time--remaining cp-num">−{fmt(Math.max(0,(duration||0)-time))}</span>
    </div>
    <div className="cp-player-bar">
     <button type="button" className="cp-player-key" onClick={togglePlay} aria-label={playing?(ar?'إيقاف مؤقت':'Pause'):(ar?'تشغيل':'Play')} disabled={state==='loading'}>{playing?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button>
     <button type="button" className="cp-player-skip" onClick={()=>seekTo(time-10)} aria-label={ar?'رجوع ١٠ ثوانٍ':'Back 10 seconds'}><SkipBack size={18}/></button>
     <button type="button" className="cp-player-skip" onClick={()=>seekTo(time+10)} aria-label={ar?'تقدّم ١٠ ثوانٍ':'Forward 10 seconds'}><SkipForward size={18}/></button>
     <button type="button" className="cp-player-key" onClick={toggleMute} aria-label={muted?(ar?'تشغيل الصوت':'Unmute'):(ar?'كتم الصوت':'Mute')} aria-pressed={muted}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
     <span className="cp-player-spacer"/>
     <button type="button" className="cp-player-key" onClick={toggleFull} aria-label={full?(ar?'الخروج من ملء الشاشة':'Exit full screen'):(ar?'ملء الشاشة':'Full screen')}>{full?<Minimize size={19}/>:<Maximize size={19}/>}</button>
    </div>
   </div>
  </div>

  <div className="cp-viewer__meta">
   <CastControls language={language} title={title} url={url} kind={kind} videoRef={videoRef}/>
   {(levels.length>1||audio.length>1||subtitles.length>0)&&<div className="cp-viewer__tracks" aria-label={ar?'خيارات البث':'Stream options'}>
    {levels.length>1&&<label>{ar?'الجودة':'Quality'}<select value={qualityChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.currentLevel=n;setQualityChoice(n)}}}><option value={-1}>{ar?'تلقائي':'Auto'}</option>{levels.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
    {audio.length>1&&<label>{ar?'الصوت':'Audio'}<select value={audioChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current&&n>=0){hlsRef.current.audioTrack=n;setAudioChoice(n)}}}><option value={-1} disabled>{ar?'اختر':'Select'}</option>{audio.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
    {subtitles.length>0&&<label>{ar?'الترجمة':'Subtitles'}<select value={subtitleChoice} onChange={e=>{const n=Number(e.target.value);if(hlsRef.current){hlsRef.current.subtitleTrack=n;hlsRef.current.subtitleDisplay=n>=0;setSubtitleChoice(n)}}}><option value={-1}>{ar?'إيقاف':'Off'}</option>{subtitles.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>}
   </div>}
   {notice&&state!=='failed'&&state!=='blocked'&&<p className="cp-viewer__status" role="status">{notice}</p>}
   {footer}
  </div>
 </div>;
}
