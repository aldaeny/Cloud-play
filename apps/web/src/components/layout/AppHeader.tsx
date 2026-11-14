'use client';

import Link from 'next/link';
import { useEffect, useState, type Ref } from 'react';
import CloudPlayBrand from '../brand/CloudPlayBrand';
import Icon from '../icons/Icon';
import SearchField from '../search/SearchField';
import { IconButton, Segmented } from '../ui/controls';
import { MenuButton, Sheet, type MenuItem } from '../ui/overlays';
import { useI18n } from '../../lib/i18n';
import { useAppearance } from '../../lib/use-appearance';
import { useNavigation } from '../navigation/NavigationProvider';
import { NAV_ROUTES } from '../../lib/nav-routes';
import type { ThemeMode } from '../../lib/appearance';

/**
 * THE app header — one component on every route.
 *
 * It is intentionally quiet: the brand, a glass search affordance, language,
 * appearance and account. On phones the language/appearance controls move into
 * a drag-to-dismiss sheet so nothing is cramped; on desktop they are anchored
 * glass menus. Both write the same preferences, so a change here is reflected
 * instantly in the dock, the player, and every page — in both directions.
 */
export default function AppHeader({
  onSearchClick, hasQuery = false, searchButtonRef, accountHref = '/login', showNav = true,
}: {
  onSearchClick?: () => void;
  hasQuery?: boolean;
  searchButtonRef?: Ref<HTMLButtonElement>;
  accountHref?: string;
  showNav?: boolean;
}) {
  const { t, lang, setLanguage } = useI18n();
  const appearance = useAppearance();
  const navigation = useNavigation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  // "/" focuses the search sheet (desktop convention, ignored while typing).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
      if (typing) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSearchClick]);

  function openSearch() {
    if (onSearchClick) { onSearchClick(); return; }
    setSearchOpen(true);
  }

  function submitSearch() {
    const value = query.trim();
    setSearchOpen(false);
    void navigation.push(value ? `/search?q=${encodeURIComponent(value)}` : '/search');
    setQuery('');
  }

  const themeItems: MenuItem[] = [
    { value: 'system', label: t('theme.system'), description: t('theme.systemHint'), icon: <Icon name="auto" size={17} /> },
    { value: 'dark', label: t('theme.dark'), description: t('theme.darkHint'), icon: <Icon name="moon" size={17} /> },
    { value: 'light', label: t('theme.light'), description: t('theme.lightHint'), icon: <Icon name="sun" size={17} /> },
  ];
  const languageItems: MenuItem[] = [
    { value: 'ar', label: t('language.arabic'), icon: <Icon name="globe" size={17} /> },
    { value: 'en', label: t('language.english'), icon: <Icon name="text" size={17} /> },
  ];

  const themeIcon = appearance.mode === 'system' ? 'auto' : appearance.theme === 'dark' ? 'moon' : 'sun';

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-header-brand" aria-label={`${t('header.home')} — Cloud Play`}>
          <CloudPlayBrand />
        </Link>

        {showNav && (
          <nav className="app-header-nav" aria-label={t('nav.main')}>
            {NAV_ROUTES.filter(route => route.href !== '/settings').map(route => (
              <Link
                key={route.href}
                href={route.href}
                aria-current={navigation.pathname === route.href ? 'page' : undefined}
              >
                {t(route.labelKey)}
              </Link>
            ))}
          </nav>
        )}

        <div className="app-header-actions">
          <div className="app-header-search-wrapper">
            <button type="button" className="app-header-search" onClick={openSearch}>
              <Icon name="search" size={16} />
              <span>{t('header.search')}</span>
              <kbd className="cp-kbd">/</kbd>
            </button>
          </div>

          <IconButton
            ref={searchButtonRef as Ref<HTMLButtonElement>}
            label={t('header.search')}
            className="app-header-search-mobile"
            onClick={openSearch}
            badge={hasQuery}
          >
            <Icon name="search" size={19} />
          </IconButton>

          <MenuButton
            label={t('header.theme')}
            value={appearance.mode}
            items={themeItems}
            onSelect={value => appearance.setMode(value as ThemeMode)}
            triggerClassName="cp-icon-btn app-theme-btn"
          >
            <Icon name={themeIcon} size={18} />
          </MenuButton>

          <MenuButton
            label={t('header.language')}
            value={lang}
            items={languageItems}
            onSelect={value => setLanguage(value === 'en' ? 'en' : 'ar')}
            triggerClassName="app-lang-pill"
          >
            <Icon name="globe" size={16} />
            <span className="cp-lang-label">{lang === 'ar' ? 'العربية' : 'EN'}</span>
          </MenuButton>

          <Link href={accountHref} className="app-header-account" aria-label={t('header.account')}>
            <Icon name="user" size={18} />
          </Link>

          <IconButton label={t('nav.openMenu')} className="app-menu-btn" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={19} />
          </IconButton>
        </div>
      </div>

      {/* Phone / tablet menu: the same controls, in a sheet. */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t('common.settings')} side="bottom">
        <div className="cp-stack" style={{ gap: 18 }}>
          <section className="cp-stack" style={{ gap: 8 }}>
            <span className="cp-type-micro">{t('language.title')}</span>
            <Segmented
              label={t('language.title')}
              value={lang}
              onChange={value => setLanguage(value === 'en' ? 'en' : 'ar')}
              options={[
                { value: 'ar', label: t('language.arabic') },
                { value: 'en', label: t('language.english') },
              ]}
              size="lg"
            />
          </section>
          <section className="cp-stack" style={{ gap: 8 }}>
            <span className="cp-type-micro">{t('theme.title')}</span>
            <Segmented
              label={t('theme.mode')}
              value={appearance.mode}
              onChange={value => appearance.setMode(value)}
              options={[
                { value: 'system', label: t('theme.system') },
                { value: 'dark', label: t('theme.dark') },
                { value: 'light', label: t('theme.light') },
              ]}
              size="lg"
            />
          </section>
          <nav className="cp-stack" style={{ gap: 4 }} aria-label={t('nav.main')}>
            {NAV_ROUTES.map(route => (
              <Link
                key={route.href}
                href={route.href}
                className="cp-row-item cp-row-item--glass"
                onClick={() => setMenuOpen(false)}
              >
                <span className="cp-row-item__icon"><Icon name={route.icon} size={18} /></span>
                <span className="cp-row-item__copy"><strong>{t(route.labelKey)}</strong></span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </nav>
        </div>
      </Sheet>

      {/* Search sheet: real input, real navigation, Escape returns focus. */}
      <Sheet open={searchOpen} onClose={() => setSearchOpen(false)} title={t('common.search')} side="center">
        <SearchField
          value={query}
          onChange={setQuery}
          onSubmit={submitSearch}
          placeholder={t('search.placeholder')}
          label={t('header.search')}
          autoFocus
          shortcut="⏎"
        />
        <p className="cp-type-caption" style={{ marginBlockStart: 12 }}>{t('search.hint')}</p>
        <div className="cp-row" style={{ marginBlockStart: 16 }}>
          <Link href="/movies" className="cp-chip" onClick={() => setSearchOpen(false)}>{t('nav.movies')}</Link>
          <Link href="/live" className="cp-chip" onClick={() => setSearchOpen(false)}>{t('nav.tv')}</Link>
          <Link href="/favorites" className="cp-chip" onClick={() => setSearchOpen(false)}>{t('nav.favorites')}</Link>
        </div>
      </Sheet>
    </header>
  );
}
