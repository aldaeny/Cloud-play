'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { Play, Star, Tv, Globe } from 'lucide-react';
import type { Channel } from '../../types/channel';
import { CATEGORIES, QUALITIES } from '../../constants/categories';
import { countryLabel } from '../../lib/iptv-country';

export const CHANNEL_ROW_HEIGHT = 56;

type Props = {
  channel: Channel;
  favorite: boolean;
  language: 'ar' | 'en';
  active?: boolean;
  onPlay: (channel: Channel) => void;
  onFavoriteToggle: (id: string) => void;
};

/** ISO-3166 alpha-2 → flag emoji. No network request, no invented country. */
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map(char => 0x1f1a5 + char.charCodeAt(0)));
}

/**
 * Dense channel row (56px) for the compact list view.
 *
 * The whole row is one big hit target: a transparent button spans the row while
 * the star and play controls sit above it, so nesting stays valid HTML and every
 * control keeps its own accessible name.
 */
function ChannelRowCompactBase({ channel, favorite, language, active, onPlay, onFavoriteToggle }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const ar = language === 'ar';
  const quality = QUALITIES.find(item => item.value === channel.quality);
  const category = CATEGORIES.find(item => item.id === channel.category);
  const flag = countryFlag(channel.countryCode);
  const country = channel.countryCode ? countryLabel(channel.countryCode, ar) : channel.country;
  const playLabel = channel.playable
    ? `${ar ? 'تشغيل' : 'Play'}: ${channel.name}`
    : `${ar ? 'المصدر غير متاح' : 'Source unavailable'}: ${channel.name}`;

  return (
    <div
      data-channel-id={channel.id}
      data-testid="channel-row"
      className={`tw-group tw-relative tw-flex tw-items-center tw-rounded-lg tw-border tw-border-transparent tw-px-3 tw-py-1.5 tw-transition-colors hover:tw-bg-panelHover ${active ? 'tw-border-violet tw-bg-panel' : 'tw-bg-ink'}`}
      style={{ height: CHANNEL_ROW_HEIGHT }}
    >
      <button
        type="button"
        onClick={() => channel.playable && onPlay(channel)}
        disabled={!channel.playable}
        aria-label={playLabel}
        className="tw-absolute tw-inset-0 tw-z-0 tw-w-full tw-rounded-lg tw-bg-transparent focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet disabled:tw-cursor-not-allowed"
      />
      <div className="tw-pointer-events-none tw-relative tw-z-10 tw-flex tw-w-full tw-items-center tw-gap-2">
        <button
          type="button"
          onClick={() => onFavoriteToggle(channel.id)}
          aria-pressed={favorite}
          aria-label={`${favorite ? (ar ? 'إزالة من المفضلة' : 'Remove favorite') : (ar ? 'إضافة إلى المفضلة' : 'Add favorite')}: ${channel.name}`}
          className={`tw-pointer-events-auto tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-md hover:tw-bg-panel focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet ${favorite ? 'tw-text-amber-400' : 'tw-text-muted'}`}
        >
          <Star size={16} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>

        <span className="tw-flex tw-h-8 tw-w-8 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-md tw-bg-panel">
          {channel.logo && !logoFailed ? (
            <Image src={channel.logo} alt="" width={32} height={32} loading="lazy" unoptimized referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} className="tw-h-full tw-w-full tw-object-contain" />
          ) : (
            <Tv size={16} className="tw-text-muted" aria-hidden="true" />
          )}
        </span>

        <span className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-justify-center tw-gap-0.5">
          <span className="tw-flex tw-min-w-0 tw-items-center tw-gap-1.5">
            <span title={channel.name} className="tw-truncate tw-text-sm tw-font-bold tw-text-white">{channel.name}</span>
            {quality && <span className="tw-shrink-0 tw-rounded tw-bg-violet/20 tw-px-1.5 tw-text-[10px] tw-font-bold tw-leading-4 tw-text-violet">{quality.label}</span>}
            {!channel.playable && <span className="tw-shrink-0 tw-rounded tw-bg-panel tw-px-1.5 tw-text-[10px] tw-leading-4 tw-text-muted">{ar ? 'غير متاح' : 'Unavailable'}</span>}
          </span>
          <span className="tw-flex tw-min-w-0 tw-items-center tw-gap-1 tw-text-xs tw-text-muted">
            {flag ? <span aria-hidden="true">{flag}</span> : <Globe size={11} aria-hidden="true" />}
            <span className="tw-truncate">{country || (ar ? 'دولة غير محددة' : 'Country not declared')}</span>
          </span>
        </span>

        <span className="tw-hidden tw-shrink-0 tw-rounded-full tw-border tw-border-line tw-bg-panel tw-px-2 tw-py-0.5 tw-text-[11px] tw-text-muted sm:tw-inline-block">
          {category?.[language] ?? channel.sourceGroup ?? (ar ? 'عام' : 'General')}
        </span>

        <button
          type="button"
          onClick={() => channel.playable && onPlay(channel)}
          disabled={!channel.playable}
          aria-label={playLabel}
          className="tw-pointer-events-auto tw-flex tw-h-8 tw-shrink-0 tw-items-center tw-gap-1 tw-rounded-full tw-bg-accent tw-px-3 tw-text-xs tw-font-bold tw-text-white tw-transition-opacity hover:tw-bg-accentHover focus-visible:tw-outline focus-visible:tw-outline-2 focus-visible:tw-outline-violet disabled:tw-opacity-40"
        >
          <Play size={13} aria-hidden="true" />
          <span className="tw-hidden sm:tw-inline">{ar ? 'تشغيل' : 'Play'}</span>
        </button>
      </div>
    </div>
  );
}

export const ChannelRowCompact = memo(ChannelRowCompactBase);
