import type { Channel, ChannelQuality } from '../types/channel';
import { countryLabel } from './iptv-country';

/**
 * Channel sorting engine.
 *
 * Pure and stable: channels that compare equal keep their source order, so
 * "Default" is always the operator's original playlist order and "Favorites
 * first" never reshuffles the rest of the list. No channel is dropped, renamed
 * or invented here — this only reorders what the licensed source provided.
 */
export type ChannelSortKey = 'default' | 'az' | 'country-group' | 'quality-desc' | 'favorites-first';

export const CHANNEL_SORTS: { key: ChannelSortKey; ar: string; en: string }[] = [
  { key: 'default', ar: 'الافتراضي', en: 'Default' },
  { key: 'az', ar: 'أبجدي (أ-ي)', en: 'Alphabetical (A-Z)' },
  { key: 'country-group', ar: 'حسب الدولة', en: 'By country' },
  { key: 'quality-desc', ar: 'حسب الجودة', en: 'By quality' },
  { key: 'favorites-first', ar: 'المفضلة أولاً', en: 'Favorites first' },
];

export const DEFAULT_CHANNEL_SORT: ChannelSortKey = 'default';

export function isChannelSortKey(value: string | null | undefined): value is ChannelSortKey {
  return CHANNEL_SORTS.some(item => item.key === value);
}

/** Higher is better. An undeclared quality always sorts last. */
const QUALITY_RANK: Record<ChannelQuality | '', number> = { '4K': 4, FHD: 3, HD: 2, SD: 1, '': 0 };

export function qualityRank(quality: ChannelQuality | ''): number {
  return QUALITY_RANK[quality] ?? 0;
}

/** Country name in the viewer's language; empty when the source declares none. */
function countryName(channel: Channel, ar: boolean): string {
  if (channel.countryCode) return countryLabel(channel.countryCode, ar);
  return channel.country || '';
}

export function applyChannelSort(
  channels: Channel[],
  sort: ChannelSortKey,
  favorites: readonly string[] = [],
  language: 'ar' | 'en' = 'ar',
): Channel[] {
  if (sort === 'default' || channels.length < 2) return channels;
  const ar = language === 'ar';
  const collator = new Intl.Collator(ar ? 'ar' : 'en', { sensitivity: 'base', numeric: true });
  const byName = (a: Channel, b: Channel) => collator.compare(a.name, b.name);
  // Copy first: callers keep the original array intact for the "Default" mode.
  const result = [...channels];
  if (sort === 'favorites-first') {
    const saved = new Set(favorites);
    return result.sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id)));
  }
  if (sort === 'az') return result.sort(byName);
  if (sort === 'quality-desc') {
    return result.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality) || byName(a, b));
  }
  return result.sort((a, b) => {
    const left = countryName(a, ar);
    const right = countryName(b, ar);
    // Channels without a declared country form the last group, never a fake one.
    if (!left !== !right) return left ? -1 : 1;
    return collator.compare(left, right) || byName(a, b);
  });
}
