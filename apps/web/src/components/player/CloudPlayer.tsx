/**
 * CloudPlayer — the built-in, in-page video player.
 *
 * "VLC-style" here means: every control lives inside our own UI (no reliance on
 * the browser's native control bar, no external player, no iframe), keyboard
 * shortcuts, volume with a mute toggle, seek, quality and audio-track selection,
 * fullscreen, playback stats, and explicit loading/playing/error states with a
 * bounded retry loop.
 *
 * Playback engine order:
 *   1. native HLS (Safari / iOS / some Android WebViews) — always preferred there;
 *   2. hls.js (MSE) everywhere else;
 *   3. direct src for progressive MP4.
 *
 * Resource discipline: exactly one engine instance at a time, destroyed on
 * unmount/URL change, listeners removed, and every retry timer cleared so two
 * channels can never play at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  INITIAL_RETRY_STATE,
  classifyFailure,
  classifyHlsError,
  classifyMediaError,
  clampVolume,
  formatBitrate,
  formatTime,
  levelLabel,
  noteSuccess,
  resolveKey,
  seekTarget,
  type PlayerError,
  type PlayerStatus,
  type RetryState,
} from './player-logic';

type Language = 'ar' | 'en';
type Track = { id: number; label: string };
type Props = {
  language: Language;
  title: string;
  url: string;
  kind: 'hls' | 'mp4';
  onClose: () => void;
  className?: string;
  footer?: ReactNode;
  /** Test hook: identify the player instance in the DOM. */
  testId?: string;
};

const SEEK_STEP = 10;
const HIDE_CONTROLS_MS = 2600;

