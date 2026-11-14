'use client';

import { useEffect, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import Icon from '../icons/Icon';
import { useI18n } from '../../lib/i18n';
import { useAppearance } from '../../lib/use-appearance';

/**
 * The identity intro.
 *
 * Two modes, one surface:
 *   · `intro`    — plays once, then dismisses itself (the brand reveal).
 *   · `identity` — the same frame held on screen until the visitor closes it,
 *                  which is what “عرض شاشة الهوية” means on the brand page.
 *
 * The chime is synthesised with WebAudio: no audio file to download, nothing to
 * cache, and it stays silent when the visitor prefers reduced motion or turned
 * sound off. It never autoplays on page load — only on an explicit gesture.
 */
export default function BrandIntro({
  open,
  mode,
  sound,
  onClose,
}: {
  open: boolean;
  mode: 'intro' | 'identity';
  sound: boolean;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const appearance = useAppearance();
  const [leaving, setLeaving] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  const close = () => {
    setLeaving(true);
    window.setTimeout(onClose, 260);
  };

  function chime() {
    try {
      const Context = window.AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      const ctx = audioRef.current ?? new Context();
      audioRef.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      // Two bell partials: a fifth, an octave above, then a soft tail.
      [
        { hz: 659.25, at: 0.02, gain: 0.16, length: 1.5 },
        { hz: 987.77, at: 0.14, gain: 0.11, length: 1.7 },
        { hz: 1318.5, at: 0.3, gain: 0.05, length: 1.2 },
      ].forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.hz;
        gain.gain.setValueAtTime(0.0001, now + note.at);
        gain.gain.exponentialRampToValueAtTime(note.gain, now + note.at + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.length);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + note.at);
        osc.stop(now + note.at + note.length + 0.1);
      });
    } catch {
      /* Audio is a nicety: a blocked context must not break the reveal. */
    }
  }

  /* Chime + auto-dismiss. Re-runs for every new opening. */
  useEffect(() => {
    if (sound && !appearance.reduceMotion) chime();
    const duration = appearance.reduceMotion ? 1100 : mode === 'intro' ? 4200 : 0;
    if (!duration) return;
    const timer = window.setTimeout(close, duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one shot per opening
  }, [open, mode, sound]);

  /* Escape closes; the page behind stays put. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closing is stable enough here
  }, [open]);



  useEffect(() => () => { void audioRef.current?.close(); }, []);

  if (!open) return null;

  return (
    <div
      className={`cp-identity${leaving ? ' is-closing' : ''}${appearance.reduceMotion ? ' motion-off' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('brand.identity')}
    >
      <div className="cp-identity__aurora" aria-hidden="true" />
      <button type="button" className="cp-identity__close cp-icon-btn" onClick={close} aria-label={t('common.close')}>
        <Icon name="close" size={18} />
      </button>

      <div className="cp-identity__stage">
        <div className="cp-identity__mark"><BrandMark size={216} /></div>
        <div className="cp-identity__word">
          <span className="cp-identity__name"><b>Cloud</b> Play</span>
          <span className="cp-identity__tag">ENTERTAINMENT ANYWHERE</span>
        </div>
        <div className="cp-identity__rule" aria-hidden="true" />
        <p className="cp-identity__line">{lang === 'ar' ? 'كل ما تحب مشاهدته في مكان واحد' : 'Everything you love, in one place'}</p>
        <p className="cp-identity__sub">
          {lang === 'ar' ? 'أفلام • مسلسلات • قنوات • بث مباشر' : 'Films • Series • Channels • Live TV'}
        </p>
        {mode === 'identity' && (
          <button type="button" className="cp-btn cp-identity__done" onClick={close}>
            {lang === 'ar' ? 'تم' : 'Done'}
          </button>
        )}
        <span className="cp-sr-only" aria-live="polite">
          {lang === 'ar' ? 'شعار كلاود بلاي: كل ما تحب مشاهدته في مكان واحد' : 'Cloud Play: everything you love, in one place'}
        </span>
      </div>
    </div>
  );
}
