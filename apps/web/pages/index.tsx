import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Image from 'next/image';
import IntroLayer from '../src/components/intro/IntroLayer';
import { readAppearance } from '../src/lib/appearance';
import ReferenceReel from '../src/components/carousel/ReferenceReel';
import CloudPlayBrand from '../src/components/brand/CloudPlayBrand';
import { movies } from '../src/components/movies/OpenMovies';
import { PlaybackPreferencesContext } from '../src/components/player/PlaybackPreferences';
import { useEffect, useRef, useState } from 'react';
import Icon from '../src/components/icons/Icon';

type Language = 'ar' | 'en';
// Sample art is retained solely for explicit local design preview, never shown by default.
const showDesignPreview = process.env.NEXT_PUBLIC_DESIGN_PREVIEW === 'true';
const items = [
  { id: 'horizon', image: '/art/horizon.jpg', en: 'Beyond Horizon', ar: 'ما وراء الأفق', genreEn: 'SCI-FI · ADVENTURE', genreAr: 'خيال علمي · مغامرة', number: '01' },
  { id: 'signal', image: '/art/signal.jpg', en: 'The Last Signal', ar: 'الإشارة الأخيرة', genreEn: 'MYSTERY · SCI-FI', genreAr: 'غموض · خيال علمي', number: '02' },
  { id: 'parallel', image: '/art/parallel.jpg', en: 'Parallel', ar: 'عالم موازٍ', genreEn: 'DRAMA · THRILLER', genreAr: 'دراما · تشويق', number: '03' },
];
const words = {
  en: { featured: 'Featured', trending: 'Trending', live: 'Live TV', search: 'Search titles', searchLabel: 'Search available films', spotlight: 'IN THE SPOTLIGHT', tagline: 'A world of entertainment,\nall in one place.', description: 'Discover something extraordinary. Your next great story is waiting.', demo: 'DESIGN PREVIEW', demoNote: 'Sample artwork and titles · not yet connected to content', discover: 'Explore titles', details: 'View details', selection: 'THE CLOUD PLAY EDIT', trendingTitle: 'Made for your watchlist', trendingSub: 'A little inspiration for your next escape.', seeAll: 'Explore the collection', liveTitle: 'IPTV channels', liveText: 'Choose an available channel below; playback depends on its provider.', liveBadge: 'CATALOG PREVIEW', footer: 'A little more to discover.', rights: 'Cloud Play. All rights reserved.', modalTitle: 'A glimpse of what’s coming', modalBody: 'This is a sample title for the design preview. Playback and the content library are not connected yet.', close: 'Close', prev: 'Previous title', next: 'Next title', noResults: 'No sample titles found.', goLive: 'Explore Live TV', switchLang: 'العربية', settings: 'Settings', settingsHint: 'Make Cloud Play yours', languageLabel: 'Language', motion: 'Reduce motion', motionHint: 'Minimize animations and transitions', systemMotion: 'Your device’s motion preferences are always respected.', arabic: 'العربية', english: 'English', explore: 'EXPLORE CLOUD PLAY', browseTitle: 'Find your kind of story', browseSub: 'Movies, series, and live TV — all in one place.', movies: 'Movies', series: 'Series', movieDesc: 'Discover stories made for the big screen.', seriesDesc: 'Find your next favorite series.', liveDesc: 'Your channels together, whenever you are ready.', coming: 'COMING SOON', browse: 'Explore', home: 'Home', appearance: 'Appearance', dark: 'Dark', light: 'Light', account: 'User account', accountHint: 'Account and profile', accountStatus: 'Account not connected', accountDesc: 'Sign-in and profile management will be available after the user account service is connected.', back: 'Back to settings', preferencesNote: 'Preferences are saved on this device.', textSize: 'Text size', textNormal: 'Normal', textLarge: 'Large', glow: 'Ambient glow', glowHint: 'Show decorative lights and particles', autoCarousel: 'Auto-advance titles', autoHint: 'Automatically change the featured title', autoNote: 'Auto-advance pauses while interacting or when motion is reduced.', tvShort: 'TV', searchAction: 'Search', clearSearch: 'Clear' },
  ar: { featured: 'المختارة', trending: 'الأكثر رواجاً', live: 'البث المباشر', search: 'ابحث عن عنوان', searchLabel: 'البحث في الأفلام المتاحة', spotlight: 'في دائرة الضوء', tagline: 'كل ما تحب مشاهدته،\nفي مكان واحد.', description: 'اكتشف تجربة مختلفة. حكايتك القادمة بانتظارك.', demo: 'معاينة التصميم', demoNote: 'صور وعناوين تجريبية · المحتوى غير مربوط بعد', discover: 'استكشف العناوين', details: 'عرض التفاصيل', selection: 'اختيارات كلاود بلاي', trendingTitle: 'اختيارات تستحق المشاهدة', trendingSub: 'بعض الإلهام لرحلتك القادمة.', seeAll: 'استكشف المجموعة', liveTitle: 'قنوات IPTV', liveText: 'اختر قناة متاحة أدناه؛ يعتمد التشغيل على مصدر البث.', liveBadge: 'معاينة القائمة', footer: 'دائماً هناك المزيد لتكتشفه.', rights: 'كلاود بلاي. جميع الحقوق محفوظة.', modalTitle: 'لمحة عمّا هو قادم', modalBody: 'هذا عنوان تجريبي لمعاينة التصميم. لم يتم ربط المشغّل ومكتبة المحتوى بعد.', close: 'إغلاق', prev: 'العنوان السابق', next: 'العنوان التالي', noResults: 'لا توجد عناوين تجريبية مطابقة.', goLive: 'اكتشف البث المباشر', switchLang: 'EN', settings: 'الإعدادات', settingsHint: 'خلّي تجربتك مثل ما تحب', languageLabel: 'اللغة', motion: 'تقليل الحركة', motionHint: 'تقليل الأنميشن والانتقالات', systemMotion: 'نحترم أيضاً إعدادات الحركة على جهازك.', arabic: 'العربية', english: 'English', explore: 'اكتشف كلاود بلاي', browseTitle: 'كل حكاياتك بمكان واحد', browseSub: 'أفلام ومسلسلات وقنوات مباشرة بانتظار الربط.', movies: 'الأفلام', series: 'المسلسلات', movieDesc: 'حكايات سينمائية لعشّاق الأفلام.', seriesDesc: 'اكتشف مسلسلك القادم.', liveDesc: 'قنواتك في مكان واحد بعد ربط السيرفر.', coming: 'قريباً', browse: 'استكشف', home: 'الرئيسية', appearance: 'المظهر', dark: 'داكن', light: 'فاتح', account: 'حساب المستخدم', accountHint: 'الحساب والملف الشخصي', accountStatus: 'الحساب غير مربوط', accountDesc: 'تسجيل الدخول وإدارة الملف الشخصي يتوفران بعد ربط خدمة حسابات المستخدمين.', back: 'العودة للإعدادات', preferencesNote: 'تُحفظ التفضيلات على هذا الجهاز.', textSize: 'حجم النص', textNormal: 'عادي', textLarge: 'كبير', glow: 'التوهجات المحيطة', glowHint: 'إظهار الإضاءة والجسيمات الزخرفية', autoCarousel: 'التنقل التلقائي', autoHint: 'تغيير العنوان المختار تلقائياً', autoNote: 'يتوقف التنقل التلقائي أثناء التفاعل أو عند تقليل الحركة.', tvShort: 'TV', searchAction: 'بحث', clearSearch: 'مسح' },
};
function Brand() {
  return <Link className="footer-reference-brand" href="/" aria-label="Cloud Play home"><CloudPlayBrand/></Link>;
}
function HeaderBrand() {
  return <Link className="reference-brand" href="/" aria-label="Cloud Play home"><CloudPlayBrand/></Link>;
}
export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('ar');
  const [active, setActive] = useState(0);
  const carouselStageRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [textSize, setTextSize] = useState<'normal' | 'large'>('normal');
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [autoCarousel, setAutoCarousel] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [solidPanels, setSolidPanels] = useState(false);
  const [hideCover, setHideCover] = useState(false);
  const [staticCover, setStaticCover] = useState(false);
  const [playbackAuto, setPlaybackAuto] = useState(true);
  const [playbackMuted, setPlaybackMuted] = useState(false);
  const [scrollToPlayer, setScrollToPlayer] = useState(true);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'account'>('main');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const t = words[language];
  useEffect(() => {
    let cancelled = false;
    // Read only non-sensitive preferences; blocked storage is harmless.
    Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        const savedLanguage = localStorage.getItem('cloudplay-language');
        const savedTheme = readAppearance();
        const savedMotion = localStorage.getItem('cloudplay-reduce-motion');
        const savedText = localStorage.getItem('cloudplay-text-size');
        const savedGlow = localStorage.getItem('cloudplay-glow');
        const savedAuto = localStorage.getItem('cloudplay-auto-carousel');
        const savedContrast = localStorage.getItem('cloudplay-high-contrast');
        const savedSolid = localStorage.getItem('cloudplay-solid-panels');
        const savedHideCover = localStorage.getItem('cloudplay-hide-cover');
        const savedStaticCover = localStorage.getItem('cloudplay-static-cover');
        const savedPlaybackAuto = localStorage.getItem('cloudplay-playback-auto');
        const savedPlaybackMuted = localStorage.getItem('cloudplay-playback-muted');
        const savedScrollToPlayer = localStorage.getItem('cloudplay-scroll-to-player');
        if (savedLanguage === 'ar' || savedLanguage === 'en') setLanguage(savedLanguage);
        if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
        if (savedMotion === 'true') setReduceMotion(true);
        if (savedText === 'normal' || savedText === 'large') setTextSize(savedText);
        if (savedGlow === 'false') setGlowEnabled(false);
        if (savedAuto === 'true' || savedAuto === 'false') setAutoCarousel(savedAuto === 'true');
        if (savedContrast === 'true') setHighContrast(true);
        if (savedSolid === 'true') setSolidPanels(true);
        if (savedHideCover === 'true') setHideCover(true);
        if (savedStaticCover === 'true') setStaticCover(true);
        if (savedPlaybackAuto === 'false') setPlaybackAuto(false);
        if (savedPlaybackMuted === 'true') setPlaybackMuted(true);
        if (savedScrollToPlayer === 'false') setScrollToPlayer(false);
      } catch { /* Continue with defaults when storage is unavailable. */ }
    });
    return () => { cancelled = true; };
  }, []);
  const store = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Settings still work for this page. */ } };
  const chooseLanguage = (value: Language) => { setLanguage(value); store('cloudplay-language', value); };
  const chooseTheme = (value: 'dark' | 'light') => { setTheme(value); store('cloudplay-theme', value); };
  const chooseMotion = (value: boolean) => { setReduceMotion(value); store('cloudplay-reduce-motion', String(value)); };
  const chooseTextSize = (value: 'normal' | 'large') => { setTextSize(value); store('cloudplay-text-size', value); };
  const chooseGlow = (value: boolean) => { setGlowEnabled(value); store('cloudplay-glow', String(value)); };
  const chooseAuto = (value: boolean) => { setAutoCarousel(value); store('cloudplay-auto-carousel', String(value)); };
  const chooseContrast = (value: boolean) => { setHighContrast(value); store('cloudplay-high-contrast', String(value)); };
  const chooseSolid = (value: boolean) => { setSolidPanels(value); store('cloudplay-solid-panels', String(value)); };
  const chooseHideCover = (value: boolean) => { setHideCover(value); store('cloudplay-hide-cover', String(value)); };
  const chooseStaticCover = (value: boolean) => { setStaticCover(value); store('cloudplay-static-cover', String(value)); };
  const choosePlaybackAuto = (value: boolean) => { setPlaybackAuto(value); store('cloudplay-playback-auto', String(value)); };
  const choosePlaybackMuted = (value: boolean) => { setPlaybackMuted(value); store('cloudplay-playback-muted', String(value)); };
  const chooseScrollToPlayer = (value: boolean) => { setScrollToPlayer(value); store('cloudplay-scroll-to-player', String(value)); };
  const resetPlayback = () => { choosePlaybackAuto(true); choosePlaybackMuted(false); chooseScrollToPlayer(true); };
  const openSearch = () => { setSearchOpen(true); window.setTimeout(() => searchInputRef.current?.focus(), 0); };
  useEffect(() => { document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; }, [language]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal-on-scroll'));
    // Only hide sections below the fold: the page remains usable without JS or when reloaded mid-page.
    nodes.forEach(node => { if (node.getBoundingClientRect().top > window.innerHeight) node.classList.add('reveal-pending'); });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.remove('reveal-pending'); entry.target.classList.add('revealed'); observer.unobserve(entry.target); }
    }), { threshold: 0, rootMargin: '0px 0px -25px 0px' });
    nodes.forEach(node => observer.observe(node));
    return () => { observer.disconnect(); nodes.forEach(node => node.classList.remove('reveal-pending')); };
  }, []);
  useEffect(() => {
    document.documentElement.style.scrollBehavior = reduceMotion ? 'auto' : '';
    return () => { document.documentElement.style.scrollBehavior = ''; };
  }, [reduceMotion]);
  useEffect(() => {
    if (!searchOpen) return;
    const onPointer = (event: PointerEvent) => { if (!searchWrapRef.current?.contains(event.target as Node) && !searchRowRef.current?.contains(event.target as Node)) setSearchOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [searchOpen]);
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (event: PointerEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSettingsOpen(false); settingsButtonRef.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [settingsOpen]);
  useEffect(() => {
    if (!showDesignPreview || !autoCarousel || reduceMotion || settingsOpen || modal !== null || carouselPaused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setActive(current => (current + 1) % items.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [autoCarousel, reduceMotion, settingsOpen, modal, carouselPaused]);
  useEffect(() => { if (modal === null) return; const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [modal]);
  useEffect(() => {
    if (!window.matchMedia('(max-width: 700px)').matches) return;
    const stage = carouselStageRef.current;
    const card = stage?.querySelector<HTMLElement>('.poster-center');
    if (!stage || !card) return;
    const delta = card.getBoundingClientRect().left - stage.getBoundingClientRect().left - (stage.clientWidth - card.clientWidth) / 2;
    stage.scrollBy({ left: delta, behavior: reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [active, reduceMotion]);
  const move = (n: number) => setActive(current => (current + n + items.length) % items.length);
  return <PlaybackPreferencesContext.Provider value={{ autoPlay: playbackAuto, startMuted: playbackMuted, scrollToPlayer }}><div className={`site theme-${theme} text-${textSize}${reduceMotion ? ' motion-off' : ''}${glowEnabled ? '' : ' no-glow'}${highContrast ? ' high-contrast' : ''}${solidPanels ? ' solid-panels' : ''}${hideCover ? ' hide-cover' : ''}${staticCover ? ' static-cover' : ''}`} id="top" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <IntroLayer/>
    <Head><title>Cloud Play — Your world of stories</title><meta name="description" content="Cloud Play Iraq: licensed short films and an optional live TV guide."/><link rel="canonical" href="https://cloud-play-iraq.vercel.app/"/></Head>
    <header className="header"><div className="header-inner"><HeaderBrand/><nav className="main-nav" aria-label={language === 'ar' ? 'القائمة الرئيسية' : 'Main navigation'}>
      <div className="nav-reveal-group">
        <Link className="nav-reveal-item nav-active" href="/" aria-label={t.home} aria-current="page"><Icon name="home" size={18}/><span className="nav-label"><span>{t.home}</span><small aria-hidden="true">{language === 'ar' ? 'Home' : 'الرئيسية'}</small></span></Link>
        <Link className="nav-reveal-item" href="/movies" aria-label={t.movies}><Icon name="film" size={18}/><span className="nav-label"><span>{t.movies}</span><small aria-hidden="true">{language === 'ar' ? 'Movies' : 'الأفلام'}</small></span></Link>
        <Link className="nav-reveal-item" href="/series" aria-label={t.series}><Icon name="play" size={17}/><span className="nav-label"><span>{t.series}</span><small aria-hidden="true">{language === 'ar' ? 'TV Shows' : 'المسلسلات'}</small></span></Link>
      </div>
      <Link href="/live"><span className="nav-label"><span>{t.tvShort}<span className="nav-dot"/></span><small aria-hidden="true">{language === 'ar' ? 'Live TV' : 'البث المباشر'}</small></span></Link>
      <button className="nav-account" type="button" aria-label={t.account} onClick={() => { setSettingsView('account'); setSettingsOpen(true); }}><Icon name="user" size={21}/><span className="nav-label"><span>{language === 'ar' ? 'حسابي' : 'Account'}</span><small aria-hidden="true">{language === 'ar' ? 'Account' : 'حسابي'}</small></span></button>
      <div className="nav-search" ref={searchWrapRef}>
        <button ref={searchButtonRef} type="button" className={`search-trigger${searchOpen ? ' is-open' : ''}`} aria-label={t.searchLabel} aria-controls="header-search" aria-expanded={searchOpen} onClick={openSearch}><Icon name="search" size={20}/>{query && <span className="search-indicator"/>}</button>

      </div>
    </nav><div className="header-actions"><button type="button" className={`sky-theme-toggle ${theme === 'dark' ? 'is-night' : 'is-day'}`} role="switch" aria-checked={theme === 'dark'} aria-label={language === 'ar' ? 'الوضع الداكن' : 'Dark mode'} title={language === 'ar' ? 'تبديل المظهر' : 'Switch appearance'} onClick={() => chooseTheme(theme === 'dark' ? 'light' : 'dark')}>
              <span className="sky-theme-day" aria-hidden="true"><span className="sky-theme-sun"/><span className="sky-theme-birds">⌁</span></span>
              <span className="sky-theme-night" aria-hidden="true"><span className="sky-theme-moon"/><span className="sky-theme-stars">✦ · ✧</span></span>
              <svg className="sky-theme-clouds" viewBox="0 0 220 36" preserveAspectRatio="none" aria-hidden="true"><path d="M0 26 Q6 18 14 23 Q20 10 30 19 Q39 12 45 22 Q53 18 60 25 Q67 15 77 22 Q84 9 96 19 Q102 13 110 24 Q118 19 126 26 Q134 16 143 22 Q151 11 161 20 Q169 15 177 24 Q184 17 195 23 Q203 15 213 22 Q218 19 220 21 V36 H0Z" fill="#e7f6ff"/><path d="M0 30 Q10 24 20 28 Q28 21 36 28 Q47 23 58 30 Q70 25 79 31 Q90 24 100 30 Q111 24 123 31 Q133 26 143 31 Q155 23 165 30 Q177 25 188 31 Q199 24 210 30 Q216 27 220 29 V36 H0Z" fill="#b9def8"/></svg>
              <span className="sky-theme-thumb" aria-hidden="true"/>
            </button><button className="language" onClick={() => chooseLanguage(language === 'ar' ? 'en' : 'ar')} aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}><Icon name="globe" size={17}/>{t.switchLang}</button>
      <div className="settings-wrap" ref={settingsRef}>
        <button ref={settingsButtonRef} className={`settings-trigger${settingsOpen ? ' is-open' : ''}`} onClick={() => setSettingsOpen(!settingsOpen)} aria-label={t.settings} aria-expanded={settingsOpen} aria-controls="settings-panel"><Icon name="settings" size={20}/></button>
        <div id="settings-panel" className={`settings-panel${settingsOpen ? ' is-open' : ''}`} aria-hidden={!settingsOpen} aria-label={t.settings} role="region">
          <div className="settings-heading"><div><span className="settings-kicker">CLOUD PLAY</span><h2>{settingsView === 'main' ? t.settings : t.account}</h2><p>{settingsView === 'main' ? t.settingsHint : t.accountHint}</p></div><button className="settings-close" onClick={() => { setSettingsOpen(false); settingsButtonRef.current?.focus(); }} aria-label={t.close}><Icon name="close" size={17}/></button></div>
          <div className="settings-divider"/>
          {settingsView === 'main' ? <div className="settings-view" key="main">
            <div className="settings-row"><span className="settings-row-icon"><Icon name="globe" size={17}/></span><div className="settings-row-copy"><strong>{t.languageLabel}</strong></div></div>
            <div className="language-options" role="group" aria-label={t.languageLabel}><button type="button" className={language === 'ar' ? 'selected' : ''} aria-pressed={language === 'ar'} onClick={() => chooseLanguage('ar')}>{t.arabic}</button><button type="button" className={language === 'en' ? 'selected' : ''} aria-pressed={language === 'en'} onClick={() => chooseLanguage('en')}>{t.english}</button></div>
            <div className="settings-row"><span className="settings-row-icon"><Icon name="text" size={17}/></span><div className="settings-row-copy"><strong>{t.textSize}</strong></div></div>
            <div className="language-options" role="group" aria-label={t.textSize}><button type="button" className={textSize === 'normal' ? 'selected' : ''} aria-pressed={textSize === 'normal'} onClick={() => chooseTextSize('normal')}>{t.textNormal}</button><button type="button" className={textSize === 'large' ? 'selected' : ''} aria-pressed={textSize === 'large'} onClick={() => chooseTextSize('large')}>{t.textLarge}</button></div>
            <button className="account-entry" onClick={() => setSettingsView('account')}><span className="settings-row-icon"><Icon name="user" size={17}/></span><span className="settings-row-copy"><strong>{t.account}</strong><small>{t.accountHint}</small></span><span className="account-chevron" aria-hidden="true">›</span></button>
            <label className="settings-row motion-setting"><span className="settings-row-icon motion-symbol" aria-hidden="true">✦</span><span className="settings-row-copy"><strong>{t.motion}</strong><small>{t.motionHint}</small></span><input type="checkbox" className="motion-checkbox" checked={reduceMotion} onChange={e => chooseMotion(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="sparkle" size={17}/></span><span className="settings-row-copy"><strong>{t.glow}</strong><small>{t.glowHint}</small></span><input type="checkbox" className="motion-checkbox" checked={glowEnabled} onChange={e => chooseGlow(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="rotate" size={17}/></span><span className="settings-row-copy"><strong>{t.autoCarousel}</strong><small>{t.autoHint}</small></span><input type="checkbox" className="motion-checkbox" checked={autoCarousel} onChange={e => chooseAuto(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="text" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'تباين أوضح' : 'Higher contrast'}</strong><small>{language === 'ar' ? 'إبراز النصوص والحدود الثانوية' : 'Emphasize secondary text and borders'}</small></span><input type="checkbox" className="motion-checkbox" checked={highContrast} onChange={e => chooseContrast(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="sparkle" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'تقليل الشفافية' : 'Reduce transparency'}</strong><small>{language === 'ar' ? 'خلفيات مصمتة للأقسام والقوائم' : 'Solid surfaces for panels and menus'}</small></span><input type="checkbox" className="motion-checkbox" checked={solidPanels} onChange={e => chooseSolid(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="film" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'إخفاء صورة الغلاف' : 'Hide cover image'}</strong><small>{language === 'ar' ? 'عرض خلفية بسيطة في البانر' : 'Use a plain banner background'}</small></span><input type="checkbox" className="motion-checkbox" checked={hideCover} onChange={e => chooseHideCover(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="rotate" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'تثبيت صورة الغلاف' : 'Still cover image'}</strong><small>{language === 'ar' ? 'إيقاف حركة الغلاف فقط' : 'Stop the cover animation only'}</small></span><input type="checkbox" className="motion-checkbox" checked={staticCover} onChange={e => chooseStaticCover(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <div className="settings-divider"/><div className="settings-row"><span className="settings-row-icon"><Icon name="play" size={17}/></span><div className="settings-row-copy"><strong>{language === 'ar' ? 'راحة المشاهدة' : 'Playback comfort'}</strong><small>{language === 'ar' ? 'تُطبّق على الفيديو التالي عند فتحه' : 'Applied when you open the next video'}</small></div></div>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="play" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'بدء التشغيل تلقائياً' : 'Start playback automatically'}</strong><small>{language === 'ar' ? 'عند اختيار فيلم أو قناة' : 'When selecting a film or channel'}</small></span><input type="checkbox" className="motion-checkbox" checked={playbackAuto} onChange={e => choosePlaybackAuto(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="tv" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'البدء بصوت مكتوم' : 'Start muted'}</strong><small>{language === 'ar' ? 'يمكنك تشغيل الصوت من المشغّل' : 'You can unmute in the player'}</small></span><input type="checkbox" className="motion-checkbox" checked={playbackMuted} onChange={e => choosePlaybackMuted(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <label className="settings-row extra-setting"><span className="settings-row-icon"><Icon name="arrow" size={17}/></span><span className="settings-row-copy"><strong>{language === 'ar' ? 'الانتقال إلى المشغّل' : 'Go to player'}</strong><small>{language === 'ar' ? 'التمرير للمشغّل عند فتحه' : 'Scroll to the player when opened'}</small></span><input type="checkbox" className="motion-checkbox" checked={scrollToPlayer} onChange={e => chooseScrollToPlayer(e.target.checked)}/><span className="motion-switch" aria-hidden="true"><span/></span></label>
            <button type="button" className="playback-reset" onClick={resetPlayback}>{language === 'ar' ? 'استعادة خيارات المشاهدة الافتراضية' : 'Reset playback options'}</button>
            <p className="settings-note">{t.autoNote}<br/>{t.systemMotion}<br/>{t.preferencesNote}</p>
          </div> : <div className="account-view" key="account"><div className="account-avatar"><Icon name="user" size={30}/></div><h3>{t.accountStatus}</h3><p>{t.accountDesc}</p><button className="account-back" onClick={() => setSettingsView('main')}><span aria-hidden="true">‹</span>{t.back}</button></div>}
        </div>
      </div></div></div><div ref={searchRowRef} className={`search-row${searchOpen ? ' is-open' : ''}`}><div className="search-row-content">
        <form id="header-search" className={`search-morph${searchOpen ? ' is-open' : ''}`} role="search" aria-hidden={!searchOpen} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); searchButtonRef.current?.focus(); } }} onSubmit={e => { e.preventDefault(); setSearchOpen(false); void router.push({ pathname: '/search', query: query.trim() ? { q: query.trim() } : {} }); }}>
          <div className="search-morph-bar"><Icon name="search" size={19}/><input ref={searchInputRef} id="title-search" tabIndex={searchOpen ? 0 : -1} type="search" dir="auto" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search} aria-label={t.searchLabel} autoComplete="off"/><button type="button" tabIndex={searchOpen ? 0 : -1} className="search-morph-close" aria-label={t.close} onClick={() => { setQuery(''); setSearchOpen(false); searchButtonRef.current?.focus(); }}><Icon name="close" size={19}/></button></div>
          {query.trim() && <div className="search-morph-results" aria-live="polite">{movies.filter(m => `${m.title} ${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(m => <Link href={`/movies/${m.id}`} key={m.id} tabIndex={searchOpen ? 0 : -1}><strong>{m.title}</strong><small dir={language === 'ar' ? 'rtl' : 'ltr'}>{m[language]}</small></Link>)}{!movies.some(m => `${m.title} ${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p>{language === 'ar' ? 'لا توجد أفلام مطابقة.' : 'No matching films.'}</p>}</div>}
        </form>
      </div></div></header>
    <main><section className="hero shell" id="featured"><div className="feature-banner"><div className="hero-scene" aria-hidden="true"><Image src="/art/cloud-city-hero.jpg" alt="" fill priority sizes="100vw"/><span className="hero-scene-shade"/><span className="color-ribbon ribbon-a"/><span className="color-ribbon ribbon-b"/></div><div className="hero-copy"><div className="eyebrow"><span className="tiny-line"/>{t.spotlight}</div><h1>{t.tagline.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br/>}</span>)}</h1><p className="hero-description">{language === 'ar' ? 'الحصريات • أحدث الأفلام • تفاصيل المنصة' : 'Exclusives • New films • Platform details'}</p><Link className="outline-button" href="/latest">{language === 'ar' ? 'اكتشف أحدث الأفلام' : 'Explore new films'}<Icon name="arrow" size={17}/></Link>{showDesignPreview && <div className="hero-index"><span>0{active + 1}</span><span className="index-line"/><span>0{items.length}</span></div>}</div></div>
      {showDesignPreview && <><div className="carousel-heading"><div><span className="tiny-line"/><h2>{t.featured}</h2></div><span>{language === 'ar' ? 'اختيارات كلاود بلاي' : 'THE CLOUD PLAY EDIT'}</span></div><div className="carousel-area" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={e => setCarouselPaused(e.currentTarget.contains(document.activeElement))} onFocusCapture={() => setCarouselPaused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCarouselPaused(e.currentTarget.matches(':hover')); }} aria-label={language === 'ar' ? 'العناوين المختارة' : 'Featured titles'}><div className="magic-dust" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><div className="glow glow-one"/><div className="glow glow-two"/><div className="carousel-stage" ref={carouselStageRef}>{items.map((item, i) => { const diff = (i - active + items.length) % items.length; const position = diff === 0 ? 'center' : diff === 1 ? 'right' : 'left'; return <button type="button" key={item.id} className={`poster poster-${position}`} onClick={() => position === 'center' ? setModal(i) : setActive(i)} aria-label={position === 'center' ? `${t.details}: ${item[language]}` : item[language]}><Image src={item.image} alt="" fill sizes="(max-width: 700px) 220px, 300px" priority={i === 0} className="poster-image"/><span className="poster-shade"/><span className="poster-content"><span className="poster-genre">{language === 'ar' ? item.genreAr : item.genreEn}</span><strong>{item[language]}</strong>{position === 'center' && <span className="poster-action"><Icon name="play" size={15}/>{t.details}</span>}</span></button>; })}</div><button className="carousel-arrow arrow-left" onClick={() => move(-1)} aria-label={t.prev}><span>‹</span></button><button className="carousel-arrow arrow-right" onClick={() => move(1)} aria-label={t.next}><span>›</span></button><div className="dots" aria-label={language === 'ar' ? 'اختيار عنوان' : 'Choose a title'}>{items.map((item, i) => <button key={item.id} className={i === active ? 'dot active' : 'dot'} onClick={() => setActive(i)} aria-label={item[language]} aria-current={i === active ? 'true' : undefined}/>)}</div></div>
      <div className="hero-foot"><span><span className="live-dot"/> {t.demo}</span><span>{t.demoNote}</span></div></>}</section>
    <ReferenceReel language={language} autoAdvance={autoCarousel} reduceMotion={reduceMotion} paused={settingsOpen || modal !== null || searchOpen}/>
    <section className="home-highlights shell reveal-on-scroll" aria-labelledby="home-highlights-title">
      <div className="section-head"><div><div className="eyebrow"><span className="tiny-line"/>{language === 'ar' ? 'اكتشف كلاود بلاي' : 'DISCOVER CLOUD PLAY'}</div><h2 id="home-highlights-title">{language === 'ar' ? 'الحصريات وأحدث الأفلام' : 'Exclusives and new films'}</h2><p>{language === 'ar' ? 'تابع الأقسام لمعرفة ما يتوفر عند إضافة محتوى مرخّص.' : 'Explore these sections as licensed content becomes available.'}</p></div></div>
      <div className="home-highlight-grid">
        <Link href="/exclusive" className="browse-card home-highlight-card"><div className="browse-icon"><Icon name="sparkle" size={23}/></div><div><span className="browse-tag">{language === 'ar' ? 'الحصريات' : 'EXCLUSIVES'}</span><h3>{language === 'ar' ? 'حصريات كلاود بلاي' : 'Cloud Play exclusives'}</h3><p>{language === 'ar' ? 'لا توجد أعمال حصرية مؤكدة حالياً.' : 'No confirmed exclusive titles are available yet.'}</p></div><span className="home-card-link">{language === 'ar' ? 'عرض الصفحة' : 'View page'} ↗</span><span className="browse-orb" aria-hidden="true"/></Link>
        <Link href="/latest" className="browse-card home-highlight-card"><div className="browse-icon"><Icon name="film" size={23}/></div><div><span className="browse-tag">{language === 'ar' ? 'أحدث الأفلام' : 'NEW FILMS'}</span><h3>{language === 'ar' ? 'الأفلام الحديثة' : 'New films'}</h3><p>{language === 'ar' ? 'لا توجد أفلام حديثة مرخّصة في المكتبة حالياً.' : 'There are no recently released licensed films in the library yet.'}</p></div><span className="home-card-link">{language === 'ar' ? 'عرض الصفحة' : 'View page'} ↗</span><span className="browse-orb" aria-hidden="true"/></Link>
      </div>
    </section>
    <section className="home-about shell reveal-on-scroll" aria-labelledby="home-about-title"><div className="home-about-panel"><div><div className="eyebrow"><span className="tiny-line"/>CLOUD PLAY IRAQ</div><h2 id="home-about-title">{language === 'ar' ? 'عن المنصة' : 'About the platform'}</h2><p>{language === 'ar' ? 'كلاود بلاي يجمع الأفلام المرخّصة في مكان واحد، مع المفضلة ومتابعة المشاهدة على جهازك. المسلسلات والقنوات تحتاج إلى مصادر مرخّصة قبل عرضها.' : 'Cloud Play brings licensed films together, with favorites and watch progress stored on your device. Series and channels need licensed sources before they can be shown.'}</p></div><Link className="home-about-link" href="/about">{language === 'ar' ? 'تفاصيل المنصة' : 'Platform details'} <span aria-hidden="true">↗</span></Link></div></section></main>
    <footer className="footer shell reveal-on-scroll"><div><Brand/><p>{t.footer}</p><nav className="footer-pages" aria-label={language === 'ar' ? 'صفحات المنصة' : 'Platform pages'}><Link href="/exclusive">{language === 'ar' ? 'الحصريات' : 'Exclusives'}</Link><Link href="/latest">{language === 'ar' ? 'أحدث الأفلام' : 'New films'}</Link><Link href="/about">{language === 'ar' ? 'عن المنصة' : 'About'}</Link><Link href="/movies">{t.movies}</Link><Link href="/series">{t.series}</Link><Link href="/live">{t.live}</Link><Link href="/search">{t.searchAction}</Link><Link href="/favorites">{language === 'ar' ? 'المفضلة' : 'Favorites'}</Link><Link href="/continue">{language === 'ar' ? 'متابعة المشاهدة' : 'Continue watching'}</Link><Link href="/settings">{t.settings}</Link><Link href="/login">{language === 'ar' ? 'تسجيل الدخول' : 'Sign in'}</Link></nav></div><span>© {new Date().getFullYear()} {t.rights}</span></footer>
    {modal !== null && <div className="modal-backdrop" onClick={() => setModal(null)}><div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label={t.close}><Icon name="close"/></button><div className="modal-art"><Image src={items[modal].image} fill sizes="400px" alt=""/></div><div className="modal-body"><span className="eyebrow">{t.demo}</span><h2 id="dialog-title">{items[modal][language]}</h2><h3>{t.modalTitle}</h3><p>{t.modalBody}</p><button className="outline-button" onClick={() => setModal(null)}>{t.close}</button></div></div></div>}
  </div></PlaybackPreferencesContext.Provider>;
}