export default function CloudPlayer({ language, title, url, kind, onClose, className = '', footer, testId = 'cloud-player' }: Props) {
  const ar = language === 'ar';

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const retryTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const retryState = useRef<RetryState>({ ...INITIAL_RETRY_STATE });
  const startedAt = useRef<number>(0);

  const [status, setStatus] = useState<PlayerStatus>('loading');
  const [error, setError] = useState<PlayerError | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number.NaN);
  const [levels, setLevels] = useState<Track[]>([]);
  const [levelChoice, setLevelChoice] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(-1);
  const [bitrate, setBitrate] = useState<number | undefined>(undefined);
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [audioChoice, setAudioChoice] = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [engine, setEngine] = useState<'native' | 'hls.js' | 'progressive' | 'pending'>('pending');
  const [startupMs, setStartupMs] = useState<number | null>(null);

  const isLive = !Number.isFinite(duration) || duration === 0;

  const labels = useMemo(
    () => ({
      play: ar ? 'تشغيل' : 'Play',
      pause: ar ? 'إيقاف مؤقت' : 'Pause',
      mute: ar ? 'كتم الصوت' : 'Mute',
      unmute: ar ? 'إلغاء الكتم' : 'Unmute',
      volume: ar ? 'مستوى الصوت' : 'Volume',
      seek: ar ? 'موضع التشغيل' : 'Seek',
      forward: ar ? 'تقديم 10 ثوانٍ' : 'Forward 10s',
      back: ar ? 'إرجاع 10 ثوانٍ' : 'Back 10s',
      fullscreen: ar ? 'ملء الشاشة' : 'Fullscreen',
      exitFullscreen: ar ? 'إنهاء ملء الشاشة' : 'Exit fullscreen',
      quality: ar ? 'الجودة' : 'Quality',
      audio: ar ? 'الصوت' : 'Audio',
      auto: ar ? 'تلقائي' : 'Auto',
      stats: ar ? 'بيانات التشغيل' : 'Playback stats',
      close: ar ? 'إغلاق المشغّل' : 'Close player',
      loading: ar ? 'جاري تحميل البث…' : 'Loading stream…',
      stalled: ar ? 'البث متوقف مؤقتاً…' : 'Stream is buffering…',
      ready: ar ? 'جاهز — اضغط تشغيل' : 'Ready — press play',
      retry: ar ? '↻ إعادة المحاولة' : '↻ Retry',
      retrying: ar ? 'إعادة المحاولة تلقائياً…' : 'Retrying automatically…',
      autoplay: ar ? 'المتصفح يمنع التشغيل التلقائي. اضغط تشغيل.' : 'Your browser blocked autoplay. Press play.',
      failed: ar ? 'تعذّر تشغيل هذه القناة.' : 'This channel could not be played.',
      unsupported: ar ? 'هذا المتصفح لا يدعم هذا البث.' : 'This browser cannot play this stream.',
      live: ar ? 'مباشر' : 'LIVE',
      engine: ar ? 'المحرك' : 'Engine',
      buffered: ar ? 'مُخزَّن مؤقتاً' : 'Buffered',
      startup: ar ? 'زمن البدء' : 'Startup',
      errorKind: ar ? 'نوع الخطأ' : 'Error',
      keyboard: ar ? 'مسافة تشغيل · ← → تقديم · M كتم · F ملء الشاشة' : 'Space play · ← → seek · M mute · F fullscreen',
      hint: ar ? 'مشغّل كلاود بلاي المدمج — لا حاجة لتطبيق خارجي.' : 'Cloud Play’s built-in player — no external app needed.',
    }),
    [ar],
  );

  /* ------------------------------------------------------------ engine setup */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    setStatus('loading');
    setError(null);
    setLevels([]);
    setAudioTracks([]);
    setLevelChoice(-1);
    setAutoLevel(-1);
    setBitrate(undefined);
    setAudioChoice(-1);
    setDuration(Number.NaN);
    setCurrentTime(0);
    setBuffered(0);
    setStartupMs(null);
    retryState.current = { ...INITIAL_RETRY_STATE };
    startedAt.current = performance.now();

    function clearRetry() {
      if (retryTimer.current !== null) {
        window.clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    }

    function scheduleRetry() {
      clearRetry();
      retryTimer.current = window.setTimeout(() => {
        if (!cancelled) setAttempt((value) => value + 1);
      }, 800);
    }

    function handleFailure(kind: Parameters<typeof classifyFailure>[0]) {
      if (cancelled) return;
      const outcome = classifyFailure(kind, retryState.current);
      retryState.current = outcome.next;
      setError(outcome.error);
      if (outcome.fatal) {
        setStatus(outcome.error.kind === 'blocked' ? 'ready' : 'error');
        return;
      }
      setStatus('loading');
      clearRetry();
      retryTimer.current = window.setTimeout(() => {
        if (!cancelled) setAttempt((value) => value + 1);
      }, outcome.delayMs);
    }

    async function startPlayback() {
      try {
        await video!.play();
      } catch (playError) {
        if (cancelled) return;
        const name = playError instanceof Error ? playError.name : '';
        if (name === 'NotAllowedError') {
          // Autoplay policy is not a stream failure: show a ready state and let
          // the user press play.
          setError({ kind: 'blocked', code: 'AUTOPLAY_BLOCKED', attempts: 0, fatal: true });
          setStatus('ready');
          return;
        }
        if (name === 'AbortError') return;
        if (video!.error) handleFailure(classifyMediaError(video!.error.code));
      }
    }

    function attachNative() {
      video!.src = url;
      setEngine(kind === 'mp4' ? 'progressive' : 'native');
      setStatus('ready');
      void startPlayback();
    }

    async function attach() {
      // 1. Native HLS wins on Apple platforms: it is hardware-accelerated and
      //    avoids an extra MSE layer.
      if (kind === 'mp4') return attachNative();
      if (video!.canPlayType('application/vnd.apple.mpegurl')) return attachNative();

      try {
        const Hls = (await import('hls.js')).default;
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setError({ kind: 'unsupported', code: 'MSE_UNAVAILABLE', attempts: 0, fatal: true });
          setStatus('error');
          return;
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 20,
          manifestLoadingTimeOut: 12_000,
          levelLoadingTimeOut: 12_000,
          fragLoadingTimeOut: 20_000,
        });
        hlsRef.current = hls;
        setEngine('hls.js');

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setStatus('playing');
          void startPlayback();
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          if (cancelled) return;
          setAutoLevel(data.level);
          setLevelChoice(hls.autoLevelEnabled ? -1 : hls.manualLevel);
          // Observed bitrate of the level actually being played, not a guess.
          setBitrate(hls.levels[data.level]?.bitrate);
        });
        hls.on(Hls.Events.LEVELS_UPDATED, () => {
          if (cancelled) return;
          setLevels(hls.levels.map((level, id) => ({ id, label: levelLabel(level.height, level.bitrate, id) })));
        });
        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
          if (cancelled) return;
          setAudioTracks(hls.audioTracks.map((track, id) => ({ id, label: track.name || track.lang || `Track ${id + 1}` })));
          setAudioChoice(hls.audioTrack);
        });
        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
          if (!cancelled) setAudioChoice(hls.audioTrack);
        });
        hls.on(Hls.Events.FRAG_LOADED, () => {
          if (cancelled) return;
          retryState.current = noteSuccess(retryState.current);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (cancelled) return;
          handleFailure(classifyHlsError(data));
        });

        hls.loadSource(url);
        hls.attachMedia(video!);
        setStatus('loading');
        void startPlayback();
      } catch {
        if (!cancelled) {
          setError({ kind: 'unsupported', code: 'HLS_ENGINE_FAILED', attempts: 0, fatal: true });
          setStatus('error');
        }
      }
    }

    void attach();

    return () => {
      cancelled = true;
      clearRetry();
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      const hls = hlsRef.current;
      hlsRef.current = null;
      if (hls) {
        hls.stopLoad();
        hls.detachMedia();
        hls.destroy();
      }
      video.pause();
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* Some engines throw when load() follows a destroyed MSE pipeline. */
      }
    };
  }, [url, kind, attempt]);

  /* ----------------------------------------------------------- media events */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => {
      setStatus('playing');
      setPlaying(true);
      if (startupMs === null && startedAt.current) setStartupMs(Math.round(performance.now() - startedAt.current));
    };
    const onPause = () => {
      setPlaying(false);
      setStatus((current) => (current === 'playing' ? 'ready' : current));
    };
    const onWaiting = () => setStatus('stalled');
    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onDuration = () => setDuration(video.duration);
    const onVolume = () => {
      setVolume(clampVolume(video.volume));
      setMuted(video.muted);
    };
    const onError = () => {
      if (!video.error) return;
      const kind = classifyMediaError(video.error.code);
      setError({ kind, code: kind === 'unsupported' ? 'UNSUPPORTED_STREAM' : 'MEDIA_ERROR', attempts: 0, fatal: true });
      setStatus('error');
    };
    const onEnded = () => setStatus('ready');

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('volumechange', onVolume);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('volumechange', onVolume);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
    };
  }, [status, startupMs]);

  /* ------------------------------------------------------------- fullscreen */

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await node.requestFullscreen();
    } catch {
      /* Older iOS Safari has no element fullscreen; the video stays inline. */
    }
  }, []);

  /* ---------------------------------------------------------------- actions */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch((playError: unknown) => {
        const name = playError instanceof Error ? playError.name : '';
        if (name === 'NotAllowedError') {
          setError({ kind: 'blocked', code: 'AUTOPLAY_BLOCKED', attempts: 0, fatal: true });
          setStatus('ready');
        }
      });
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const changeVolume = useCallback((next: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = clampVolume(next);
    if (video.volume > 0 && video.muted) video.muted = false;
  }, []);

  const skip = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const target = seekTarget(video.currentTime, video.duration, delta);
    if (target !== null) video.currentTime = target;
  }, []);

  const retryNow = useCallback(() => {
    retryState.current = { ...INITIAL_RETRY_STATE };
    setError(null);
    setStatus('loading');
    setAttempt((value) => value + 1);
  }, []);

  const close = useCallback(() => {
    const video = videoRef.current;
    video?.pause();
    onClose();
  }, [onClose]);

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a form field.
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;
      const action = resolveKey(event.key, event.shiftKey);
      if (!action) return;
      if (action === 'escape') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else close();
        return;
      }
      event.preventDefault();
      if (action === 'togglePlay') togglePlay();
      if (action === 'mute') toggleMute();
      if (action === 'fullscreen') void toggleFullscreen();
      if (action === 'seekForward') skip(SEEK_STEP);
      if (action === 'seekBack') skip(-SEEK_STEP);
      if (action === 'volumeUp') changeVolume((videoRef.current?.volume ?? 1) + 0.1);
      if (action === 'volumeDown') changeVolume((videoRef.current?.volume ?? 1) - 0.1);
      if (action === 'retry') retryNow();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay, toggleMute, toggleFullscreen, skip, changeVolume, retryNow, close]);

  /* ------------------------------------------------- auto-hide the chrome */

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), HIDE_CONTROLS_MS);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
  }, []);

  /* --------------------------------------------------------------- rendering */

  const progress = Number.isFinite(duration) && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = Number.isFinite(duration) && duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  const statusText =
    status === 'loading'
      ? labels.loading
      : status === 'stalled'
        ? labels.stalled
        : error?.kind === 'blocked'
          ? labels.autoplay
          : status === 'error'
            ? error?.kind === 'unsupported'
              ? labels.unsupported
              : labels.failed
            : status === 'ready'
              ? labels.ready
              : '';

  return (
    <div
      ref={containerRef}
      className={`cloud-player ${className}${fullscreen ? ' is-fullscreen' : ''}${controlsVisible ? ' controls-on' : ' controls-off'}`}
      data-testid={testId}
      data-status={status}
      data-engine={engine}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onMouseLeave={() => setControlsVisible(false)}
    >
      <div className="cloud-player-stage" onClick={togglePlay} role="presentation">
        <video
          key={attempt}
          ref={videoRef}
          className="cloud-player-video"
          playsInline
          preload="metadata"
          muted={muted}
          controls={false}
          onClick={(event) => {
            event.stopPropagation();
            togglePlay();
          }}
        />

        {/* Centre status / error surface */}
        {status === 'loading' && (
          <div className="cloud-player-overlay cloud-player-loading" role="status" aria-live="polite">
            <span className="cloud-spinner" aria-hidden="true" />
            <p>
              {error && !error.fatal
                ? `${labels.retrying} (${error.attempts})`
                : labels.loading}
            </p>
          </div>
        )}

        {status === 'stalled' && (
          <div className="cloud-player-overlay cloud-player-loading" role="status" aria-live="polite">
            <span className="cloud-spinner" aria-hidden="true" />
            <p>{labels.stalled}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="cloud-player-overlay cloud-player-error" role="alert">
            <p className="cloud-player-error-title">{error?.kind === 'unsupported' ? labels.unsupported : labels.failed}</p>
            <p className="cloud-player-error-code">
              {labels.errorKind}: <code>{error?.code ?? 'UNKNOWN'}</code>
            </p>
            <button className="cloud-btn cloud-btn-primary" onClick={retryNow}>
              {labels.retry}
            </button>
          </div>
        )}

        {status === 'ready' && error?.kind === 'blocked' && (
          <button className="cloud-player-bigplay" onClick={togglePlay} aria-label={labels.play}>
            <span aria-hidden="true">▶</span>
          </button>
        )}
      </div>

      {/* Control bar — our own, so the look is identical on every platform. */}
      <div className="cloud-controls" role="group" aria-label={labels.seek}>
        <div className="cloud-progress-row">
          <span className="cloud-time">{formatTime(currentTime, false)}</span>
          <div className="cloud-progress">
            <div className="cloud-progress-buffer" style={{ width: `${bufferedPercent}%` }} aria-hidden="true" />
            <div className="cloud-progress-played" style={{ width: `${progress}%` }} aria-hidden="true" />
            <input
              className="cloud-progress-input"
              type="range"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 0}
              step={0.1}
              value={Number.isFinite(duration) && duration > 0 ? Math.min(currentTime, duration) : 0}
              disabled={!Number.isFinite(duration) || duration <= 0}
              aria-label={labels.seek}
              onChange={(event) => {
                const video = videoRef.current;
                if (video) video.currentTime = Number(event.target.value);
              }}
            />
          </div>
          <span className="cloud-time">{isLive ? labels.live : formatTime(duration, false)}</span>
        </div>

        <div className="cloud-controls-row">
          <button className="cloud-icon-btn" onClick={togglePlay} aria-label={playing ? labels.pause : labels.play} title={playing ? labels.pause : labels.play}>
            {playing ? '❚❚' : '▶'}
          </button>
          <button className="cloud-icon-btn" onClick={() => skip(-SEEK_STEP)} aria-label={labels.back} title={labels.back}>
            ⟲
          </button>
          <button className="cloud-icon-btn" onClick={() => skip(SEEK_STEP)} aria-label={labels.forward} title={labels.forward}>
            ⟳
          </button>
          <button className="cloud-icon-btn" onClick={toggleMute} aria-label={muted ? labels.unmute : labels.mute} title={muted ? labels.unmute : labels.mute}>
            {muted || volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            className="cloud-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label={labels.volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
          />

          <span className="cloud-live-badge">{isLive ? labels.live : formatTime(currentTime)}</span>

          <span className="cloud-spacer" />

          {levels.length > 1 && (
            <label className="cloud-select">
              <span>{labels.quality}</span>
              <select
                value={levelChoice}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setLevelChoice(value);
                  if (hlsRef.current) hlsRef.current.currentLevel = value;
                }}
              >
                <option value={-1}>{labels.auto}</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {audioTracks.length > 1 && (
            <label className="cloud-select">
              <span>{labels.audio}</span>
              <select
                value={audioChoice}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAudioChoice(value);
                  if (hlsRef.current) hlsRef.current.audioTrack = value;
                }}
              >
                {audioTracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button className="cloud-icon-btn" onClick={() => setShowStats((value) => !value)} aria-label={labels.stats} aria-pressed={showStats} title={labels.stats}>
            ⓘ
          </button>
          <button className="cloud-icon-btn" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen} title={fullscreen ? labels.exitFullscreen : labels.fullscreen}>
            {fullscreen ? '🗗' : '⛶'}
          </button>
          <button className="cloud-icon-btn cloud-close-btn" onClick={close} aria-label={labels.close} title={labels.close}>
            ✕
          </button>
        </div>

        {showStats && (
          <div className="cloud-stats" role="status">
            <span>
              {labels.engine}: <strong>{engine}</strong>
            </span>
            <span>
              {labels.buffered}: <strong>{formatTime(buffered)}</strong>
            </span>
            {startupMs !== null && (
              <span>
                {labels.startup}: <strong>{startupMs} ms</strong>
              </span>
            )}
            {formatBitrate(bitrate) && (
              <span>
                Bitrate: <strong>{formatBitrate(bitrate)}</strong>
              </span>
            )}
            <span>
              {labels.keyboard}
            </span>
          </div>
        )}
      </div>

      <div className="cloud-player-caption">
        <strong>{title}</strong>
        <small>{labels.hint}</small>
      </div>
      {footer}
    </div>
  );
}
