/**
 * Shared device-preference helpers.
 *
 * Every preference lives in localStorage under the SAME keys the app has always
 * used, so the home page, section pages and the Settings page all read/write one
 * source of truth. A lightweight window event lets the active layout re-apply
 * theme / language / motion classes the instant a setting changes.
 */
export const PREFS_EVENT = 'cloudplay-prefs-changed';
export const LIBRARY_EVENT = 'cloudplay-library-changed';

export type Language = 'ar' | 'en';
export type Theme = 'dark' | 'light';

// Cached snapshot for useSyncExternalStore: a stable reference until prefs change.
let prefsSnapshot: Prefs | null = null;

export function notifyPrefsChanged() {
  prefsSnapshot = null; // invalidate so the next snapshot re-reads storage
  try { window.dispatchEvent(new Event(PREFS_EVENT)); } catch { /* no-op */ }
}

/** Broadcast a favorites/progress change so free-account sync can push it. */
export function notifyLibraryChanged() {
  try { window.dispatchEvent(new Event(LIBRARY_EVENT)); } catch { /* no-op */ }
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

/** Stable SSR/hydration snapshot. Never read device storage while rendering. */
export const SERVER_PREFS: Prefs = {
  language: 'ar', theme: 'dark', reduceMotion: false, textSize: 'normal', glow: true,
  autoCarousel: true, highContrast: false, solidPanels: false, hideCover: false,
  staticCover: false, playbackAuto: true, playbackMuted: false, scrollToPlayer: true,
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

/** Stable cached snapshot for useSyncExternalStore. Returns the same object
 *  reference until a preference changes, so React does not loop on re-renders.
 *  Only used on the client; SSR uses a constant server snapshot instead. */
export function getPrefsSnapshot(): Prefs {
  if (prefsSnapshot === null) prefsSnapshot = readPrefs();
  return prefsSnapshot;
}

/** Remove saved favorites (films + channels) AND locally stored watch progress.
 *  Returns how many keys were cleared. */
export function clearFavorites(): number {
  let n = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === 'cloudplay-movie-favorites-v1' || k === 'cloudplay-tv-favorites-v1' || k.startsWith('cloudplay-progress-v1-'))) keys.push(k);
    }
    keys.forEach(k => { localStorage.removeItem(k); n++; });
  } catch { /* storage optional */ }
  notifyPrefsChanged();
  notifyLibraryChanged();
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
  notifyLibraryChanged();
  return n;
}
