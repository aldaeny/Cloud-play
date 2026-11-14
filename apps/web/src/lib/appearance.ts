/**
 * Appearance — one appearance model for Web, iOS and Android.
 *
 *  · mode    = the user's choice: 'system' | 'dark' | 'light'
 *  · theme   = the resolved appearance that is actually painted
 *
 * `cloudplay-theme` keeps its historical key so existing devices and every
 * hand-written rule (`.theme-light`) stay valid. A stored 'dark'/'light' is a
 * manual choice; anything else means "follow the device".
 */
export type ThemeMode = 'system' | 'dark' | 'light';
export type Theme = 'dark' | 'light';
export type Platform = 'ios' | 'android' | 'web';
export type Device = 'phone' | 'tablet' | 'desktop' | 'tv';

export const THEME_KEY = 'cloudplay-theme';

const isBrowser = () => typeof window !== 'undefined';

export function readThemeMode(): ThemeMode {
  if (!isBrowser()) return 'system';
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  } catch { /* Storage is optional. */ }
  return 'system';
}

export function systemTheme(): Theme {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? systemTheme() : mode;
}

/** Backwards-compatible reader: returns the resolved theme. */
export function readAppearance(): Theme {
  return resolveTheme(readThemeMode());
}

export function subscribeSystemTheme(callback: () => void): () => void {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-color-scheme: light)');
  if (media.addEventListener) media.addEventListener('change', callback);
  else media.addListener(callback);
  return () => {
    if (media.removeEventListener) media.removeEventListener('change', callback);
    else media.removeListener(callback);
  };
}

export function subscribeReducedMotion(callback: () => void): () => void {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (media.addEventListener) media.addEventListener('change', callback);
  else media.addListener(callback);
  return () => {
    if (media.removeEventListener) media.removeEventListener('change', callback);
    else media.removeListener(callback);
  };
}

/* -------------------------------------------------------------------------- */
/* Platform & device                                                          */
/* -------------------------------------------------------------------------- */

/**
 * We render one web product, but interaction feedback should feel native:
 * iPhone gets spring presses and drag sheets, Android gets ripples and explicit
 * touch targets, TVs get ten-foot focus rings. The flag is a data attribute on
 * <html>, so CSS and components can branch without re-detecting.
 */
export function detectPlatform(): { platform: Platform; device: Device; standalone: boolean } {
  if (!isBrowser()) return { platform: 'web', device: 'desktop', standalone: false };
  const ua = navigator.userAgent || '';
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const width = window.innerWidth || 1024;

  let platform: Platform = 'web';
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touch)) platform = 'ios';
  else if (/Android/i.test(ua)) platform = 'android';

  let device: Device = 'desktop';
  if (/TV|SmartTV|Tizen|webOS|NetCast|BRAVIA|Roku|AppleTV|AFT|HbbTV/i.test(ua)) device = 'tv';
  else if (width <= 480) device = 'phone';
  else if (width <= 1024) device = touch || /Android|iPad/i.test(ua) ? 'tablet' : 'desktop';

  const standalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  return { platform, device, standalone };
}

/** Applied by the boot script and kept fresh by the appearance provider. */
export function applyPlatformAttributes() {
  if (!isBrowser()) return;
  const { platform, device, standalone } = detectPlatform();
  const root = document.documentElement;
  root.dataset.platform = platform;
  root.dataset.device = device;
  if (standalone) root.dataset.standalone = 'true';
  else delete root.dataset.standalone;
}

/** Lightweight haptic feedback on Android/web where it is supported. */
export function haptic(kind: 'light' | 'medium' | 'selection' = 'light') {
  if (!isBrowser()) return;
  if (document.documentElement.dataset.platform === 'ios') return; // iOS has no web haptics API
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(kind === 'selection' ? 6 : kind === 'light' ? 8 : 14);
  } catch { /* Ignore. */ }
}
