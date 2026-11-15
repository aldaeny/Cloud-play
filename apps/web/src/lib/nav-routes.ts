import type { IconName } from '../components/icons/Icon';
import type { MessageKey } from './i18n/messages';

/**
 * Single source of truth for the global navigation: every entry maps to a real
 * route in the app (no placeholder buttons). `match` decides which button is
 * active for a given pathname — movie detail pages keep "Movies" active.
 */
export type NavRoute = {
  href: string;
  icon: IconName;
  /** Localized label + description, resolved through the shared catalog. */
  labelKey: MessageKey;
  descKey: MessageKey;
  ar: string;
  en: string;
  descAr: string;
  descEn: string;
  match: (pathname: string) => boolean;
};

const norm = (p: string) => p.replace(/\/$/, '') || '/';

// The 6 core dock items requested: Home · Movies · Series · TV · Favorites · Settings.
export const NAV_ROUTES: NavRoute[] = [
  { href: '/', icon: 'home', labelKey: 'nav.home', descKey: 'nav.home.desc',
    ar: 'الرئيسية', en: 'Home', descAr: 'واجهتك: الأفلام المختارة والبث المباشر والمفضلة.', descEn: 'Your front page: the latest films, live TV and exclusives.',
    match: p => norm(p) === '/' },
  { href: '/movies', icon: 'film', labelKey: 'nav.movies', descKey: 'nav.movies.desc',
    ar: 'الأفلام', en: 'Movies', descAr: 'أفلام كاملة من الملك العام، مجانية للمشاهدة مع حفظ التقدم.', descEn: 'Licensed short films, free to watch, with saved progress.',
    match: p => norm(p) === '/movies' || norm(p).startsWith('/movies/') },
  { href: '/series', icon: 'play', labelKey: 'nav.series', descKey: 'nav.series.desc',
    ar: 'المسلسلات', en: 'Series', descAr: 'المسلسلات والمواسم المتاحة من مكتبة المشغّل.', descEn: 'The series section; titles arrive once licensed content is linked.',
    match: p => norm(p) === '/series' },
  { href: '/live', icon: 'tv', labelKey: 'nav.tv', descKey: 'nav.tv.desc',
    ar: 'تلفزيون', en: 'TV', descAr: 'قنوات تلفزيونية مباشرة وتصنيفات محلية وعالمية.', descEn: 'Live TV channels with local and global categories.',
    match: p => norm(p) === '/live' || norm(p).startsWith('/live/') },
  { href: '/favorites', icon: 'star', labelKey: 'nav.favorites', descKey: 'nav.favorites.desc',
    ar: 'المفضلة', en: 'Favorites', descAr: 'أفلامك المحفوظة على هذا الجهاز فقط، للوصول السريع إليها.', descEn: 'Your saved films, stored on this device only, for quick access.',
    match: p => norm(p) === '/favorites' },
  { href: '/settings', icon: 'settings', labelKey: 'nav.settings', descKey: 'nav.settings.desc',
    ar: 'الإعدادات', en: 'Settings', descAr: 'اللغة والمظهر وتفضيلات الحركة والتشغيل.', descEn: 'Language, appearance, motion and playback preferences.',
    match: p => norm(p) === '/settings' },
];

/** The active route for a pathname, or null when no nav button matches. */
export function activeRoute(pathname: string): NavRoute | null {
  return NAV_ROUTES.find(r => r.match(pathname)) ?? null;
}
