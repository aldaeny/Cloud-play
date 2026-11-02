import { useEffect, useRef, useState } from 'react';

type IntroChoice = { language: 'ar' | 'en'; theme: 'dark' | 'light' };

/** The four user-provided openings correspond to the saved language and appearance. */
export default function IntroLayer() {
  const [choice, setChoice] = useState<IntroChoice | null>(null);
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const finished = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    setLeaving(true);
    closeTimer.current = setTimeout(() => setVisible(false), 350);
  }

  useEffect(() => {
    let language: IntroChoice['language'] = 'ar';
    let theme: IntroChoice['theme'] = 'dark';
    let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    try {
      if (localStorage.getItem('cloudplay-language') === 'en') language = 'en';
      if (localStorage.getItem('cloudplay-theme') === 'light') theme = 'light';
      if (localStorage.getItem('cloudplay-reduce-motion') === 'true') reduceMotion = true;
    } catch { /* Storage is optional. */ }
    if (reduceMotion) {
      finished.current = true;
      Promise.resolve().then(() => setVisible(false));
    } else {
      Promise.resolve().then(() => setChoice({ language, theme }));
    }
    // A stalled or unsupported video must never prevent using the site.
    const safety = setTimeout(() => finish(), 9000);
    return () => { clearTimeout(safety); if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  useEffect(() => {
    if (!visible || !choice) return;
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = htmlOverflow; document.body.style.overflow = bodyOverflow; };
  }, [visible, choice]);

  if (!visible || !choice) return null;
  const ar = choice.language === 'ar';
  return (
    <div className={`intro-layer reference-intro reference-intro-${choice.theme}${leaving ? ' reference-intro-exit' : ''}`}>
      <video
        className="reference-intro-video"
        src={`/intro/${choice.theme}-${choice.language}.mp4`}
        autoPlay muted playsInline preload="auto"
        aria-hidden="true"
        onEnded={finish}
        onError={finish}
        onCanPlay={event => { void event.currentTarget.play().catch(finish); }}
      />
      <button type="button" className="reference-intro-skip" onClick={finish} aria-label={ar ? 'تخطي المقدمة' : 'Skip intro'}>
        {ar ? 'تخطي المقدمة' : 'Skip intro'} <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
