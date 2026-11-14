'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useSyncExternalStore, type ReactNode } from 'react';
import AppHeader from './AppHeader';
import SiteFooter from './SiteFooter';
import OwnerPlayerLink from '../account/OwnerPlayerLink';
import { useBranding } from '../brand/BrandingProvider';
import { brandingStyle } from '../brand/branding-style';
import { useI18n } from '../../lib/i18n';
import { useAppearance } from '../../lib/use-appearance';
import { getPrefsSnapshot, SERVER_PREFS, subscribePrefs, type Language } from '../../lib/preferences';

export type { Language } from '../../lib/preferences';

/**
 * Layout for every Pages-Router section (movies, series, live, search,
 * favorites, continue, settings, login, …).
 *
 * Language and appearance come from the global providers — the layout has no
 * copy of either, so a switch repaints the header, the page title and the
 * footer together, in one commit, in the correct direction.
 */
export default function SectionLayout({ title, children, noIndex = false, compact = false, bare = false }: {
  title: { ar: string; en: string };
  children: (language: Language) => ReactNode;
  noIndex?: boolean;
  compact?: boolean;
  /** Detail routes draw their own hero: no page title block, tighter shell. */
  bare?: boolean;
}) {
  const brand = useBranding();
  const brandName = brand?.displayName || 'Cloud Play Iraq';
  const router = useRouter();
  const { lang, t } = useI18n();
  const appearance = useAppearance();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);

  const classes = [
    'site', 'section-site', `theme-${appearance.theme}`,
    appearance.reduceMotion ? 'motion-off' : '',
    !prefs.glow ? 'no-glow' : '',
    prefs.solidPanels ? 'solid-panels' : '',
    prefs.textSize === 'large' ? 'text-large' : '',
    prefs.highContrast ? 'high-contrast' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={brandingStyle(brand, appearance.theme)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Head>
        <title>{`${title[lang]} | ${brandName}`}</title>
        <meta
          name="description"
          content={lang === 'ar'
            ? 'اكتشف الأفلام المتاحة والبث المباشر على كلاود بلاي العراق.'
            : 'Explore available movies and live TV on Cloud Play Iraq.'}
        />
        {!brand && <link rel="canonical" href={`https://cloud-play-iraq.vercel.app${router.asPath.split('?')[0]}`} />}
        {noIndex && <meta name="robots" content="noindex,follow" />}
      </Head>

      <AppHeader accountHref="/login" />

      <main id="main" className={`section-main shell${bare ? ' section-main--bare' : ''}`}>
        {!bare && (
          <header className={`section-hero${compact ? ' section-hero--compact' : ''}`}>
            <div className="section-hero__copy">
              <span className="cp-type-micro">{brandName}</span>
              <h1>{title[lang]}</h1>
            </div>
            <OwnerPlayerLink language={lang} />
          </header>
        )}
        <div className="section-body">{children(lang)}</div>
        <div className="cp-visually-hidden" aria-live="polite">{t('a11y.languageChanged')}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
