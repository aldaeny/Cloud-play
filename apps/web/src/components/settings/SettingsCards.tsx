'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Icon, { type IconName } from '../icons/Icon';
import { Button, Segmented, Switch } from '../ui/controls';
import { useI18n } from '../../lib/i18n';
import { useAppearance } from '../../lib/use-appearance';
import {
  clearAllLocalData, clearFavorites, getPrefsSnapshot, SERVER_PREFS, setPref,
  subscribePrefs, type Language,
} from '../../lib/preferences';
import { useAccount } from '../account/AccountProvider';
import type { ThemeMode } from '../../lib/appearance';

/**
 * The Settings page is the control-showcase of the design system: every control
 * type in the product appears here (segmented, switch, buttons, chips), and each
 * choice applies instantly on every screen — language and direction included.
 */
function Card({ icon, title, desc, children }: { icon: IconName; title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="cp-card">
      <div className="cp-card__head">
        <span className="cp-card__icon" aria-hidden="true"><Icon name={icon} size={19} /></span>
        <div>
          <h2>{title}</h2>
          {desc && <p>{desc}</p>}
        </div>
      </div>
      <div className="cp-card__body">{children}</div>
    </section>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="cp-setting-row">
      <div className="cp-setting-row__copy">
        <strong>{title}</strong>
        {desc && <small>{desc}</small>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsCards(_props: { language?: Language }) {
  const { t, lang, setLanguage, n, date } = useI18n();
  const appearance = useAppearance();
  const prefs = useSyncExternalStore(subscribePrefs, getPrefsSnapshot, () => SERVER_PREFS);
  const account = useAccount();
  const [confirm, setConfirm] = useState<null | 'favorites' | 'all'>(null);
  const [message, setMessage] = useState('');
  const [announcement, setAnnouncement] = useState('');

  // Announce language changes to assistive tech (the visual update is instant).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- live-region announcement on language change
    setAnnouncement(t('a11y.languageChanged'));
    const timer = window.setTimeout(() => setAnnouncement(''), 2500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const platformLabel = appearance.platform === 'ios' ? 'iOS'
    : appearance.platform === 'android' ? 'Android'
    : appearance.device === 'tv' ? 'TV' : 'Web';

  return (
    <div className="settings-page">
      <p className="cp-type-callout">{t('settings.intro')}</p>
      <div className="settings-grid">

        {/* ---- Language & direction ---- */}
        <Card icon="globe" title={t('settings.languageTitle')} desc={t('settings.languageDesc')}>
          <Segmented
            label={t('language.title')}
            size="lg"
            value={lang}
            onChange={value => setLanguage(value === 'en' ? 'en' : 'ar')}
            options={[
              { value: 'ar', label: t('language.arabic') },
              { value: 'en', label: t('language.english') },
            ]}
          />
          <Row title={t('settings.direction')} desc={t('language.hint')}>
            <span className="cp-badge">{lang === 'ar' ? t('settings.rtl') : t('settings.ltr')}</span>
          </Row>
          <p className="cp-note">
            {date(new Date())} · <span className="cp-num">{n(1234567)}</span> · <span className="cp-num">{n(0.35, { style: 'percent' })}</span>
          </p>
        </Card>

        {/* ---- Appearance ---- */}
        <Card icon={appearance.theme === 'dark' ? 'moon' : 'sun'} title={t('settings.appearanceTitle')} desc={t('settings.appearanceDesc')}>
          <Segmented
            label={t('theme.mode')}
            size="lg"
            value={appearance.mode}
            onChange={value => appearance.setMode(value as ThemeMode)}
            options={[
              { value: 'system', label: t('theme.system') },
              { value: 'dark', label: t('theme.dark') },
              { value: 'light', label: t('theme.light') },
            ]}
          />
          <p className="cp-note">{t(appearance.mode === 'system' ? 'theme.systemHint' : appearance.theme === 'dark' ? 'theme.darkHint' : 'theme.lightHint')}</p>
          <Row title={t('settings.textSize')}>
            <Segmented
              label={t('settings.textSize')}
              value={prefs.textSize}
              onChange={value => setPref('cloudplay-text-size', value)}
              options={[
                { value: 'normal', label: t('settings.textNormal') },
                { value: 'large', label: t('settings.textLarge') },
              ]}
            />
          </Row>
          <Row title={t('settings.contrast')} desc={t('settings.contrastDesc')}>
            <Switch
              label={t('settings.contrast')}
              checked={prefs.highContrast}
              onChange={value => setPref('cloudplay-high-contrast', String(value))}
            />
          </Row>
          <Row title={t('settings.transparency')} desc={t('settings.transparencyDesc')}>
            <Switch
              label={t('settings.transparency')}
              checked={prefs.solidPanels}
              onChange={value => { setPref('cloudplay-solid-panels', String(value)); setPref('cloudplay-glow', String(!value)); }}
            />
          </Row>
          <Row title={t('settings.glow')} desc={t('settings.glowDesc')}>
            <Switch
              label={t('settings.glow')}
              checked={prefs.glow}
              onChange={value => setPref('cloudplay-glow', String(value))}
            />
          </Row>
        </Card>

        {/* ---- Motion ---- */}
        <Card icon="sparkle" title={t('settings.motionTitle')} desc={t('settings.motionDesc')}>
          <Row title={t('settings.reduceMotion')} desc={t('settings.reduceMotionDesc')}>
            <Switch
              label={t('settings.reduceMotion')}
              checked={prefs.reduceMotion}
              onChange={value => setPref('cloudplay-reduce-motion', String(value))}
            />
          </Row>
          <p className="cp-note">{t('settings.systemMotion')}</p>
          <div className="cp-row">
            <span className="cp-badge">{t('settings.platform')}: {platformLabel}</span>
            <span className="cp-badge">{appearance.reduceMotion ? t('common.on') : t('common.off')} · {t('settings.reduceMotion')}</span>
          </div>
        </Card>

        {/* ---- Playback ---- */}
        <Card icon="play" title={t('settings.playbackTitle')} desc={t('settings.playbackDesc')}>
          <Row title={t('settings.autoplay')} desc={t('settings.autoplayDesc')}>
            <Switch
              label={t('settings.autoplay')}
              checked={prefs.playbackAuto}
              onChange={value => setPref('cloudplay-playback-auto', String(value))}
            />
          </Row>
          <Row title={t('settings.startMuted')} desc={t('settings.startMutedDesc')}>
            <Switch
              label={t('settings.startMuted')}
              checked={prefs.playbackMuted}
              onChange={value => setPref('cloudplay-playback-muted', String(value))}
            />
          </Row>
          <Row title={t('settings.scrollToPlayer')} desc={t('settings.scrollToPlayerDesc')}>
            <Switch
              label={t('settings.scrollToPlayer')}
              checked={prefs.scrollToPlayer}
              onChange={value => setPref('cloudplay-scroll-to-player', String(value))}
            />
          </Row>
          <Button
            size="sm"
            icon={<Icon name="rotate" size={15} />}
            onClick={() => {
              setPref('cloudplay-playback-auto', 'true');
              setPref('cloudplay-playback-muted', 'false');
              setPref('cloudplay-scroll-to-player', 'true');
            }}
          >
            {t('settings.resetPlayback')}
          </Button>
        </Card>

        {/* ---- Account ---- */}
        <Card icon="user" title={t('settings.accountTitle')} desc={t('settings.accountDesc')}>
          {account.user ? (
            <>
              <div className="cp-account-chip">
                <span className="cp-account-chip__avatar"><Icon name="user" size={20} /></span>
                <div style={{ minWidth: 0 }}>
                  <strong>{t('settings.signedInAs')}</strong>
                  <small className="cp-wrap-anywhere">{account.user.email || t('settings.notSignedIn')}</small>
                </div>
                <span className="cp-badge" style={{ marginInlineStart: 'auto' }}>{t('settings.accountFree')}</span>
              </div>
              <p className="cp-note">
                {account.syncState === 'synced' ? t('account.synced')
                  : account.syncState === 'error' ? t('account.syncError')
                  : account.syncState === 'syncing' ? t('account.working')
                  : t('account.localOnly')}
              </p>
              <Button variant="ghost" size="sm" onClick={() => void account.signOut()}>{t('common.signOut')}</Button>
            </>
          ) : (
            <>
              <p className="cp-note">{t('account.intro')}</p>
              <Link href="/login" className="cp-btn" data-variant="primary">{t('settings.signInCta')}</Link>
            </>
          )}
        </Card>

        {/* ---- Storage ---- */}
        <Card icon="trash" title={t('settings.storageTitle')} desc={t('settings.storageDesc')}>
          <div className="cp-danger-zone">
            <Row title={t('settings.clearFavorites')} desc={t('settings.clearFavoritesDesc')}>
              <Button variant="danger" size="sm" onClick={() => setConfirm('favorites')}>{t('common.clear')}</Button>
            </Row>
            <Row title={t('settings.clearAll')} desc={t('settings.clearAllDesc')}>
              <Button variant="danger" size="sm" onClick={() => setConfirm('all')}>{t('common.clear')}</Button>
            </Row>
          </div>
          {confirm && (
            <div className="cp-confirm" role="alertdialog" aria-live="assertive">
              <p>{confirm === 'favorites' ? t('settings.confirmFavorites') : t('settings.confirmAll')}</p>
              <div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm === 'favorites') { clearFavorites(); setMessage(t('settings.clearDone')); }
                    else { clearAllLocalData(); setMessage(t('settings.resetDone')); }
                    setConfirm(null);
                  }}
                >{t('common.confirm')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
              </div>
            </div>
          )}
          {message && <p className="cp-message" role="status">{message}</p>}
          <p className="cp-note">{t('settings.note')}</p>
        </Card>
      </div>
      <div className="cp-visually-hidden" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}
