import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import '../src/styles/globals.css';

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
  return <><Head><meta name="viewport" content="width=device-width, initial-scale=1"/><link rel="icon" href="/favicon.svg" type="image/svg+xml"/></Head><Component {...pageProps}/></>;
}
