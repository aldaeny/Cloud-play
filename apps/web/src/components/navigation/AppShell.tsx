'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AccountProvider } from '../account/AccountProvider';
import AppHeader from '../layout/AppHeader';
import GlobalNav from '../nav/GlobalNav';
import PageTransition from '../motion/PageTransition';
import { NavigationProvider, isAppRoute, type NavigationAdapter } from './NavigationProvider';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs, setPref, notifyPrefsChanged } from '../../lib/preferences';
import { readAppearance } from '../../lib/appearance';


export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const currentPath = usePathname();
  const pathname = currentPath ?? '/live';
  const listeners = useRef(new Set<() => void>());
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  useEffect(() => { readAppearance(); notifyPrefsChanged(); }, []);
  useEffect(() => {
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = prefs.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.style.colorScheme = prefs.theme;
  }, [prefs.language, prefs.theme]);
  useEffect(() => { listeners.current.forEach(listener => listener()); }, [pathname]);
  const navigation = useMemo<NavigationAdapter>(() => ({
    pathname,
    push: async href => {
      if (!isAppRoute(new URL(href, window.location.origin).pathname)) window.location.assign(href);
      else router.push(href);
    },
    subscribe: listener => {
      listeners.current.add(listener);
      return () => listeners.current.delete(listener);
    },
  }), [pathname, router]);
  const ar = prefs.language === 'ar';
  const classes = ['site', 'section-site', `theme-${prefs.theme}`, prefs.reduceMotion ? 'motion-off' : '', !prefs.glow ? 'no-glow' : '', prefs.solidPanels ? 'solid-panels' : '', prefs.textSize === 'large' ? 'text-large' : '', prefs.highContrast ? 'high-contrast' : ''].filter(Boolean).join(' ');
  return <NavigationProvider value={navigation}>
    <AccountProvider>
      <PageTransition>
        <div className={classes} dir={ar ? 'rtl' : 'ltr'}>
          <AppHeader language={prefs.language} theme={prefs.theme}
            onToggleLanguage={() => setPref('cloudplay-language', ar ? 'en' : 'ar')}
            onToggleTheme={() => setPref('cloudplay-theme', prefs.theme === 'dark' ? 'light' : 'dark')} />
          {children}
        </div>
      </PageTransition>
      <GlobalNav />
    </AccountProvider>
  </NavigationProvider>;
}
