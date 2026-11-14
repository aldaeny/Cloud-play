'use client';

/**
 * Appearance runtime.
 *
 * One provider keeps <html> truthful: theme, theme mode, viewing preferences and
 * the platform/device flags. The boot script performs the same work before the
 * first paint; this provider takes over afterwards (and follows the device when
 * the mode is `system`).
 *
 * Components never read localStorage directly for appearance — they use
 * `useAppearance()`, so a switch updates every surface in one commit.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useSyncExternalStore, type ReactNode,
} from 'react';
import {
  applyPlatformAttributes, detectPlatform, haptic, subscribeReducedMotion,
  subscribeSystemTheme, type Device, type Platform, type Theme, type ThemeMode,
} from './appearance';
import {
  getPrefsSnapshot, SERVER_PREFS, setPref, subscribePrefs,
} from './preferences';
import { I18nProvider } from './i18n';

export type Appearance = {
  mode: ThemeMode;
  theme: Theme;
  platform: Platform;
  device: Device;
  /** Preference OR the operating system's reduced-motion setting. */
  reduceMotion: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const AppearanceContext = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const [systemReduced, setSystemReduced] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<{ platform: Platform; device: Device }>({ platform: 'web', device: 'desktop' });

  /* Follow the device appearance when the mode is `system`. */
  useEffect(() => {
    const sync = () => {
      const mode = prefs.themeMode;
      const resolved: Theme = mode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : mode;
      applyToRoot({ mode, theme: resolved, ...getFlags() });
    };
    sync();
    return subscribeSystemTheme(sync);
  }, [prefs.themeMode]);

  /* Keep the remaining preference classes in sync. */
  useEffect(() => {
    const mode = prefs.themeMode;
    const resolved: Theme = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    applyToRoot({ mode, theme: resolved, ...getFlags() });
  }, [prefs.themeMode, prefs.reduceMotion, prefs.textSize, prefs.highContrast, prefs.solidPanels, prefs.glow]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(media.matches);
    update();
    return subscribeReducedMotion(update);
  }, []);

  useEffect(() => {
    const update = () => {
      applyPlatformAttributes();
      const { platform, device } = detectPlatform();
      setDeviceInfo({ platform, device });
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setPref('cloudplay-theme', mode);
    haptic('selection');
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(prefs.theme === 'dark' ? 'light' : 'dark');
  }, [prefs.theme, setMode]);

  const value = useMemo<Appearance>(() => ({
    mode: prefs.themeMode,
    theme: prefs.theme,
    platform: deviceInfo.platform,
    device: deviceInfo.device,
    reduceMotion: prefs.reduceMotion || systemReduced,
    setMode,
    toggleTheme,
  }), [prefs.themeMode, prefs.theme, prefs.reduceMotion, systemReduced, deviceInfo, setMode, toggleTheme]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

function getFlags() {
  let prefs;
  try { prefs = getPrefsSnapshot(); } catch { prefs = SERVER_PREFS; }
  return {
    reduceMotion: prefs.reduceMotion,
    textLarge: prefs.textSize === 'large',
    highContrast: prefs.highContrast,
    solidPanels: prefs.solidPanels,
    glow: prefs.glow,
  };
}

function applyToRoot({ mode, theme, reduceMotion, textLarge, highContrast, solidPanels, glow }: {
  mode: ThemeMode; theme: Theme; reduceMotion: boolean; textLarge: boolean;
  highContrast: boolean; solidPanels: boolean; glow: boolean;
}) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-theme-mode', mode);
  root.style.colorScheme = theme;
  root.classList.toggle('theme-light', theme === 'light');
  root.classList.toggle('theme-dark', theme === 'dark');
  root.classList.toggle('motion-off', reduceMotion);
  root.classList.toggle('text-large', textLarge);
  root.classList.toggle('high-contrast', highContrast);
  root.classList.toggle('solid-panels', solidPanels);
  root.classList.toggle('no-glow', !glow);
}

export function useAppearance(): Appearance {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside <AppearanceProvider>.');
  return value;
}

/** Both routers mount one provider; pages never mount their own. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AppearanceProvider>{children}</AppearanceProvider>
    </I18nProvider>
  );
}
