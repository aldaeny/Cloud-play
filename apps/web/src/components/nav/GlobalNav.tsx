'use client';

import Link from 'next/link';
import {
  useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import Icon from '../icons/Icon';
import { useNavigation } from '../navigation/NavigationProvider';
import { useI18n } from '../../lib/i18n';
import { NAV_ROUTES, activeRoute, type NavRoute } from '../../lib/nav-routes';
import { haptic } from '../../lib/appearance';

/**
 * GLOBAL DOCK — rendered once, outside `.site`, so it persists across every
 * client-side navigation and both routers.
 *
 * A single floating glass pill: the active destination expands into an icon +
 * label capsule, the rest stay icon-only. The capsule is pure CSS (the active
 * item's padding and the label's max-width animate), so the row reflows
 * correctly in RTL and LTR with no measuring and no timer tween.
 *
 * Platform behaviour:
 *   · iPhone  — spring press feedback, springy capsule travel
 *   · Android — ripple-free press (no scale), 48dp targets
 *   · TV      — enlarged targets, arrow-key focus roving, visible focus ring
 */
export default function GlobalNav() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [popover, setPopover] = useState<NavRoute | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const btnRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPopover = useRef<string | null>(null);

  const pathname = navigation.pathname;
  const active = activeRoute(pathname);

  // Reserve space and hide legacy per-page nav rows while the dock is mounted.
  useEffect(() => {
    document.body.classList.add('cp-has-global-nav');
    return () => document.body.classList.remove('cp-has-global-nav');
  }, []);

  // Hide the dock while a media player is open (a minimised player keeps it).
  useEffect(() => {
    const check = () => setPlayerOpen(
      [...document.querySelectorAll('.media-viewer, .cp-player')].some(node => !node.closest('[data-mini-player="true"]')),
    );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    const unsubscribe = navigation.subscribe(check);
    return () => { observer.disconnect(); unsubscribe(); };
  }, [navigation]);

  const showPopover = useCallback((route: NavRoute) => {
    const element = btnRefs.current.get(route.href);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    setPopover(route);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setPopover(null), 4600);
  }, []);

  // After navigating from a dock button, pop the detail card from its new home.
  useEffect(() => {
    const complete = () => {
      const href = pendingPopover.current;
      pendingPopover.current = null;
      if (!href) return;
      const route = NAV_ROUTES.find(item => item.href === href);
      const current = activeRoute(window.location.pathname);
      if (route && current?.href === route.href) window.setTimeout(() => showPopover(route), 90);
    };
    return navigation.subscribe(complete);
  }, [navigation, showPopover]);

  useEffect(() => {
    if (!popover) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.cp-global-nav')) setPopover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPopover(null); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const onNavClick = (route: NavRoute) => (event: MouseEvent) => {
    haptic('light');
    if (active?.href === route.href) {
      event.preventDefault();
      showPopover(route);
      return;
    }
    pendingPopover.current = route.href;
  };

  // TV / keyboard: arrows move focus across the dock (logical direction).
  const onNavKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const links = Array.from(btnRefs.current.values()).filter(Boolean);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault();
    const rtl = document.documentElement.dir === 'rtl';
    const forward = event.key === 'ArrowRight' ? !rtl : rtl;
    const next = (index + (forward ? 1 : -1) + links.length) % links.length;
    links[next]?.focus({ preventScroll: true });
  };

  let popoverStyle: CSSProperties = {};
  if (anchor) {
    const width = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(anchor.x - width / 2, window.innerWidth - width - 12));
    const originX = Math.max(18, Math.min(anchor.x - left, width - 18));
    popoverStyle = {
      left,
      bottom: window.innerHeight - anchor.y + 12,
      width,
      transformOrigin: `${originX}px 100%`,
    };
  }

  return (
    <div
      className={`cp-global-nav${playerOpen ? ' cp-nav-hidden' : ''}`}
      aria-hidden={playerOpen || undefined}
    >
      <nav className="cp-nav-bar" aria-label={t('nav.main')} onKeyDown={onNavKeyDown}>
        {NAV_ROUTES.map(route => {
          const isActive = active?.href === route.href;
          const label = t(route.labelKey);
          return (
            <Link
              key={route.href}
              href={route.href}
              ref={element => {
                if (element) btnRefs.current.set(route.href, element);
                else btnRefs.current.delete(route.href);
              }}
              className={`cp-nav-btn${isActive ? ' cp-nav-active' : ''}`}
              tabIndex={playerOpen ? -1 : 0}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              title={label}
              onClick={onNavClick(route)}
            >
              <span className="cp-nav-ico"><Icon name={route.icon} size={22} /></span>
              <span className="cp-nav-label">{label}</span>
            </Link>
          );
        })}
      </nav>
      <Link
        href="/search"
        className="cp-nav-search"
        tabIndex={playerOpen ? -1 : 0}
        aria-label={t('header.search')}
        title={t('common.search')}
        onClick={() => haptic('light')}
      >
        <Icon name="search" size={22} />
      </Link>
      {popover && anchor && (
        <div className="cp-nav-popover" role="status" style={popoverStyle}>
          <span className="cp-nav-popover-icon"><Icon name={popover.icon} size={20} /></span>
          <div className="cp-nav-popover-copy">
            <strong>{t(popover.labelKey)}</strong>
            <p>{t(popover.descKey)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
