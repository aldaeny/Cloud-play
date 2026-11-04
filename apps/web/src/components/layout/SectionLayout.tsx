import Head from 'next/head';
import Link from 'next/link';
import { readAppearance } from '../../lib/appearance';
import { useRouter } from 'next/router';
import { useEffect, useState, type ReactNode } from 'react';
import AppHeader from './AppHeader';
import { subscribePrefs, setPref, type Language, type Theme } from '../../lib/preferences';

export type { Language } from '../../lib/preferences';

/**
 * Layout for every section page (movies, series, live, search, favorites,
 * continue, settings, …). Uses the SAME AppHeader as the home page and keeps the
 * `.site` theme / language / viewing-preference classes in sync live — so a
 * change made on the Settings page is reflected immediately.
 */
export default function SectionLayout({ title, children, noIndex = false }: {
  title: { ar: string; en: string };
  children: (language: Language) => ReactNode;
  noIndex?: boolean;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [opts, setOpts] = useState({ motionOff: false, noGlow: false, solid: false, textLarge: false, highContrast: false, hideCover: false, staticCover: false });

  useEffect(() => {
    const apply = () => {
      try {
        setLanguage(localStorage.getItem('cloudplay-language') === 'en' ? 'en' : 'ar');
        setTheme(readAppearance());
        setOpts({
          motionOff: localStorage.getItem('cloudplay-reduce-motion') === 'true',
          noGlow: localStorage.getItem('cloudplay-glow') === 'false',
          solid: localStorage.getItem('cloudplay-solid-panels') === 'true',
          textLarge: localStorage.getItem('cloudplay-text-size') === 'large',
          highContrast: localStorage.getItem('cloudplay-high-contrast') === 'true',
          hideCover: localStorage.getItem('cloudplay-hide-cover') === 'true',
          staticCover: localStorage.getItem('cloudplay-static-cover') === 'true',
        });
      } catch { /* Storage is optional. */ }
    };
    apply();
    return subscribePrefs(apply);
  }, []);

  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; }, [language]);

  const toggleLang = () => setPref('cloudplay-language', language === 'ar' ? 'en' : 'ar');
  const toggleTheme = () => setPref('cloudplay-theme', theme === 'dark' ? 'light' : 'dark');
  const ar = language === 'ar';

  return (
    <div
      className={`site theme-${theme} section-site${opts.motionOff ? ' motion-off' : ''}${opts.noGlow ? ' no-glow' : ''}${opts.solid ? ' solid-panels' : ''}${opts.textLarge ? ' text-large' : ''}${opts.highContrast ? ' high-contrast' : ''}${opts.hideCover ? ' hide-cover' : ''}${opts.staticCover ? ' static-cover' : ''}`}
      dir={ar ? 'rtl' : 'ltr'}
    >
      <Head>
        <title>{title[language]} | Cloud Play Iraq</title>
        <meta name="description" content={ar ? 'اكتشف الأفلام المتاحة والبث المباشر على كلاود بلاي العراق.' : 'Explore available movies and live TV on Cloud Play Iraq.'} />
        <link rel="canonical" href={`https://cloud-play-iraq.vercel.app${router.asPath.split('?')[0]}`} />
        {noIndex && <meta name="robots" content="noindex,follow" />}
      </Head>
      <AppHeader language={language} theme={theme} onToggleLanguage={toggleLang} onToggleTheme={toggleTheme} />
      <main className="section-main shell"><h1>{title[language]}</h1>{children(language)}</main>
      <footer className="section-footer shell"><Link href="/">Cloud Play Iraq</Link> · {ar ? 'المفضلة والتقدم على هذا الجهاز فقط.' : 'Favorites and progress are stored on this device only.'}</footer>
    </div>
  );
}
