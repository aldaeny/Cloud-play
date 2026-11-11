import PagesBrandingProvider from '../src/components/brand/PagesBrandingProvider';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import PageTransition from '../src/components/motion/PageTransition';
import GlobalNav from '../src/components/nav/GlobalNav';
import PagesShell from '../src/components/navigation/PagesShell';
import { AccountProvider } from '../src/components/account/AccountProvider';
import '../src/styles';

export default function App({ Component, pageProps }: AppProps) {
  // Remove only the offline worker introduced in the rolled-back design.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(async registrations => {
      const matching = registrations.filter(registration => {
        const worker = registration.active || registration.waiting || registration.installing;
        return worker && new URL(worker.scriptURL).origin === location.origin && new URL(worker.scriptURL).pathname === '/sw.js';
      });
      await Promise.all(matching.map(registration => registration.unregister()));
      if (matching.length && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith('cloud-play-offline-')).map(key => caches.delete(key)));
      }
    }).catch(() => {});
  }, []);
  return <><Head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="icon" href="/cloudplay-icon.png" type="image/png"/></Head><PagesBrandingProvider><PagesShell><AccountProvider><PageTransition><Component {...pageProps}/></PageTransition><GlobalNav/></AccountProvider></PagesShell></PagesBrandingProvider></>;
}
