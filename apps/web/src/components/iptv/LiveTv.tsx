import { useState } from 'react';
import PublicTv from './PublicTv';
import CommunityTv from './CommunityTv';
import FtaReference from './FtaReference';
import XtreamPlayer from './XtreamPlayer';
import type { PublicChannel } from '../../server/public-tv';

type Language = 'ar' | 'en';
type Mode = 'curated' | 'world' | 'xtream';

const T = {
  ar: {
    label: 'اختر مصدر القنوات',
    curated: 'قنوات منتقاة',
    curatedHint: 'مفحوصة يدوياً',
    world: 'الدليل العالمي',
    worldHint: 'آلاف القنوات من iptv-org',
    xtream: 'سيرفر Xtream',
    xtreamHint: 'سيرفرك الخاص (Browser Direct)',
  },
  en: {
    label: 'Choose a channel source',
    curated: 'Curated channels',
    curatedHint: 'hand-verified',
    world: 'World directory',
    worldHint: 'thousands via iptv-org',
    xtream: 'Xtream Server',
    xtreamHint: 'Your private server (Browser Direct)',
  },
};

/**
 * Three source tiers, one page:
 *   • Curated — server-rendered, indexable, every master playlist hand-verified.
 *   • World   — the iptv-org community directory, loaded on demand because it is
 *     large and rebuilt daily. Clearly labelled as not individually verified.
 *   • Xtream  — your own Xtream Codes server, fetched directly from the browser
 *     to bypass cloud IP blocks. Credentials stay in your browser.
 */
export default function LiveTv({ language, initialChannels }: { language: Language; initialChannels?: PublicChannel[] }) {
  const t = T[language];
  const [mode, setMode] = useState<Mode>('curated');

  return (
    <>
      <div className="live-mode" role="group" aria-label={t.label}>
        <button
          className={mode === 'curated' ? 'live-mode-tab selected' : 'live-mode-tab'}
          aria-pressed={mode === 'curated'}
          onClick={() => setMode('curated')}
        >
          <strong>{t.curated}</strong>
          <small>{initialChannels ? `${initialChannels.length} · ${t.curatedHint}` : t.curatedHint}</small>
        </button>
        <button
          className={mode === 'world' ? 'live-mode-tab selected' : 'live-mode-tab'}
          aria-pressed={mode === 'world'}
          onClick={() => setMode('world')}
        >
          <strong>{t.world}</strong>
          <small>{t.worldHint}</small>
        </button>
        <button
          className={mode === 'xtream' ? 'live-mode-tab selected' : 'live-mode-tab'}
          aria-pressed={mode === 'xtream'}
          onClick={() => setMode('xtream')}
        >
          <strong>{t.xtream}</strong>
          <small>{t.xtreamHint}</small>
        </button>
      </div>
      {mode === 'curated'
        ? <><PublicTv language={language} initialChannels={initialChannels} /><FtaReference language={language} /></>
        : mode === 'world'
        ? <CommunityTv language={language} />
        : <XtreamPlayer language={language} />}
    </>
  );
}
