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
import AppHeader from '../src/components/layout/AppHeader';
import SearchField from '../src/components/search/SearchField';

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
export default function Home() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>('ar');
  const [active, setActive] = useState(0);
  const carouselStageRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<number | null>(null);
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
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
  const openSearch = () => { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); window.setTimeout(() => searchInputRef.current?.focus(), reduceMotion ? 0 : 250); };
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
    if (!showDesignPreview || !autoCarousel || reduceMotion || modal !== null || carouselPaused) return;
    const timer = window.setInterval(() => {
      if (!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setActive(current => (current + 1) % items.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [autoCarousel, reduceMotion, modal, carouselPaused]);
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
    <AppHeader language={language} theme={theme} onToggleLanguage={() => chooseLanguage(language === 'ar' ? 'en' : 'ar')} onToggleTheme={() => chooseTheme(theme === 'dark' ? 'light' : 'dark')} onSearchClick={openSearch} hasQuery={!!query.trim()} searchButtonRef={searchButtonRef}/>
    <div ref={searchRowRef} className="home-search shell">
      <SearchField
        value={query}
        onChange={setQuery}
        onClear={() => { setQuery(''); searchInputRef.current?.focus(); }}
        placeholder={language === 'ar' ? 'ابحث عن فيلم، مسلسل، أو عرض حصري...' : 'Search movies, series, exclusives...'}
        label={t.searchLabel}
        inputRef={searchInputRef}
        onSubmit={() => { void router.push({ pathname: '/search', query: query.trim() ? { q: query.trim() } : {} }); }}
      />
      {query.trim() && <div className="home-search-results" aria-live="polite">
        {movies.filter(m => `${m.title} ${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(m => <Link href={`/movies/${m.id}`} key={m.id}><strong>{m.title}</strong><small dir={language === 'ar' ? 'rtl' : 'ltr'}>{m[language]}</small></Link>)}
        {!movies.some(m => `${m.title} ${m.ar} ${m.en}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p>{language === 'ar' ? 'لا توجد أفلام مطابقة.' : 'No matching films.'}</p>}
      </div>}
    </div>
    <main><section className="hero shell" id="featured"><div className="feature-banner"><div className="hero-scene" aria-hidden="true"><Image src="/art/cloud-city-hero.jpg" alt="" fill priority sizes="100vw"/><span className="hero-scene-shade"/><span className="color-ribbon ribbon-a"/><span className="color-ribbon ribbon-b"/></div><div className="hero-copy"><div className="eyebrow"><span className="tiny-line"/>{t.spotlight}</div><h1>{t.tagline.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br/>}</span>)}</h1><p className="hero-description">{language === 'ar' ? 'الحصريات • أحدث الأفلام • تفاصيل المنصة' : 'Exclusives • New films • Platform details'}</p><Link className="outline-button" href="/latest">{language === 'ar' ? 'اكتشف أحدث الأفلام' : 'Explore new films'}<Icon name="arrow" size={17}/></Link>{showDesignPreview && <div className="hero-index"><span>0{active + 1}</span><span className="index-line"/><span>0{items.length}</span></div>}</div></div>
      {showDesignPreview && <><div className="carousel-heading"><div><span className="tiny-line"/><h2>{t.featured}</h2></div><span>{language === 'ar' ? 'اختيارات كلاود بلاي' : 'THE CLOUD PLAY EDIT'}</span></div><div className="carousel-area" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={e => setCarouselPaused(e.currentTarget.contains(document.activeElement))} onFocusCapture={() => setCarouselPaused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setCarouselPaused(e.currentTarget.matches(':hover')); }} aria-label={language === 'ar' ? 'العناوين المختارة' : 'Featured titles'}><div className="magic-dust" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div><div className="glow glow-one"/><div className="glow glow-two"/><div className="carousel-stage" ref={carouselStageRef}>{items.map((item, i) => { const diff = (i - active + items.length) % items.length; const position = diff === 0 ? 'center' : diff === 1 ? 'right' : 'left'; return <button type="button" key={item.id} className={`poster poster-${position}`} onClick={() => position === 'center' ? setModal(i) : setActive(i)} aria-label={position === 'center' ? `${t.details}: ${item[language]}` : item[language]}><Image src={item.image} alt="" fill sizes="(max-width: 700px) 220px, 300px" priority={i === 0} className="poster-image"/><span className="poster-shade"/><span className="poster-content"><span className="poster-genre">{language === 'ar' ? item.genreAr : item.genreEn}</span><strong>{item[language]}</strong>{position === 'center' && <span className="poster-action"><Icon name="play" size={15}/>{t.details}</span>}</span></button>; })}</div><button className="carousel-arrow arrow-left" onClick={() => move(-1)} aria-label={t.prev}><span>‹</span></button><button className="carousel-arrow arrow-right" onClick={() => move(1)} aria-label={t.next}><span>›</span></button><div className="dots" aria-label={language === 'ar' ? 'اختيار عنوان' : 'Choose a title'}>{items.map((item, i) => <button key={item.id} className={i === active ? 'dot active' : 'dot'} onClick={() => setActive(i)} aria-label={item[language]} aria-current={i === active ? 'true' : undefined}/>)}</div></div>
      <div className="hero-foot"><span><span className="live-dot"/> {t.demo}</span><span>{t.demoNote}</span></div></>}</section>
    <ReferenceReel language={language} autoAdvance={autoCarousel} reduceMotion={reduceMotion} paused={modal !== null || query.trim() !== ''}/>
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
