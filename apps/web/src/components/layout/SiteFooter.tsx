'use client';

import Link from 'next/link';
import CloudPlayBrand from '../brand/CloudPlayBrand';
import { useI18n } from '../../lib/i18n';
import { useBranding } from '../brand/BrandingProvider';

/** One footer for every route: a glass slab with the brand, pages and rights. */
export default function SiteFooter() {
  const { t } = useI18n();
  const brand = useBranding();
  const brandName = brand?.displayName || 'Cloud Play';

  return (
    <footer className="cp-footer">
      <div className="cp-footer__inner shell">
        <div className="cp-footer__brand">
          <Link href="/" aria-label={`${t('header.home')} — ${brandName}`}><CloudPlayBrand /></Link>
          <p>{t('footer.tagline')}</p>
          <div className="cp-footer__meta">
            <span className="cp-badge"><span className="cp-badge__dot" />{t('common.free')}</span>
            <span className="cp-badge">{t('home.ctaHelp')}</span>
          </div>
        </div>
        <nav className="cp-footer__nav" aria-label={t('footer.pages')}>
          <div>
            <span className="cp-type-micro">{t('footer.platform')}</span>
            <Link href="/">{t('nav.home')}</Link>
            <Link href="/movies">{t('nav.movies')}</Link>
            <Link href="/series">{t('nav.series')}</Link>
            <Link href="/live">{t('nav.tv')}</Link>
          </div>
          <div>
            <span className="cp-type-micro">{t('footer.explore')}</span>
            <Link href="/favorites">{t('nav.favorites')}</Link>
            <Link href="/continue">{t('footer.continue')}</Link>
            <Link href="/settings">{t('nav.settings')}</Link>
            <Link href="/about">{t('footer.about')}</Link>
          </div>
          <div>
            <span className="cp-type-micro">{t('common.settings')}</span>
            <Link href="/search">{t('common.search')}</Link>
            <Link href="/login">{t('common.signIn')}</Link>
            <Link href="/library">{t('footer.library')}</Link>
          </div>
        </nav>
      </div>
      <div className="cp-footer__legal shell">
        <span>© {new Date().getFullYear()} {t('footer.rights')}</span>
        <span>{t('home.ctaHelp')}</span>
      </div>
    </footer>
  );
}
