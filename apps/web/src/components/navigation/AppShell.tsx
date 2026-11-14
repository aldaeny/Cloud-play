'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useBranding } from '../brand/BrandingProvider';
import { brandingStyle } from '../brand/branding-style';
import { AccountProvider } from '../account/AccountProvider';
import AppHeader from '../layout/AppHeader';
import GlobalNav from '../nav/GlobalNav';
import PageTransition from '../motion/PageTransition';
import { NavigationProvider, isAppRoute, type NavigationAdapter } from './NavigationProvider';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs } from '../../lib/preferences';
import { useAppearance } from '../../lib/use-appearance';
import SkipLink from './SkipLink';

/**
 * App Router shell (/live and /live/[id]).
 *
 * It supplies the router adapter, the account context, the shared header, the
 * page transition and the floating dock. Appearance and language come from the
 * providers mounted in the root layout — this shell only mirrors the viewing
 * preferences onto `.site` for the legacy stylesheet.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const brand = useBranding();
  const router = useRouter();
  const currentPath = usePathname();
  const pathname = currentPath ?? '/live';
  const listeners = useRef(new Set<() => void>());
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const appearance = useAppearance();

  useEffect(() => { listeners.current.forEach(listener => listener()); }, [pathname]);

  const navigation = useMemo<NavigationAdapter>(() => ({
    pathname,
    push: async href => {
      if (!isAppRoute(new URL(href, window.location.origin).pathname)) window.location.assign(href);
      else router.push(href);
    },
    subscribe: listener => {
      listeners.current.add(listener);
      return () => { listeners.current.delete(listener); };
    },
  }), [pathname, router]);

  const classes = [
    'site', 'section-site', `theme-${appearance.theme === 'black' ? 'dark' : appearance.theme}`,
    appearance.reduceMotion ? 'motion-off' : '',
    !prefs.glow ? 'no-glow' : '',
    prefs.solidPanels ? 'solid-panels' : '',
    prefs.textSize === 'large' ? 'text-large' : '',
    prefs.highContrast ? 'high-contrast' : '',
  ].filter(Boolean).join(' ');

  return (
    <NavigationProvider value={navigation}>
      <AccountProvider>
        <SkipLink />
        <PageTransition>
          <div className={classes} style={brandingStyle(brand, appearance.theme)}>
            <AppHeader accountHref="/login" />
            <div id="main">{children}</div>
          </div>
        </PageTransition>
        <GlobalNav />
      </AccountProvider>
    </NavigationProvider>
  );
}
