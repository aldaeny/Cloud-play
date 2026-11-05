'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, ChevronDown, SkipBack, SkipForward, Loader2 } from 'lucide-react';
import { Channel } from '@/types/channel';

export function VideoPlayer({ 
  src, 
  type, 
  poster, 
  title, 
  isLive, 
  drm, 
  headers, 
  autoPlay = true,
  onError,
  onQualityChange,
  onReady
}: {
  src: string;
  type: "hls" | "dash" | "mp4" | "youtube";
  poster?: string;
  title: string;
  isLive: boolean;
  drm?: any;
  headers?: Record<string, string>;
  autoPlay?: boolean;
  onError?: (err: Error) => void;
  onQualityChange?: (q: string) => void;
  onReady?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls
  const hideControls = () => {
    setControlsVisible(false);
  };

  const showControls = () => {
    setControlsVisible(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(hideControls, 3000);
  };

  useEffect(() => {
    if (isPlaying && containerRef.current) {
      showControls();
    }
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      } else if (e.code === 'KeyM') {
        setMuted(prev => !prev);
      } else if (e.code === 'KeyF') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!fullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setFullscreen(false);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  };

  const handleMute = () => {
    setMuted(!muted);
    if (videoRef.current) videoRef.current.muted = !muted;
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const err = (e.target as HTMLVideoElement).error;
    setError(err?.message || "خطأ في التشغيل");
    onError?.(err || new Error("Playback error"));
  };

  const handleLoadedMetadata = () => {
    setBuffering(false);
    onReady?.();
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[16/9] bg-black overflow-hidden group"
      onMouseEnter={showControls}
      onMouseLeave={() => isPlaying && hideControls()}
      onClick={handlePlayPause}
    >
      {/* Video Element */}
      {type === 'youtube' ? (
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${src}?autoplay=${autoPlay ? 1 : 0}&controls=0`}
          allow="autoplay; fullscreen"
          allowFullscreen
        />
      ) : (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          className="w-full h-full object-contain"
          autoPlay={autoPlay}
          muted={muted}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => setBuffering(false)}
        />
      )}

      {/* Error Screen */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
          <h3 className="text-xl font-bold mb-2">خطأ في التشغيل</h3>
          <p className="text-sm text-gray-300 mb-6 text-center">{error}</p>
          <button 
            onClick={() => { setError(null); window.location.reload(); }}
            className="bg-[#A855F7] hover:bg-[#9345e7] text-white px-6 py-2 rounded-full font-semibold transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Buffering Spinner */}
      {buffering && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#A855F7] animate-spin" />
        </div>
      )}

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 w-full p-4 flex items-center justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => { /* Back logic */ }} className="text-white p-2 bg-black/40 rounded-full hover:bg-black/60">
            <SkipBack size={20} />
          </button>
          <h2 className="text-white font-semibold text-lg">{title}</h2>
          {isLive && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
        </div>
        <div className="flex items-center gap-2">
          <button className="text-white p-2 bg-black/40 rounded-full hover:bg-black/60"><Settings size={20} /></button>
          <button onClick={toggleFullscreen} className="text-white p-2 bg-black/40 rounded-full hover:bg-black/60">
            {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className={`absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* Progress Bar */}
        {!isLive && (
          <div className="w-full h-1 bg-gray-600 rounded-full mb-4 relative cursor-pointer">
            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] w-1/3 rounded-full" />
          </div>
        )}

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handlePlayPause} className="text-white hover:text-[#A855F7] transition-colors">
              {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
            </button>
            
            <div className="flex items-center gap-2 text-white">
              <button onClick={handleMute} className="hover:text-[#A855F7]">
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={muted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="w-24 accent-[#A855F7]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="text-white hover:text-[#A855F7] flex items-center gap-1 text-sm">
              <span className="bg-[#A855F7] px-2 py-0.5 rounded text-[10px]">HD</span>
              <ChevronDown size={16} />
            </button>
            <button className="text-white hover:text-[#A855F7]"><Settings size={20} /></button>
            <button onClick={toggleFullscreen} className="text-white hover:text-[#A855F7]">
              {fullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Title Overlay */}
      <div className={`absolute bottom-20 left-4 right-4 text-white text-sm font-bold transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        {title} {isLive && '·'} {isLive && 'بث مباشر'}
      </div>
    </div>
  );
}
