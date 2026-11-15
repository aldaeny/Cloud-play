'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import BrandMark from './BrandMark';
import BrandIntro from './BrandIntro';
import Icon from '../icons/Icon';
import { Segmented } from '../ui/controls';
import { useI18n } from '../../lib/i18n';
import type { MessageKey } from '../../lib/i18n/messages';
import { useAppearance } from '../../lib/use-appearance';
import type { Theme, ThemeMode } from '../../lib/appearance';

const PALETTE = [
  { key: 'canvas', label: { ar: 'الكانفاس', en: 'Canvas' }, light: '#f4f6fb', dark: '#08090d', black: '#000000' },
  { key: 'accent', label: { ar: 'الأكسنت', en: 'Accent' }, light: '#b0155c', dark: '#d01b7f', black: '#d01b7f' },
  { key: 'violet', label: { ar: 'البنفسجي', en: 'Violet' }, light: '#7a3cf0', dark: '#a074ff', black: '#a074ff' },
  { key: 'cyan', label: { ar: 'السماوي', en: 'Cyan' }, light: '#2f5fd0', dark: '#6f9cff', black: '#6f9cff' },
  { key: 'amber', label: { ar: 'البرتقالي', en: 'Amber' }, light: '#c2410c', dark: '#ff9a3c', black: '#ff9a3c' },
];

type Scene = {
  key: string;
  icon: 'film' | 'library' | 'tv' | 'wifi';
  eyebrow: MessageKey;
  title: MessageKey;
  meta: MessageKey;
  tone: string;
};

const SCENES: Scene[] = [
  { key: 'films', icon: 'film', eyebrow: 'brand.scene.films', title: 'brand.scene.filmsTitle', meta: 'brand.scene.filmsMeta', tone: 'visual' },
  { key: 'series', icon: 'library', eyebrow: 'brand.scene.series', title: 'brand.scene.seriesTitle', meta: 'brand.scene.seriesMeta', tone: 'series' },
  { key: 'channels', icon: 'tv', eyebrow: 'brand.scene.channels', title: 'brand.scene.channelsTitle', meta: 'brand.scene.channelsMeta', tone: 'channels' },
  { key: 'live', icon: 'wifi', eyebrow: 'brand.scene.live', title: 'brand.scene.liveTitle', meta: 'brand.scene.liveMeta', tone: 'live' },
];

