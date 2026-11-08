'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { NavigationProvider, isAppRoute, type NavigationAdapter } from './NavigationProvider';

export default function PagesShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigation = useMemo<NavigationAdapter>(() => ({
    pathname: router.asPath.split('?')[0],
    push: async href => {
      if (isAppRoute(new URL(href, window.location.origin).pathname)) window.location.assign(href);
      else await router.push(href);
    },
    subscribe: listener => {
      const complete = () => listener();
      router.events.on('routeChangeComplete', complete);
      return () => router.events.off('routeChangeComplete', complete);
    },
  }), [router]);
  return <NavigationProvider value={navigation}>{children}</NavigationProvider>;
}
