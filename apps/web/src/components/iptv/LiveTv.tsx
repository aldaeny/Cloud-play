import { useState } from 'react';
import PublicTv from './PublicTv';
import CommunityTv from './CommunityTv';
import FtaReference from './FtaReference';
import RightsGuide from './RightsGuide';
import type { PublicChannel } from '../../server/public-tv';

type Language = 'ar' | 'en';
type Mode = 'curated' | 'world';

const T = {
  ar: {
    label: 'اختر مصدر القنوات',
    curated: 'قنوات منتقاة',
    curatedHint: 'مفحوصة يدوياً',
    world: 'الدليل العالمي',
    worldHint: 'آلاف القنوات من iptv-org',
  },
  en: {
    label: 'Choose a channel source',
    curated: 'Curated channels',
    curatedHint: 'hand-verified',
    world: 'World directory',
    worldHint: 'thousands via iptv-org',
  },
};

/**
 * Two trust tiers, one page:
 *   • Curated — server-rendered, indexable, every master playlist hand-verified.
 *   • World   — the iptv-org community directory, loaded on demand because it is
 *     large and rebuilt daily. Clearly labelled as not individually verified.
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
      </div>
      {mode === 'curated'
        ? <><PublicTv language={language} initialChannels={initialChannels} /><RightsGuide language={language} /><FtaReference language={language} /></>
        : <CommunityTv language={language} />}
    </>
  );
}
