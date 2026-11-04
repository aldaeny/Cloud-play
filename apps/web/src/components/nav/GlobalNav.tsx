import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import Icon from '../icons/Icon';
import { NAV_ROUTES, activeRoute, type NavRoute } from '../../lib/nav-routes';

/**
 * GLOBAL NAVIGATION — rendered once in `_app`, so it persists across every
 * client-side navigation (never remounts, never disappears on scroll). It is a
 * sibling of `.site`, so the page fold/unfold transition happens behind it while
 * the bar stays fixed. Active state is derived from the router; the floating
 * active button and the per-page detail popover are driven from here.
 */
export default function GlobalNav() {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [flags, setFlags] = useState({ motionOff: false, noGlow: false, solid: false });
  const [playerOpen, setPlayerOpen] = useState(false);
  const [popover, setPopover] = useState<NavRoute | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; placement: 'top' | 'bottom' } | null>(null);
  const btnRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const pendingPopover = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pathname = router.asPath.split('?')[0];
  const active = activeRoute(pathname);
  const ar = lang === 'ar';

  // Keep theme / language / viewing preferences in sync with the active page
  // (pages own `.site` classes and <html lang/dir>; we observe, never duplicate).
  useEffect(() => {
    const sync = () => {
      const site = document.querySelector('.site');
      setTheme(site?.classList.contains('theme-light') ? 'light' : 'dark');
      setLang(document.documentElement.lang === 'en' ? 'en' : 'ar');
      setFlags({
        motionOff: !!site?.classList.contains('motion-off'),
        noGlow: !!site?.classList.contains('no-glow'),
        solid: !!site?.classList.contains('solid-panels'),
      });
    };
    sync();
    const htmlObs = new MutationObserver(sync);
    htmlObs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir'] });
    let siteObs: MutationObserver | null = null;
    const attach = () => {
      siteObs?.disconnect();
      const site = document.querySelector('.site');
      if (site) { siteObs = new MutationObserver(sync); siteObs.observe(site, { attributes: true, attributeFilter: ['class'] }); }
      sync();
    };
    attach();
    router.events.on('routeChangeComplete', attach);
    return () => { htmlObs.disconnect(); siteObs?.disconnect(); router.events.off('routeChangeComplete', attach); };
  }, [router]);

  // Reserve space + hide the legacy per-page nav rows while this bar is mounted.
  useEffect(() => {
    document.body.classList.add('cp-has-global-nav');
    return () => document.body.classList.remove('cp-has-global-nav');
  }, []);

  // Hide the bar while a media player is open so it never covers player controls.
  useEffect(() => {
    const check = () => setPlayerOpen(!!document.querySelector('.media-viewer'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    router.events.on('routeChangeComplete', check);
    return () => { obs.disconnect(); router.events.off('routeChangeComplete', check); };
  }, [router]);

  const showPopover = useCallback((route: NavRoute) => {
    const el = btnRefs.current.get(route.href);
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The dock is fixed at the bottom on every platform, so the card always
    // unfolds upward from the active button.
    setAnchor({ x: r.left + r.width / 2, y: r.top, placement: 'top' });
    setPopover(route);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPopover(null), 4200);
  }, []);

  // After a nav-button navigation completes, pop the detail card from the now-active button.
  useEffect(() => {
    const onComplete = () => {
      const href = pendingPopover.current;
      pendingPopover.current = null;
      if (!href) return;
      const route = NAV_ROUTES.find(r => r.href === href);
      const current = activeRoute(window.location.pathname);
      if (route && current?.href === route.href) setTimeout(() => showPopover(route), 80);
    };
    router.events.on('routeChangeComplete', onComplete);
    return () => router.events.off('routeChangeComplete', onComplete);
  }, [router, showPopover]);

  // Dismiss on outside interaction or Escape.
  useEffect(() => {
    if (!popover) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.cp-global-nav')) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopover(null); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [popover]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const onNavClick = (route: NavRoute) => (e: MouseEvent) => {
    if (active?.href === route.href) { e.preventDefault(); showPopover(route); return; }
    // Queue the detail card; PageTransition performs the animated push. The
    // route-match check in onComplete guarantees only one card, for the page we
    // actually land on (rapid presses during a transition are ignored by the lock).
    pendingPopover.current = route.href;
  };

  // Position the fixed popover near its anchor, clamped to the viewport.
  let popStyle: CSSProperties = {};
  if (anchor) {
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(anchor.x - width / 2, window.innerWidth - width - 12));
    const originX = Math.max(18, Math.min(anchor.x - left, width - 18));
    popStyle = anchor.placement === 'bottom'
      ? { left, top: anchor.y + 12, width, transformOrigin: `${originX}px 0` }
      : { left, bottom: window.innerHeight - anchor.y + 12, width, transformOrigin: `${originX}px 100%` };
  }

  return (
    <div
      className={`cp-global-nav theme-${theme}${flags.motionOff ? ' motion-off' : ''}${flags.noGlow ? ' no-glow' : ''}${flags.solid ? ' solid-panels' : ''}${playerOpen ? ' cp-nav-hidden' : ''}`}
      dir={ar ? 'rtl' : 'ltr'}
    >
      <nav className="cp-nav-bar" aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
        {NAV_ROUTES.map(route => {
          const isActive = active?.href === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              ref={el => { if (el) btnRefs.current.set(route.href, el); else btnRefs.current.delete(route.href); }}
              className={`cp-nav-btn${isActive ? ' cp-nav-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={ar ? route.ar : route.en}
              onClick={onNavClick(route)}
            >
              <Icon name={route.icon} size={19} />
              <span className="cp-nav-label">{ar ? route.ar : route.en}</span>
            </Link>
          );
        })}
      </nav>
      {popover && anchor && (
        <div className={`cp-nav-popover cp-pop-${anchor.placement}`} role="status" style={popStyle}>
          <span className="cp-nav-popover-icon"><Icon name={popover.icon} size={20} /></span>
          <div className="cp-nav-popover-copy">
            <strong>{ar ? popover.ar : popover.en}</strong>
            <p>{ar ? popover.descAr : popover.descEn}</p>
          </div>
        </div>
      )}
    </div>
  );
}
