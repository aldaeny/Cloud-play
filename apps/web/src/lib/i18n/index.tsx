'use client';

/**
 * Cloud Play i18n runtime.
 *
 * Language is a *preference*, not component state: switching writes
 * `cloudplay-language`, broadcasts one event and every mounted surface
 * re-renders through this context. Direction, `lang`, `data-lang` and the
 * Arabic/Latin font switch are applied to <html> in the same commit — nothing
 * reloads, and no subtree keeps a stale direction.
 *
 * The provider also owns the localized formatters (numbers, dates, times,
 * relative times, durations, plurals) so Arabic uses Iraqi conventions and
 * Latin digits consistently, while English uses en-GB.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  useSyncExternalStore, type ReactNode,
} from 'react';
import { ar, en, catalogs, type Locale, type MessageKey } from './messages';
import {
  getPrefsSnapshot, SERVER_PREFS, setPref, subscribePrefs, type Language,
} from '../preferences';
import { haptic } from '../appearance';

export type { Locale, MessageKey, Language };
export { catalogs, ar, en };

export type TranslateVars = Record<string, string | number>;
export type I18n = {
  lang: Language;
  locale: Locale;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  isArabic: boolean;
  /** Translate a key, interpolating `{name}` placeholders. */
  t: (key: MessageKey, vars?: TranslateVars) => string;
  /** Number with locale grouping (Latin digits for Arabic, for legibility). */
  n: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Plural-aware choice from a form map. */
  plural: (count: number, forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string }) => string;
  /** Date in the interface locale. */
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  /** Time of day; Baghdad by default because the TV guide is Baghdad-based. */
  time: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  /** "3 minutes ago" / "قبل ٣ دقائق". */
  relative: (value: Date | string | number) => string;
  /** 1:04 / 1:02:33 */
  duration: (seconds: number) => string;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
};

const I18nContext = createContext<I18n | null>(null);

const DIR: Record<Language, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };
const INTL_LOCALE: Record<Language, string> = { ar: 'ar-IQ-u-nu-latn', en: 'en-GB' };

function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
}

export function formatDuration(seconds: number, forceHours = false) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (v: number) => String(v).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  // Hydration strategy: the first client render matches the server (Arabic),
  // then the stored language applies in the same frame the boot mask clears.
  const [hydrated, setHydrated] = useState(false);
  // One post-hydration commit: server markup is Arabic, the client switches once.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);

  const lang: Language = hydrated ? prefs.language : SERVER_PREFS.language;
  const dir = DIR[lang];
  const locale: Locale = lang === 'ar' ? 'ar' : 'en';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    root.setAttribute('data-lang', lang);
    root.setAttribute('data-dir', dir);
    root.removeAttribute('data-lang-pending');
  }, [lang, dir]);

  const setLanguage = useCallback((next: Language) => {
    setPref('cloudplay-language', next);
    haptic('selection');
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(lang === 'ar' ? 'en' : 'ar');
  }, [lang, setLanguage]);

  const value = useMemo<I18n>(() => {
    const catalog = catalogs[locale];
    const numberFormatter = new Intl.NumberFormat(INTL_LOCALE[lang]);
    const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: 'medium' });
    const timeFormatter = new Intl.DateTimeFormat(INTL_LOCALE[lang], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Baghdad' });
    const relativeFormatter = new Intl.RelativeTimeFormat(INTL_LOCALE[lang], { numeric: 'auto' });
    const pluralRules = new Intl.PluralRules(INTL_LOCALE[lang]);

    const t: I18n['t'] = (key, vars) => {
      const template = (catalog as Record<string, string>)[key]
        ?? (en as Record<string, string>)[key]
        ?? key;
      return interpolate(template, vars);
    };

    const numberCache = new Map<string, Intl.NumberFormat>();
    const n: I18n['n'] = (v, options) => {
      if (!options) return numberFormatter.format(v);
      const cacheKey = JSON.stringify(options);
      let formatter = numberCache.get(cacheKey);
      if (!formatter) {
        formatter = new Intl.NumberFormat(INTL_LOCALE[lang], options);
        numberCache.set(cacheKey, formatter);
      }
      return formatter.format(v);
    };

    const plural: I18n['plural'] = (count, forms) => {
      const rule = pluralRules.select(count);
      return interpolate(forms[rule] ?? forms.other, { count: numberFormatter.format(count) });
    };

    const toDate = (input: Date | string | number) => (input instanceof Date ? input : new Date(input));

    const date: I18n['date'] = (input, options) => {
      const d = toDate(input);
      if (Number.isNaN(d.getTime())) return '';
      return options ? new Intl.DateTimeFormat(INTL_LOCALE[lang], options).format(d) : dateFormatter.format(d);
    };

    const time: I18n['time'] = (input, options) => {
      const d = toDate(input);
      if (Number.isNaN(d.getTime())) return '';
      return options
        ? new Intl.DateTimeFormat(INTL_LOCALE[lang], { hour: '2-digit', minute: '2-digit', ...options }).format(d)
        : timeFormatter.format(d);
    };

    const relative: I18n['relative'] = input => {
      const d = toDate(input);
      if (Number.isNaN(d.getTime())) return '';
      const diff = d.getTime() - Date.now();
      const abs = Math.abs(diff);
      const minute = 60_000, hour = 60 * minute, day = 24 * hour;
      if (abs < hour) return relativeFormatter.format(Math.round(diff / minute), 'minute');
      if (abs < day) return relativeFormatter.format(Math.round(diff / hour), 'hour');
      if (abs < 30 * day) return relativeFormatter.format(Math.round(diff / day), 'day');
      return date(d);
    };

    return {
      lang, locale, dir, isRTL: dir === 'rtl', isArabic: lang === 'ar',
      t, n, plural, date, time, relative,
      duration: formatDuration,
      setLanguage, toggleLanguage,
    };
  }, [lang, locale, dir, setLanguage, toggleLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}


export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>.');
  return value;
}

/** Convenience for components that only need the translator. */
export function useT() {
  return useI18n().t;
}