export default function BrandIdentity() {
  const { lang, t } = useI18n();
  const appearance = useAppearance();
  const [intro, setIntro] = useState<{ open: boolean; mode: 'intro' | 'identity'; nonce: number }>({ open: false, mode: 'intro', nonce: 0 });
  const [sound, setSound] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  /* Sound is a preference, not a state that resets on every visit. */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read a stored preference after hydration
    try { setSound(localStorage.getItem('cloudplay-brand-sound') !== 'false'); } catch { /* optional */ }
    return () => { if (copyTimer.current) window.clearTimeout(copyTimer.current); };
  }, []);

  const toggleSound = useCallback(() => {
    setSound(current => {
      const next = !current;
      try { localStorage.setItem('cloudplay-brand-sound', String(next)); } catch { /* optional */ }
      return next;
    });
  }, []);

  const playIntro = useCallback((mode: 'intro' | 'identity') => {
    // A new nonce remounts the overlay, so every replay restarts its animation.
    setIntro(current => ({ open: true, mode, nonce: current.nonce + 1 }));
  }, []);

  const identityText = useCallback(() => [
    'Cloud Play — ENTERTAINMENT ANYWHERE',
    lang === 'ar' ? 'كل ما تحب مشاهدته في مكان واحد' : 'Everything you love, in one place',
    'أفلام • مسلسلات • قنوات • بث مباشر',
    '',
    'Canvas  #08090d (dark) · #000000 (OLED black) · #f4f6fb (light)',
    'Accent  #d01b7f',
    'Aurora  #6f9cff → #a074ff → #ff6aa8',
    'Type    Arabic display + Latin geometric sans',
  ].join('\n'), [lang]);

  const copy = useCallback(async () => {
    const text = identityText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can be blocked (insecure context / permission): fall back.
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(area);
    }
    setCopied(true);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2200);
  }, [identityText]);

  const themeMode: ThemeMode = appearance.mode === 'system' ? 'system' : appearance.theme;
  const previewMode: Theme = (themeMode === 'system' ? appearance.theme : themeMode) as Theme;

  const platformHere = appearance.platform;
  const platforms = [
    { key: 'web', label: t('brand.platform.web') },
    { key: 'ios', label: t('brand.platform.ios') },
    { key: 'android', label: t('brand.platform.android') },
    { key: 'webos', label: t('brand.platform.webos') },
  ];

  return (
    <>
      <section className="cp-brand-board" aria-label={t('brand.identity')}>
        {/* ---- Primary lockup -------------------------------------------- */}
        <div className="cp-brand-plate">
          <div className="cp-brand-plate__glow" aria-hidden="true" />
          <div className="cp-brand-plate__mark">
            <BrandMark size={232} />
          </div>
          <div className="cp-brand-plate__copy">
            <span className="cp-brand-plate__eyebrow">{t('brand.lockup')}</span>
            <p className="cp-brand-plate__name" dir="ltr"><b>Cloud</b> Play</p>
            <span className="cp-brand-plate__tag" dir="ltr">ENTERTAINMENT ANYWHERE</span>
            <span className="cp-brand-plate__rule" aria-hidden="true" />
            <p className="cp-brand-plate__line">{t('brand.tagline')}</p>
            <p className="cp-brand-plate__pillars">{t('brand.pillars')}</p>
          </div>
        </div>

        {/* ---- Controls --------------------------------------------------- */}
        <div className="cp-brand-controls">
          <div className="cp-brand-control">
            <span className="cp-type-micro">{t('brand.appearance')}</span>
            <Segmented
              label={t('brand.appearance')}
              value={previewMode}
              onChange={value => appearance.setMode(value)}
              options={[
                { value: 'dark' as Theme, label: t('theme.dark') },
                { value: 'black' as Theme, label: t('theme.black') },
                { value: 'light' as Theme, label: t('theme.light') },
              ]}
            />
          </div>

          <div className="cp-brand-control">
            <span className="cp-type-micro">{t('brand.platforms')}</span>
            <ul className="cp-brand-platforms">
              {platforms.map(platform => {
                const here = platformHere === platform.key;
                return (
                  <li key={platform.key} className={`cp-brand-platform${here ? ' is-here' : ''}`}>
                    <Icon name={here ? 'check' : 'devices'} size={15} />
                    <span>{platform.label}</span>
                    <small>{here ? t('brand.platform.here') : t('brand.platform.soon')}</small>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="cp-brand-actions">
            <button type="button" className="cp-btn" data-variant="primary" onClick={() => playIntro('intro')}>
              <Icon name="play" size={15} />
              {sound ? t('brand.replayIntroWithSound') : t('brand.replayIntro')}
            </button>
            <button type="button" className="cp-btn" onClick={() => playIntro('identity')}>
              <Icon name="sparkle" size={15} />
              {t('brand.showIdentity')}
            </button>
            <button type="button" className="cp-btn" onClick={toggleSound} aria-pressed={sound}>
              <Icon name={sound ? 'sound' : 'mute'} size={15} />
              {sound ? t('brand.soundOn') : t('brand.soundOff')}
            </button>
            <button type="button" className="cp-btn" onClick={copy} aria-live="polite" title={t('brand.copyHint')}>
              <Icon name={copied ? 'check' : 'copy'} size={15} />
              {copied ? t('brand.copied') : t('brand.copy')}
            </button>
            <Link href="/settings" className="cp-icon-btn" aria-label={t('common.settings')} title={t('common.settings')}>
              <Icon name="settings" size={17} />
            </Link>
          </div>
        </div>

        {/* ---- Palette ---------------------------------------------------- */}
        <div className="cp-brand-palette">
          <div className="cp-reel-header">
            <h2>{t('brand.palette')}</h2>
            <p>{t('brand.paletteNote')}</p>
          </div>
          <ul className="cp-brand-swatches">
            {PALETTE.map(swatch => {
              const hex = swatch[previewMode];
              return (
                <li key={swatch.key}>
                  <span className="cp-brand-swatch" style={{ background: hex }} aria-hidden="true" />
                  <span className="cp-brand-swatch__label">{swatch.label[lang]}</span>
                  <code className="cp-brand-swatch__hex">{hex}</code>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ---- Content scenes --------------------------------------------- */}
        <div className="cp-brand-scenes">
          <div className="cp-reel-header">
            <h2>{t('brand.showcase')}</h2>
            <p>{t('brand.showcaseDesc')}</p>
          </div>
          <ul className="cp-brand-scene-grid">
            {SCENES.map(scene => (
              <li key={scene.key} className={`cp-brand-scene tone-${scene.tone}`}>
                <span className="cp-brand-scene__art" aria-hidden="true">
                  <Icon name={scene.icon} size={26} />
                </span>
                <span className="cp-brand-scene__eyebrow">{t(scene.eyebrow)}</span>
                <strong className="cp-brand-scene__title">{t(scene.title)}</strong>
                <span className="cp-brand-scene__meta">{t(scene.meta)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="cp-note cp-brand-footnote">
          {lang === 'ar'
            ? 'المظهر واللغة هنا يُطبّقان فوراً على كل الموقع ويُحفظان على هذا الجهاز — نفس ما تجده في الإعدادات.'
            : 'Appearance and language here apply to the whole site instantly and persist on this device — the same state Settings uses.'}
        </p>
      </section>

      <BrandIntro
        key={intro.nonce}
        open={intro.open}
        mode={intro.mode}
        sound={sound}
        onClose={() => setIntro(current => ({ ...current, open: false }))}
      />
    </>
  );
}
