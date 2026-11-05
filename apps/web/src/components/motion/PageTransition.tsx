import { useRouter } from 'next/router';
import { useEffect, type ReactNode } from 'react';

/**
 * CLOUD PLAY IRAQ — unified main-navigation transition (P0).
 *
 * A single 3D "fold-away → unfold-open" system shared by Home · Movie · Series ·
 * TV (all 12 directions). It intercepts plain left-clicks on the four main links,
 * folds the current page away, navigates, then unfolds the next page in — with no
 * blank flash, direction awareness, overlap locking and reduced-motion support.
 * Links remain real anchors, so navigation still works without JavaScript.
 */

const MAIN_ORDER: Record<string, number> = { '/': 0, '/movies': 1, '/series': 2, '/live': 3 };

function mainIndex(pathname: string): number {
  if (pathname in MAIN_ORDER) return MAIN_ORDER[pathname];
  return -1;
}
function readMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? (raw.endsWith('s') && !raw.endsWith('ms') ? n * 1000 : n) : fallback;
}
function reducedMotion(): boolean {
  return (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || !!document.querySelector('.site.motion-off');
}
function siteEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.site');
}
// Fallback for browsers without :has() — keep the backdrop in the active theme
// while a page is folded away so no wrong-coloured frame flashes through.
function paintBackdrop() {
  document.body.style.background = siteEl()?.classList.contains('theme-light') ? '#f6f7fb' : '#08090d';
}
function clearBackdrop() {
  document.body.style.background = '';
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    let locked = false;
    let pendingDir = 0; // +1 forward, -1 back
    let prevPath = router.asPath.split('?')[0];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const clearTransition = (el: HTMLElement) => {
      delete el.dataset.cpTransition;
      delete el.dataset.cpDir;
      el.style.willChange = '';
    };

    // Robust completion: only the element's OWN cp-page-* animation counts (child
    // animations bubble up and must not finish the page transition early), the
    // callback runs exactly once, and the fallback timer is cancelled on completion.
    const animate = (node: HTMLElement, duration: number, onDone: () => void) => {
      let finished = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (finished) return;
        finished = true;
        node.removeEventListener('animationend', onEnd);
        clearTimeout(timer);
        onDone();
      };
      const onEnd = (e: AnimationEvent) => {
        if (e.target === node && typeof e.animationName === 'string' && e.animationName.startsWith('cp-page-')) finish();
      };
      node.addEventListener('animationend', onEnd);
      timer = setTimeout(finish, duration + 150);
      timers.push(timer);
    };

    const playEnter = () => {
      const el = siteEl();
      if (!el) return;
      const path = router.asPath.split('?')[0];
      const from = mainIndex(prevPath);
      const to = mainIndex(path);
      const dir = pendingDir !== 0 ? pendingDir : (from >= 0 && to >= 0 ? (to < from ? -1 : 1) : 1);
      prevPath = path;
      pendingDir = 0;
      if (reducedMotion() || mainIndex(path) < 0) { locked = false; return; }
      requestAnimationFrame(() => {
        const node = siteEl();
        if (!node) { locked = false; return; }
        paintBackdrop();
        node.dataset.cpTransition = 'entering';
        if (dir < 0) node.dataset.cpDir = 'back'; else delete node.dataset.cpDir;
        animate(node, readMs('--cp-motion-page-in', 480), () => { clearTransition(node); clearBackdrop(); locked = false; });
      });
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      let url: URL;
      try { url = new URL(anchor.href, window.location.origin); } catch { return; }
      if (url.origin !== window.location.origin) return;
      const target = url.pathname.replace(/\/$/, '') || '/';
      const current = router.asPath.split('?')[0].replace(/\/$/, '') || '/';
      if (mainIndex(target) < 0 || target === current) return;

      event.preventDefault();
      if (locked) return; // prevent overlapping transitions on rapid presses
      const dir = mainIndex(target) < mainIndex(current) ? -1 : 1;
      pendingDir = dir;

      if (reducedMotion()) { void router.push(url.pathname + url.search); return; }
      const el = siteEl();
      if (!el) { void router.push(url.pathname + url.search); return; }
      locked = true;
      paintBackdrop();
      el.dataset.cpTransition = 'leaving';
      if (dir < 0) el.dataset.cpDir = 'back'; else delete el.dataset.cpDir;
      animate(el, readMs('--cp-motion-page-out', 300), () => { clearTransition(el); void router.push(url.pathname + url.search); });
    };

    const onComplete = () => { playEnter(); };

    document.addEventListener('click', onClick, true);
    router.events.on('routeChangeComplete', onComplete);
    document.documentElement.setAttribute('data-motion-ready', '');
    return () => {
      document.documentElement.removeAttribute('data-motion-ready');
      document.removeEventListener('click', onClick, true);
      router.events.off('routeChangeComplete', onComplete);
      timers.forEach(clearTimeout);
      clearBackdrop();
      const el = siteEl();
      if (el) clearTransition(el);
    };
  }, [router]);

  return <>{children}</>;
}
