'use client';

import { LayoutGrid, Rows3 } from 'lucide-react';
import type { ChannelView } from '../../lib/use-channel-view';

type Props = {
  value: ChannelView;
  onChange: (value: ChannelView) => void;
  language: 'ar' | 'en';
};

const OPTIONS: { key: ChannelView; ar: string; en: string; Icon: typeof LayoutGrid }[] = [
  { key: 'grid', ar: 'شبكة', en: 'Grid', Icon: LayoutGrid },
  { key: 'list', ar: 'قائمة مصغرة', en: 'Compact list', Icon: Rows3 },
];

/** Grid / compact-list switch. The choice is persisted by `useChannelView`. */
export function ViewModeToggle({ value, onChange, language }: Props) {
  const ar = language === 'ar';
  return (
    <div role="group" aria-label={ar ? 'طريقة العرض' : 'View mode'} className="tw-flex tw-h-11 tw-shrink-0 tw-items-center tw-gap-1 tw-rounded-xl tw-border tw-border-line tw-bg-panel tw-p-1">
      {OPTIONS.map(({ key, Icon, ...label }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={selected}
            aria-label={label[language]}
            title={label[language]}
            className={`tw-flex tw-h-full tw-items-center tw-gap-1.5 tw-rounded-lg tw-px-2.5 tw-text-xs tw-font-semibold tw-transition-colors focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet ${selected ? 'tw-bg-gradient-to-r tw-from-violet tw-to-accent tw-text-white' : 'tw-text-muted hover:tw-bg-panelHover hover:tw-text-white'}`}
          >
            <Icon size={16} aria-hidden="true" />
            <span className="tw-hidden md:tw-inline">{label[language]}</span>
          </button>
        );
      })}
    </div>
  );
}
