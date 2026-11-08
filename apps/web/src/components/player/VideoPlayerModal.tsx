'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Star, PictureInPicture2, Maximize2, Tv } from 'lucide-react';
import type { Channel } from '../../types/channel';
import { VideoPlayer } from './VideoPlayer';

type Props = {
  channel: Channel;
  language: 'ar' | 'en';
  favorite: boolean;
  onFavoriteToggle: (id: string) => void;
  onClose: () => void;
};

/**
 * Pop-up player.
 *
 * Reuses the app's real `VideoPlayer` (hls.js / dash.js / native MP4, quality,
 * audio, subtitles, retry, keyboard) instead of a second playback stack. Closing
 * unmounts the player, which destroys the MSE engine and detaches the source, so
 * no bandwidth is used after dismissal. "Minimize" keeps the very same element
 * mounted in a small floating card (and uses native Picture-in-Picture when the
 * browser offers it) so browsing continues without restarting the stream.
 */
export function VideoPlayerModal({ channel, language, favorite, onFavoriteToggle, onClose }: Props) {
  const ar = language === 'ar';
  const [mini, setMini] = useState(false);
  const [nativePip, setNativePip] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const miniRef = useRef(mini);
  useEffect(() => { miniRef.current = mini; }, [mini]);

  const close = useCallback(() => {
    const video = panelRef.current?.querySelector('video');
    if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {});
    onClose();
  }, [onClose]);

  // Escape closes; Tab stays inside the dialog while it is expanded.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab' || miniRef.current || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,video[controls],[tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      restoreFocusRef.current?.focus?.();
    };
  }, [close]);

  // Lock page scroll behind the expanded dialog only.
  useEffect(() => {
    if (mini) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [mini]);

  // Native PiP opens an OS-level window; the in-app card then collapses to a
  // restore bar (the element must stay mounted for PiP to keep playing).
  useEffect(() => {
    const video = panelRef.current?.querySelector('video');
    if (!video) return;
    const entered = () => setNativePip(true);
    const left = () => setNativePip(false);
    video.addEventListener('enterpictureinpicture', entered);
    video.addEventListener('leavepictureinpicture', left);
    return () => { video.removeEventListener('enterpictureinpicture', entered); video.removeEventListener('leavepictureinpicture', left); };
  }, []);

  const minimize = async () => {
    const video = panelRef.current?.querySelector('video');
    setMini(true);
    if (video && document.pictureInPictureEnabled && video.readyState >= 1) {
      try { await video.requestPictureInPicture(); } catch { /* in-app floating card still works */ }
    }
  };

  const restore = () => {
    const video = panelRef.current?.querySelector('video');
    if (video && document.pictureInPictureElement === video) void document.exitPictureInPicture().catch(() => {});
    setMini(false);
  };

  // The dialog only mounts after a user interaction, so `document` always exists.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="cp-tw" dir={ar ? 'rtl' : 'ltr'} data-mini-player={mini ? 'true' : 'false'}>
      <div
        data-testid="player-backdrop"
        onClick={close}
        aria-hidden="true"
        className={mini ? 'tw-hidden' : 'tw-fixed tw-inset-0 tw-z-[70] tw-bg-black/80 tw-backdrop-blur-md tw-animate-cp-fade-in'}
      />
      <div
        ref={panelRef}
        role={mini ? 'region' : 'dialog'}
        aria-modal={mini ? undefined : true}
        aria-label={ar ? `مشغل ${channel.name}` : `${channel.name} player`}
        data-testid="player-modal"
        className={mini
          ? 'tw-fixed tw-bottom-28 tw-right-4 tw-z-[70] tw-w-60 tw-overflow-hidden tw-rounded-xl tw-border tw-border-line tw-bg-panel tw-shadow-2xl tw-animate-cp-pop-in md:tw-bottom-6 md:tw-w-72'
          : 'tw-fixed tw-inset-0 tw-z-[71] tw-m-auto tw-flex tw-h-fit tw-max-h-[92vh] tw-w-[min(960px,94vw)] tw-flex-col tw-overflow-hidden tw-rounded-2xl tw-border tw-border-line tw-bg-panel tw-shadow-2xl tw-animate-cp-pop-in'}
      >
        <div className="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-line tw-bg-ink tw-px-3 tw-py-2">
          <span className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-md tw-bg-panel">
            {channel.logo && !logoFailed
              ? <Image src={channel.logo} alt="" width={32} height={32} unoptimized referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} className="tw-h-full tw-w-full tw-object-contain" />
              : <Tv size={16} className="tw-text-muted" aria-hidden="true" />}
          </span>
          <span className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-2">
            <strong title={channel.name} className="tw-truncate tw-text-sm tw-text-white">{channel.name}</strong>
            {channel.isLive && !mini && (
              <span className="tw-flex tw-shrink-0 tw-items-center tw-gap-1 tw-rounded-full tw-bg-red-600/15 tw-px-2 tw-py-0.5 tw-text-[10px] tw-font-bold tw-text-red-500">
                <span className="tw-h-1.5 tw-w-1.5 tw-rounded-full tw-bg-red-500 tw-animate-cp-live-pulse" aria-hidden="true" />
                LIVE
              </span>
            )}
          </span>
          {!mini && (
            <button
              type="button"
              onClick={() => onFavoriteToggle(channel.id)}
              aria-pressed={favorite}
              aria-label={`${favorite ? (ar ? 'إزالة من المفضلة' : 'Remove favorite') : (ar ? 'إضافة إلى المفضلة' : 'Add favorite')}: ${channel.name}`}
              className={`tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg hover:tw-bg-panelHover focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet ${favorite ? 'tw-text-amber-400' : 'tw-text-muted'}`}
            >
              <Star size={17} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (mini) restore(); else void minimize(); }}
            aria-label={mini ? (ar ? 'استعادة المشغل' : 'Restore player') : (ar ? 'تصغير المشغل' : 'Minimize player')}
            className="tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-text-muted hover:tw-bg-panelHover hover:tw-text-white focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet"
          >
            {mini ? <Maximize2 size={17} aria-hidden="true" /> : <PictureInPicture2 size={17} aria-hidden="true" />}
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={ar ? 'إغلاق المشغل' : 'Close player'}
            className="tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-text-muted hover:tw-bg-panelHover hover:tw-text-white focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={mini && nativePip ? 'tw-h-px tw-overflow-hidden tw-opacity-0' : 'tw-bg-black'}>
          <VideoPlayer
            src={channel.streamUrl}
            type={channel.streamType}
            poster={channel.logo || undefined}
            title={channel.name}
            isLive={channel.isLive}
            autoPlay
          />
        </div>

        {mini && nativePip && (
          <button type="button" onClick={restore} className="tw-w-full tw-bg-ink tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-text-violet hover:tw-bg-panelHover">
            {ar ? 'البث في نافذة عائمة — اضغط للعودة' : 'Playing in a floating window — tap to return'}
          </button>
        )}
        {!mini && (
          <p className="tw-bg-ink tw-px-3 tw-py-2 tw-text-[11px] tw-leading-5 tw-text-muted">
            {ar ? 'الجودة المعروضة هي المعلنة من المصدر. اضغط Escape أو خارج النافذة للإغلاق؛ يتوقف البث فوراً.' : 'Declared quality comes from the source. Press Escape or click outside to close; the stream stops immediately.'}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
