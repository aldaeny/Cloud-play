'use client';

import { useI18n } from '../../lib/i18n';

/** First tab stop on every route: a glass skip link to the main landmark. */
export default function SkipLink() {
  const { t } = useI18n();
  return <a className="cp-skip-link" href="#main">{t('a11y.skip')}</a>;
}
