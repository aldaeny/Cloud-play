import type { IconName } from '../components/icons/Icon';

/**
 * Single source of truth for the global navigation: every entry maps to a real
 * route in the app (no placeholder buttons). `match` decides which button is
 * active for a given pathname — movie detail pages keep "Movies" active.
 */
export type NavRoute = {
  href: string;
  icon: IconName;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  match: (pathname: string) => boolean;
};

const norm = (p: string) => p.replace(/\/$/, '') || '/';

// The dock shows the 5 most essential routes. Series, Search and Continue remain
// fully reachable (header search button, home browse cards and the footer) — no
// route is disabled; the dock is simply decluttered to the core five.
export const NAV_ROUTES: NavRoute[] = [
  { href: '/', icon: 'home', ar: 'الرئيسية', en: 'Home',
    descAr: 'واجهتك الأولى: أحدث الأفلام والبث المباشر والحصريات.',
    descEn: 'Your front page: the latest films, live TV and exclusives.',
    match: p => norm(p) === '/' },
  { href: '/movies', icon: 'film', ar: 'الأفلام', en: 'Movies',
    descAr: 'أفلام قصيرة مرخّصة متاحة للمشاهدة المجانية مع حفظ التقدم.',
    descEn: 'Licensed short films, free to watch, with saved progress.',
    match: p => norm(p) === '/movies' || norm(p).startsWith('/movies/') },
  { href: '/live', icon: 'tv', ar: 'البث المباشر', en: 'Live TV',
    descAr: 'قنوات مرخّصة منظّمة حسب الدولة ثم التصنيف، مع مفضلة وبحث.',
    descEn: 'Licensed channels organised by country, then category, with favorites and search.',
    match: p => norm(p) === '/live' },
  { href: '/favorites', icon: 'star', ar: 'المفضلة', en: 'Favorites',
    descAr: 'أفلامك المحفوظة على هذا الجهاز فقط، للوصول السريع إليها.',
    descEn: 'Your saved films, stored on this device only, for quick access.',
    match: p => norm(p) === '/favorites' },
  { href: '/settings', icon: 'settings', ar: 'الإعدادات', en: 'Settings',
    descAr: 'اللغة والمظهر وتفضيلات الحركة والتشغيل.',
    descEn: 'Language, appearance, motion and playback preferences.',
    match: p => norm(p) === '/settings' },
];

/** The active route for a pathname, or null when no nav button matches. */
export function activeRoute(pathname: string): NavRoute | null {
  return NAV_ROUTES.find(r => r.match(pathname)) ?? null;
}
