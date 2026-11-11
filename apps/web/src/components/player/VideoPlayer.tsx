'use client';
import {usePrivateMediaUrl,PRIVATE_MEDIA_DENIED} from '../../lib/use-private-media-url';
import { usePlaybackMetrics } from '../../lib/use-playback-metrics';
import { prepareMediaSession, releaseMediaSession } from '../../lib/media-session';

import { useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, RotateCcw } from 'lucide-react';
import type Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';
import type { StreamType } from '../../types/channel';
import { PlaybackPreferencesContext } from './PlaybackPreferences';
import { getPrefsSnapshot } from '../../lib/preferences';

type Track = { id: number; label: string };
type Props = {
  src: string; type: StreamType; poster?: string; title: string; isLive: boolean;
  autoPlay?: boolean; onError?: (error: Error) => void; onQualityChange?: (quality: string) => void; onReady?: () => void;
};
type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'blocked' | 'error';
const emptyTracks = { qualities: [] as Track[], audio: [] as Track[], subtitles: [] as Track[] };
function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
function sourceError(src: string): boolean {
  try { const url = new URL(src, window.location.origin); return !['https:', 'http:'].includes(url.protocol) || Boolean(url.username || url.password); }
  catch { return true; }
}

/** Browser-native media element + on-demand MSE engines. No credentials, fake tracks or page reloads. */
export function VideoPlayer({ src:requestedSrc, type, poster, title, isLive, autoPlay, onError, onQualityChange, onReady }: Props) {
  const src=usePrivateMediaUrl(requestedSrc);
  const privateResume=useRef<{input:string;time:number;paused:boolean}|null>(null);
  useEffect(() => () => { if(src.startsWith('/api/external/'))void releaseMediaSession(src).catch(()=>{}); },[src]);
  const preferences = useContext(PlaybackPreferencesContext);
  const saved = getPrefsSnapshot();
  const shouldAutoPlay = autoPlay ?? (preferences.autoPlay && saved.playbackAuto);
  const videoRef = useRef<HTMLVideoElement>(null);
  usePlaybackMetrics(src,videoRef);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<MediaPlayerClass | null>(null);
  const callbacks = useRef({ onError, onReady, onQualityChange });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(preferences.startMuted);
  const [volume, setVolume] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tracks, setTracks] = useState(emptyTracks);
  const [quality, setQuality] = useState(-1);
  const [audio, setAudio] = useState(-1);
  const [subtitle, setSubtitle] = useState(-1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [offline, setOffline] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => { callbacks.current = { onError, onReady, onQualityChange }; }, [onError, onReady, onQualityChange]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (statusRef.current === 'playing' && !containerRef.current?.contains(document.activeElement)) setControlsVisible(false);
    }, 3500);
  }, []);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const fail = useCallback((message: string) => {
    setStatus('error'); setError(message); setControlsVisible(true);
    callbacks.current.onError?.(new Error(message));
  }, []);
  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try { await video.play(); setControlsVisible(true); }
    catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      if (cause instanceof DOMException && cause.name === 'NotAllowedError') { setStatus('blocked'); setControlsVisible(true); }
      else if (!video.error) { setStatus('ready'); setControlsVisible(true); }
    }
  }, []);
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) void play(); else video.pause();
  }, [play]);
  const toggleMute = useCallback(() => { if (videoRef.current) videoRef.current.muted = !videoRef.current.muted; }, []);
  const changeVolume = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = Math.max(0, Math.min(1, value));
    if (value > 0) video.muted = false;
  }, []);
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
      else {
        const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else fail('ملء الشاشة غير مدعوم في هذا المتصفح.');
      }
    } catch { fail('تعذر فتح ملء الشاشة. جرّب مرة أخرى من زر المشغل.'); }
  }, [fail]);
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video||!src) return;
    const resume=privateResume.current?.input===requestedSrc?privateResume.current:null;
    const restore=()=>{if(resume&&!isLive&&Number.isFinite(video.duration)&&resume.time<video.duration)video.currentTime=resume.time;};
    video.addEventListener('loadedmetadata',restore);
    let cancelled = false;
    let hls: Hls | null = null;
    let dash: MediaPlayerClass | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;
    let ready = false;
    setStatus('loading'); setError(''); setTracks(emptyTracks); setQuality(-1); setAudio(-1); setSubtitle(-1); setTime(0); setDuration(0); setControlsVisible(true);
    video.muted = preferences.startMuted || getPrefsSnapshot().playbackMuted;
    const markReady = () => {
      if (cancelled || ready) return;
      ready = true; setStatus('ready'); callbacks.current.onReady?.();
      if (shouldAutoPlay&&!resume?.paused) void play();
    };
    const timeout = setTimeout(() => { if (!cancelled && !ready) fail('انتهت مهلة الاتصال بالبث. تحقق من الشبكة ثم أعد المحاولة.'); }, 25000);
    const recoverNetwork = (retry: () => void) => {
      if (cancelled) return;
      if (!navigator.onLine) { setOffline(true); fail('انقطع الاتصال بالإنترنت. أعد المحاولة بعد عودة الشبكة.'); return; }
      if (networkRetries++ < 2) { setStatus('buffering'); setTimeout(() => { if (!cancelled) retry(); }, 1000 * networkRetries); }
      else fail('تعذر الوصول إلى مصدر البث بعد عدة محاولات. قد يكون متوقفاً أو يمنع التشغيل من هذا الموقع.');
    };
    async function attach() {
      if(src===PRIVATE_MEDIA_DENIED){fail('انتهت جلسة التشغيل أو تغيّر سياق الوصول. سجّل الدخول واختر المصدر مجدداً.');return;}
      try { await prepareMediaSession(src); } catch { fail('يرجى تسجيل الدخول؛ التشغيل المحمي غير متاح.'); return; }
      if (cancelled) return;
      if (!src || sourceError(src)) { fail('رابط البث غير صالح أو غير آمن.'); return; }
      if (type === 'mp4') { video!.src = src; video!.load(); return; }
      if (type === 'hls') {
        try {
          const { default: HlsEngine } = await import('hls.js');
          if (cancelled) return;
          if (HlsEngine.isSupported()) {
            hls = new HlsEngine({ enableWorker: true, backBufferLength: 30, manifestLoadingTimeOut: 12000, manifestLoadingMaxRetry: 2, levelLoadingTimeOut: 12000, fragLoadingTimeOut: 20000 });
            hlsRef.current = hls;
            const updateTracks = () => {
              if (!hls || cancelled) return;
              setTracks({
                qualities: hls.levels.map((level, id) => ({ id, label: level.height ? `${level.height}p` : level.name || `${Math.round(level.bitrate / 1000)} kbps` })),
                audio: hls.audioTracks.map((track, id) => ({ id, label: track.name || track.lang || `صوت ${id + 1}` })),
                subtitles: hls.subtitleTracks.map((track, id) => ({ id, label: track.name || track.lang || `ترجمة ${id + 1}` })),
              });
              setQuality(hls.autoLevelEnabled ? -1 : hls.manualLevel); setAudio(hls.audioTrack); setSubtitle(hls.subtitleDisplay ? hls.subtitleTrack : -1);
            };
            hls.on(HlsEngine.Events.MANIFEST_PARSED, () => { updateTracks(); markReady(); });
            hls.on(HlsEngine.Events.LEVELS_UPDATED, updateTracks);
            hls.on(HlsEngine.Events.AUDIO_TRACKS_UPDATED, updateTracks);
            hls.on(HlsEngine.Events.SUBTITLE_TRACKS_UPDATED, updateTracks);
            hls.on(HlsEngine.Events.LEVEL_SWITCHED, (_event, data) => {
              if (cancelled || !hls) return;
              setQuality(hls.autoLevelEnabled ? -1 : hls.manualLevel);
              const level = hls.levels[data.level];
              callbacks.current.onQualityChange?.(level?.height ? `${level.height}p` : 'auto');
            });
            hls.on(HlsEngine.Events.ERROR, (_event, data) => {
              if (cancelled || !hls) return;
              if (data.details === HlsEngine.ErrorDetails.BUFFER_STALLED_ERROR) { setStatus('buffering'); return; }
              if (!data.fatal) return;
              if (data.type === HlsEngine.ErrorTypes.NETWORK_ERROR) recoverNetwork(() => { if(src.startsWith('/api/external/'))void prepareMediaSession(src).then(()=>hls?.loadSource(src),()=>fail('انتهت جلسة التشغيل أو لم تعد القناة متاحة.'));else hls?.startLoad(); });
              else if (data.type === HlsEngine.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) hls.recoverMediaError();
              else fail(data.type === HlsEngine.ErrorTypes.KEY_SYSTEM_ERROR ? 'هذا المصدر محمي بحقوق DRM ولم يُفعّل تشغيله الآمن في المتصفح.' : 'تعذر تشغيل البث. المصدر قد يكون متوقفاً أو بترميز غير مدعوم.');
            });
            hls.loadSource(src); hls.attachMedia(video!); return;
          }
          if (video!.canPlayType('application/vnd.apple.mpegurl')) { video!.src = src; video!.load(); return; }
          fail('متصفحك لا يدعم تشغيل HLS. جرّب متصفحاً أحدث.');
        } catch { if (!cancelled) fail('تعذر تحميل مشغل HLS.'); }
        return;
      }
      try {
        const dashjs = await import('dashjs');
        if (cancelled) return;
        if (typeof MediaSource === 'undefined') { fail('متصفحك لا يدعم تشغيل DASH.'); return; }
        dash = dashjs.MediaPlayer().create(); dashRef.current = dash;
        dash.updateSettings({ streaming: { retryAttempts: { MPD: 2, MediaSegment: 2, InitializationSegment: 2 }, retryIntervals: { MPD: 1000, MediaSegment: 1500 }, abr: { autoSwitchBitrate: { video: true } } } });
        const updateTracks = () => {
          if (cancelled || !dash) return;
          const current = dash.getCurrentTrackFor('video');
          const representations = current?.bitrateList ?? [];
          setTracks({
            qualities: representations.map((item, id) => ({ id, label: item.height ? `${item.height}p` : `${Math.round((item.bandwidth ?? 0) / 1000)} kbps` })),
            audio: dash.getTracksFor('audio').map((track, id) => ({ id, label: track.labels.find(label => label.text)?.text || track.lang || `صوت ${id + 1}` })),
            subtitles: dash.getTracksFor('text').map((track, id) => ({ id, label: track.labels.find(label => label.text)?.text || track.lang || `ترجمة ${id + 1}` })),
          });
          setAudio(dash.getTracksFor('audio').findIndex(track => track.id === dash?.getCurrentTrackFor('audio')?.id));
          setSubtitle(dash.getCurrentTrackFor('text') ? dash.getTracksFor('text').findIndex(track => track.id === dash?.getCurrentTrackFor('text')?.id) : -1);
        };
        dash.on('streamInitialized', () => { updateTracks(); markReady(); });
        dash.on('qualityChangeRendered', () => {
          if (!dash || cancelled) return;
          const current = dash.getCurrentTrackFor('video');
          setQuality(current?.bitrateList.findIndex(item => item.id === dash?.getDashMetrics().getCurrentRepresentationSwitch('video')?.to) ?? -1);
          updateTracks();
        });
        dash.on('trackChangeRendered', updateTracks);
        dash.on('allTextTracksAdded', updateTracks);
        dash.on('error', () => recoverNetwork(() => dash?.attachSource(src)));
        dash.on('playbackNotAllowed', () => { if (!cancelled) { setStatus('blocked'); setControlsVisible(true); } });
        dash.on('keyError', () => fail('مصدر DASH محمي ولم يُفعّل تشغيل DRM الآمن.'));
        dash.initialize(video!, src, shouldAutoPlay);
      } catch { if (!cancelled) fail('تعذر تحميل مشغل DASH أو قراءة المصدر.'); }
    }
    void attach();
    return () => {
      if(requestedSrc.includes('&session=1'))privateResume.current={input:requestedSrc,time:video.currentTime,paused:video.paused};
      video.removeEventListener('loadedmetadata',restore);
      cancelled = true; clearTimeout(timeout);
      hls?.destroy(); dash?.reset(); hlsRef.current = null; dashRef.current = null;
      video.pause(); video.removeAttribute('src'); video.load();
    };
  }, [src, requestedSrc, isLive, type, attempt, shouldAutoPlay, preferences.startMuted, fail, play]);

  useEffect(() => {
    const online = () => { setOffline(false); if (statusRef.current === 'error') setAttempt(value => value + 1); };
    const lost = () => { setOffline(true); setStatus('buffering'); };
    window.addEventListener('online', online); window.addEventListener('offline', lost);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', lost); };
  }, []);

  const seek = useCallback((value: number) => {
    const video = videoRef.current;
    if (!video || isLive || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, value)); setTime(video.currentTime);
  }, [isLive]);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches('input,select,textarea') || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    if ([' ', 'Enter', 'MediaPlayPause', 'k', 'K'].includes(key) && !target.closest('button')) { event.preventDefault(); togglePlay(); }
    else if (['m', 'M'].includes(key)) { event.preventDefault(); toggleMute(); }
    else if (['f', 'F'].includes(key)) { event.preventDefault(); void toggleFullscreen(); }
    else if (key === 'ArrowRight' || key === 'ArrowLeft') { event.preventDefault(); if (isLive) { const edge = hlsRef.current?.liveSyncPosition; if (videoRef.current && typeof edge === 'number' && Number.isFinite(edge)) videoRef.current.currentTime = edge; dashRef.current?.seekToOriginalLive(); } else seek((videoRef.current?.currentTime ?? 0) + (key === 'ArrowRight' ? 10 : -10)); showControls(); }
    else if (key === 'ArrowUp' || key === 'ArrowDown') { event.preventDefault(); changeVolume((videoRef.current?.volume ?? 1) + (key === 'ArrowUp' ? .1 : -.1)); showControls(); }
    else if (key === 'Escape') { setSettingsOpen(false); showControls(); }
    else if (key.startsWith('MediaTrack')) { event.preventDefault(); seek(time + (key === 'MediaTrackNext' ? 30 : -30)); }
  };
  const chooseQuality = (id: number) => {
    setQuality(id);
    if (hlsRef.current) hlsRef.current.nextLevel = id;
    if (dashRef.current) {
      dashRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: id === -1 } } } });
      if (id >= 0) dashRef.current.setRepresentationForTypeByIndex('video', id);
    }
  };
  const chooseAudio = (id: number) => {
    if (hlsRef.current) hlsRef.current.audioTrack = id;
    else { const track = dashRef.current?.getTracksFor('audio')[id]; if (track) dashRef.current?.setCurrentTrack(track); }
    setAudio(id);
  };
  const chooseSubtitle = (id: number) => {
    if (hlsRef.current) { hlsRef.current.subtitleTrack = id; hlsRef.current.subtitleDisplay = id >= 0; }
    else if (dashRef.current) { dashRef.current.setTextTrack(id); }
    setSubtitle(id);
  };
  const hasSettings = tracks.qualities.length > 1 || tracks.audio.length > 1 || tracks.subtitles.length > 0;
  const busy = status === 'loading' || status === 'buffering';
  return <div ref={containerRef} className="cp-player media-player" dir="ltr" tabIndex={0} role="region" aria-label={`مشغل ${title}`} onKeyDown={onKeyDown} onPointerMove={showControls} onPointerDown={showControls} onFocusCapture={showControls} data-controls-hidden={!controlsVisible && status === 'playing' && !settingsOpen} data-playback-status={status}>
    <video ref={videoRef} poster={poster} playsInline preload="metadata" muted={muted} aria-label={title}
      onClick={() => { if (window.matchMedia('(pointer: coarse)').matches) showControls(); else togglePlay(); }}
      onLoadedMetadata={() => { setDuration(videoRef.current?.duration ?? 0); if (type === 'mp4' || (type === 'hls' && !hlsRef.current)) { setStatus(current => current === 'blocked' || current === 'error' ? current : 'ready'); callbacks.current.onReady?.(); if (shouldAutoPlay&&!(privateResume.current?.input===requestedSrc&&privateResume.current.paused)) void play(); } }}
      onPlay={() => { setStatus('playing'); showControls(); }}
      onPlaying={() => { setStatus('playing'); setOffline(false); showControls(); }}
      onPause={() => setStatus(current => current === 'error' ? current : 'paused')}
      onWaiting={() => setStatus(current => current === 'error' ? current : 'buffering')}
      onCanPlay={() => setStatus(current => current === 'playing' || current === 'error' || current === 'blocked' ? current : 'ready')}
      onVolumeChange={() => { const video = videoRef.current; if (video) { setMuted(video.muted); setVolume(video.volume); } }}
      onTimeUpdate={() => setTime(videoRef.current?.currentTime ?? 0)}
      onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
      onEnded={() => setStatus('paused')}
      onError={() => fail('تعذر قراءة الفيديو. قد يكون المصدر متوقفاً أو غير مدعوم أو محظوراً بواسطة CORS.')}/>
    <div className="cp-player-top"><strong dir="auto">{title}</strong>{isLive && <span className="live-badge live-badge-live">LIVE</span>}</div>
    {busy && <div className="cp-player-status" role="status"><span className="cp-player-spinner" aria-hidden="true"/><p>{offline ? 'بانتظار عودة الاتصال بالإنترنت…' : status === 'loading' ? 'جاري الاتصال بالبث…' : 'جاري تحميل البث…'}</p></div>}
    {status === 'error' && <div className="cp-player-status" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={18}/> إعادة المحاولة</button></div>}
    {status === 'blocked' && <div className="cp-player-status" role="status"><p>اضغط تشغيل لبدء البث؛ المتصفح يحتاج تفاعلك أولاً.</p><button type="button" onClick={() => void play()}><Play size={18}/> تشغيل</button></div>}
    {settingsOpen && hasSettings && <div className="cp-player-settings" role="group" aria-label="إعدادات البث" dir="rtl">
      {tracks.qualities.length > 1 && <label>الجودة<select value={quality} onChange={event => chooseQuality(Number(event.target.value))}><option value={-1}>تلقائي</option>{tracks.qualities.map(track => <option key={track.id} value={track.id}>{track.label}</option>)}</select></label>}
      {tracks.audio.length > 1 && <label>مسار الصوت<select value={audio} onChange={event => chooseAudio(Number(event.target.value))}>{tracks.audio.map(track => <option key={track.id} value={track.id}>{track.label}</option>)}</select></label>}
      {tracks.subtitles.length > 0 && <label>الترجمة<select value={subtitle} onChange={event => chooseSubtitle(Number(event.target.value))}><option value={-1}>إيقاف</option>{tracks.subtitles.map(track => <option key={track.id} value={track.id}>{track.label}</option>)}</select></label>}
    </div>}
    <div className="cp-player-bottom">
      {!isLive && Number.isFinite(duration) && duration > 0 && <input className="cp-player-seek" type="range" min={0} max={duration} step={1} value={Math.min(time, duration)} onChange={event => seek(Number(event.target.value))} aria-label="موضع التشغيل" aria-valuetext={`${clock(time)} من ${clock(duration)}`}/>}
      <button type="button" onClick={togglePlay} aria-label={status === 'playing' ? 'إيقاف مؤقت' : 'تشغيل'} disabled={status === 'loading' || status === 'error'}>{status === 'playing' ? <Pause size={23}/> : <Play size={23}/>}</button>
      <button type="button" onClick={toggleMute} aria-label={muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'} aria-pressed={muted}>{muted || volume === 0 ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
      <input className="cp-player-volume" type="range" min={0} max={1} step={.05} value={muted ? 0 : volume} onChange={event => changeVolume(Number(event.target.value))} aria-label="مستوى الصوت"/>
      {!isLive && <span className="cp-player-time">{clock(time)} / {clock(duration)}</span>}
      <span className="cp-player-spacer"/>
      {hasSettings && <button type="button" onClick={() => setSettingsOpen(value => !value)} aria-label="إعدادات الجودة والصوت والترجمة" aria-expanded={settingsOpen}><Settings size={20}/></button>}
      <button type="button" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}>{fullscreen ? <Minimize size={20}/> : <Maximize size={20}/>}</button>
    </div>
  </div>;
}
