import Link from 'next/link';
import { useRouter } from 'next/router';
import { type Ref } from 'react';
import CloudPlayBrand from '../brand/CloudPlayBrand';
import Icon from '../icons/Icon';
import type { Language, Theme } from '../../lib/preferences';

/**
 * THE app header — one component rendered on every page (home + all sections,
 * including Settings). Clean, floating and sticky: no outer bordered box, just a
 * subtle backdrop blur and a hairline. Logo on the start side; a minimal circular
 * search / account / theme button and a slim language pill on the end side.
 * The Settings gear is intentionally absent — Settings lives in the bottom dock.
 */
export default function AppHeader({
  language, theme, onToggleLanguage, onToggleTheme,
  onSearchClick, hasQuery = false, searchButtonRef, accountHref = '/settings',
}: {
  language: Language;
  theme: Theme;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onSearchClick?: () => void;
  hasQuery?: boolean;
  searchButtonRef?: Ref<HTMLButtonElement>;
  accountHref?: string;
}) {
  const router = useRouter();
  const ar = language === 'ar';
  const handleSearch = () => { if (onSearchClick) onSearchClick(); else void router.push('/search'); };

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/" className="app-header-brand" aria-label={ar ? 'كلاود بلاي — الرئيسية' : 'Cloud Play home'}>
          <CloudPlayBrand />
        </Link>
        <div className="app-header-actions">
          <button
            ref={searchButtonRef}
            type="button"
            className="app-icon-btn"
            aria-label={ar ? 'البحث في الأفلام المتاحة' : 'Search available films'}
            onClick={handleSearch}
          >
            <Icon name="search" size={19} />
            {hasQuery && <span className="app-search-dot" aria-hidden="true" />}
          </button>
          <Link href={accountHref} className="app-icon-btn" aria-label={ar ? 'حساب المستخدم' : 'User account'}>
            <Icon name="user" size={19} />
          </Link>
          <button
            type="button"
            className="app-icon-btn"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label={ar ? (theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن') : (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode')}
            onClick={onToggleTheme}
          >
            <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={18} />
          </button>
          <button
            type="button"
            className="app-lang-pill"
            onClick={onToggleLanguage}
            aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
          >
            {ar ? 'EN' : 'العربية'}
          </button>
        </div>
      </div>
    </header>
  );
}
