/**
 * Free-to-air sports reference — channels that are genuinely free on satellite
 * but do NOT publish a free, credential-free web stream we could verify.
 *
 * Why this file exists instead of more entries in `public-tv.ts`:
 * `public-tv.ts` requires a verified HLS manifest served by the broadcaster.
 * The networks below cannot meet that bar today, so instead of inventing a
 * stream URL (or pointing at a restreamer) we publish the honest alternative:
 * the free satellite tuning details plus the operator's own official page.
 *
 * NOTHING here is playable inside Cloud Play, and the UI must say so plainly.
 *
 * Tuning details are transcribed from public satellite-monitoring listings and
 * are marked with the date they were collected. Satellite line-ups change, so
 * every entry links to the broadcaster's own page as the authority.
 *
 * Collected: 2026-11-08.
 */

export type SatelliteBand = {
  /** Satellite display name, e.g. "Arabsat / Badr 8 (26°E)". */
  satellite: string;
  /** Transponder frequency in MHz. */
  frequency: number;
  polarization: 'H' | 'V';
  symbolRate: number;
  fec: string;
  standard: string;
};

export type FreeToAirChannel = {
  id: string;
  nameAr: string;
  nameEn: string;
  country: string;
  broadcaster: string;
  /** What the network actually carries, so the entry is useful, not decorative. */
  coverageAr: string;
  coverageEn: string;
  officialUrl: string;
  /** Why there is no in-app player for this network. */
  webStatusAr: string;
  webStatusEn: string;
  /** Free (unencrypted) transponders only. Never list an encrypted package. */
  bands: SatelliteBand[];
};

export const FREE_TO_AIR: FreeToAirChannel[] = [
  {
    id: 'alkass',
    nameAr: 'قنوات الكأس',
    nameEn: 'Al Kass Sports',
    country: 'QA',
    broadcaster: 'Qatar Media Corporation',
    coverageAr: 'دوري نجوم قطر وكأس قطر والبطولات المحلية القطرية، مع برامج تحليلية يومية.',
    coverageEn: 'Qatar Stars League, Qatar Cup and domestic Qatari competitions, plus daily analysis shows.',
    officialUrl: 'https://www.alkass.net/',
    webStatusAr: 'لا يوجد بث ويب مجاني مفتوح تحقّقنا منه: صفحات البث القديمة على الموقع تحوّل للصفحة الرئيسية، والمشاهدة الرقمية صارت عبر تطبيق «شوف» باشتراك للمباريات. القنوات المفتوحة تُستقبل بالقمر الصناعي مجاناً، أما قنوات الكأس 5–8 فمشفّرة عبر beIN.',
    webStatusEn: 'No open free web stream could be verified: the old live pages on the official site redirect to the homepage, and digital viewing now runs through the Shoof app with a subscription for matches. The free-to-air channels are receivable by satellite at no cost, while Al Kass 5–8 are encrypted via beIN.',
    bands: [
      { satellite: 'Arabsat / Badr 8 (26°E)', frequency: 12245, polarization: 'V', symbolRate: 27500, fec: '3/4', standard: 'DVB-S2' },
      { satellite: 'Nilesat (7°W)', frequency: 11919, polarization: 'H', symbolRate: 27500, fec: '3/4', standard: 'DVB-S2' },
    ],
  },
  {
    id: 'thmanyah',
    nameAr: 'قنوات ثمانية',
    nameEn: 'Thmanyah Sports',
    country: 'SA',
    broadcaster: 'Thmanyah (SRMG)',
    coverageAr: 'دوري روشن السعودي وكأس خادم الحرمين الشريفين والسوبر ودوري يلو — الناقل الرسمي حتى 2031.',
    coverageEn: 'Saudi Roshn League, King Cup, Super Cup and Yelo League — official rights holder through 2031.',
    officialUrl: 'https://thmanyah.com/',
    webStatusAr: 'الشركة تعلن بثاً مجانياً لكل المباريات عبر تطبيقها وقنواتها الفضائية، مع باقة مدفوعة اختيارية للجودة الأعلى. لم نتحقق من رابط HLS مفتوح يصلح للتضمين، فالمشاهدة المجانية عبر التطبيق أو القمر الصناعي.',
    webStatusEn: 'The company announces free coverage of every match through its app and satellite channels, with an optional paid tier for higher quality. No open HLS URL suitable for embedding could be verified, so free viewing is via the app or satellite.',
    bands: [
      { satellite: 'Arabsat / Badr 8 (26°E)', frequency: 11919, polarization: 'H', symbolRate: 27500, fec: '3/4', standard: 'DVB-S2' },
    ],
  },
];

/** Defensive: only free-to-air entries with a real official HTTPS page ship. */
export function getFreeToAir(): FreeToAirChannel[] {
  return FREE_TO_AIR.filter(entry => {
    if (!entry.id || !entry.nameAr || !entry.nameEn || !entry.broadcaster) return false;
    if (entry.bands.length === 0) return false;
    try {
      const url = new URL(entry.officialUrl);
      if (url.protocol !== 'https:' || url.username || url.password) return false;
    } catch {
      return false;
    }
    return entry.bands.every(band =>
      band.frequency > 10000 && band.frequency < 13000
      && (band.polarization === 'H' || band.polarization === 'V')
      && band.symbolRate > 0,
    );
  });
}
