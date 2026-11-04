/**
 * Shared device-preference helpers.
 *
 * Every preference lives in localStorage under the SAME keys the app has always
 * used, so the home page, section pages and the Settings page all read/write one
 * source of truth. A lightweight window event lets the active layout re-apply
 * theme / language / motion classes the instant a setting changes.
 */
export const PREFS_EVENT = 'cloudplay-prefs-changed';

export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';

export function notifyPrefsChanged() {
  try { window.dispatchEvent(new Event(PREFS_EVENT)); } catch { /* no-op */ }
}

export function subscribePrefs(cb: () => void): () => void {
  window.addEventListener(PREFS_EVENT, cb);
  return () => window.removeEventListener(PREFS_EVENT, cb);
}

/** Write one preference and broadcast so mounted layouts stay in sync. */
export function setPref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage optional */ }
  notifyPrefsChanged();
}

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export type Prefs = {
  language: Language;
  theme: Theme;
  reduceMotion: boolean;
  textSize: 'normal' | 'large';
  glow: boolean;
  autoCarousel: boolean;
  highContrast: boolean;
  solidPanels: boolean;
  hideCover: boolean;
  staticCover: boolean;
  playbackAuto: boolean;
  playbackMuted: boolean;
  scrollToPlayer: boolean;
};

export function readPrefs(): Prefs {
  return {
    language: read('cloudplay-language') === 'en' ? 'en' : 'ar',
    theme: read('cloudplay-theme') === 'light' ? 'light' : 'dark',
    reduceMotion: read('cloudplay-reduce-motion') === 'true',
    textSize: read('cloudplay-text-size') === 'large' ? 'large' : 'normal',
    glow: read('cloudplay-glow') !== 'false',
    autoCarousel: read('cloudplay-auto-carousel') !== 'false',
    highContrast: read('cloudplay-high-contrast') === 'true',
    solidPanels: read('cloudplay-solid-panels') === 'true',
    hideCover: read('cloudplay-hide-cover') === 'true',
    staticCover: read('cloudplay-static-cover') === 'true',
    playbackAuto: read('cloudplay-playback-auto') !== 'false',
    playbackMuted: read('cloudplay-playback-muted') === 'true',
    scrollToPlayer: read('cloudplay-scroll-to-player') !== 'false',
  };
}

/** Remove saved favorites (films + channels). Returns how many keys were cleared. */
export function clearFavorites(): number {
  let n = 0;
  for (const key of ['cloudplay-movie-favorites-v1', 'cloudplay-tv-favorites-v1']) {
    try { if (localStorage.getItem(key) !== null) { localStorage.removeItem(key); n++; } } catch { /* optional */ }
  }
  notifyPrefsChanged();
  return n;
}

/** Remove every Cloud Play preference + saved data on this device. */
export function clearAllLocalData(): number {
  let n = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('cloudplay-')) keys.push(k);
    }
    keys.forEach(k => { localStorage.removeItem(k); n++; });
  } catch { /* optional */ }
  notifyPrefsChanged();
  return n;
}
