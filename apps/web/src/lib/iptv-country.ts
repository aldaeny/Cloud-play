import type { LicensedChannel } from '../server/licensed-iptv';

/**
 * Presentation-only country derivation for the licensed TV list.
 *
 * The operator playlist (`licensed-iptv.ts`) carries no country field — only a
 * `group` (category) and an optional `epgId`. Many guides use the iptv-org
 * convention `ChannelName.cc` (a two-letter ISO country suffix), so we derive the
 * country from that suffix, falling back to a country-named group. This NEVER
 * mutates the source data, stream URLs or parsing — it only organises the list.
 * Channels whose country cannot be determined are grouped under "Other" so no
 * channel is ever hidden or mixed into another country.
 */

const NAMES: Record<string, { ar: string; en: string }> = {
  IQ: { ar: 'العراق', en: 'Iraq' }, SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  AE: { ar: 'الإمارات', en: 'United Arab Emirates' }, EG: { ar: 'مصر', en: 'Egypt' },
  JO: { ar: 'الأردن', en: 'Jordan' }, LB: { ar: 'لبنان', en: 'Lebanon' },
  SY: { ar: 'سوريا', en: 'Syria' }, KW: { ar: 'الكويت', en: 'Kuwait' },
  QA: { ar: 'قطر', en: 'Qatar' }, BH: { ar: 'البحرين', en: 'Bahrain' },
  OM: { ar: 'عُمان', en: 'Oman' }, YE: { ar: 'اليمن', en: 'Yemen' },
  LY: { ar: 'ليبيا', en: 'Libya' }, TN: { ar: 'تونس', en: 'Tunisia' },
  DZ: { ar: 'الجزائر', en: 'Algeria' }, MA: { ar: 'المغرب', en: 'Morocco' },
  SD: { ar: 'السودان', en: 'Sudan' }, PS: { ar: 'فلسطين', en: 'Palestine' },
  MR: { ar: 'موريتانيا', en: 'Mauritania' }, SO: { ar: 'الصومال', en: 'Somalia' },
  DJ: { ar: 'جيبوتي', en: 'Djibouti' }, KM: { ar: 'جزر القمر', en: 'Comoros' },
  TR: { ar: 'تركيا', en: 'Türkiye' }, IR: { ar: 'إيران', en: 'Iran' },
  US: { ar: 'الولايات المتحدة', en: 'United States' }, GB: { ar: 'المملكة المتحدة', en: 'United Kingdom' },
  FR: { ar: 'فرنسا', en: 'France' }, DE: { ar: 'ألمانيا', en: 'Germany' },
  IN: { ar: 'الهند', en: 'India' }, PK: { ar: 'باكستان', en: 'Pakistan' },
};

const BY_NAME = new Map<string, string>();
for (const [code, n] of Object.entries(NAMES)) {
  BY_NAME.set(n.en.toLowerCase(), code);
  BY_NAME.set(n.ar, code);
}

/** ISO country code for a channel, or '' when it cannot be determined. */
export function countryCode(c: LicensedChannel): string {
  const suffix = c.epgId?.match(/\.([a-zA-Z]{2})$/);
  if (suffix) {
    const code = suffix[1].toUpperCase();
    if (NAMES[code]) return code;
  }
  const group = (c.group || '').trim();
  if (BY_NAME.has(group.toLowerCase())) return BY_NAME.get(group.toLowerCase())!;
  if (BY_NAME.has(group)) return BY_NAME.get(group)!;
  return '';
}

export const OTHER = 'OTHER';

export function countryLabel(code: string, ar: boolean): string {
  if (code === OTHER) return ar ? 'أخرى / غير مصنّف' : 'Other / unclassified';
  const n = NAMES[code];
  return n ? (ar ? n.ar : n.en) : code;
}

/** Sorted unique country codes present in a channel list (Other last). */
export function countriesOf(channels: LicensedChannel[]): string[] {
  const set = new Set<string>();
  for (const c of channels) set.add(countryCode(c) || OTHER);
  return [...set].sort((a, b) => {
    if (a === OTHER) return 1;
    if (b === OTHER) return -1;
    return countryLabel(a, false).localeCompare(countryLabel(b, false));
  });
}
