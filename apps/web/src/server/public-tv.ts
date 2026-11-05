/**
 * Curated PUBLIC live TV — free-to-air streams published by the broadcasters
 * themselves, on their own infrastructure. No account, no login, no operator
 * configuration required.
 *
 * Inclusion rules (every entry must satisfy all of them):
 *   1. The stream is served from the broadcaster's own domain or its CDN.
 *   2. It is published openly for the broadcaster's own free web player —
 *      no credentials, no tokens, no DRM, no restreamer in the middle.
 *   3. HTTPS end to end, so it works on an HTTPS page without mixed content.
 *   4. The master playlist was fetched and verified to be a real HLS manifest.
 *
 * This is deliberately a small hand-checked list, NOT an aggregated IPTV
 * playlist: aggregation cannot demonstrate who publishes each stream.
 * Every entry keeps a link back to the broadcaster's official page.
 *
 * Verified: 2026-11-05 — each master playlist returned a valid #EXTM3U.
 */

export type PublicGroup = 'iraq' | 'news' | 'world';

export type PublicChannel = {
  id: string;
  nameAr: string;
  nameEn: string;
  group: PublicGroup;
  country: string;
  language: 'ar' | 'en';
  /** Who owns and publishes the stream. */
  broadcaster: string;
  /** The broadcaster's own watch page, shown as attribution and as a fallback. */
  officialUrl: string;
  streamUrl: string;
};

export const PUBLIC_CHANNELS: PublicChannel[] = [
  // ——— Iraq ———
  {
    id: 'alsharqiya',
    nameAr: 'الشرقية',
    nameEn: 'Al Sharqiya',
    group: 'iraq',
    country: 'IQ',
    language: 'ar',
    broadcaster: 'Al Sharqiya Group',
    officialUrl: 'https://www.alsharqiya.com/',
    streamUrl: 'https://indexforce.com/tvhighres/mystream/playlist.m3u8',
  },
  {
    id: 'alsharqiya-news',
    nameAr: 'الشرقية الإخبارية',
    nameEn: 'Al Sharqiya News',
    group: 'iraq',
    country: 'IQ',
    language: 'ar',
    broadcaster: 'Al Sharqiya Group',
    officialUrl: 'https://www.alsharqiya.com/',
    streamUrl: 'https://indexforce.com/newshighres/mystream/playlist.m3u8',
  },
  {
    id: 'alrasheed',
    nameAr: 'الرشيد',
    nameEn: 'Al Rasheed TV',
    group: 'iraq',
    country: 'IQ',
    language: 'ar',
    broadcaster: 'Al Rasheed TV',
    officialUrl: 'https://alrasheedmedia.com/',
    streamUrl: 'https://media1.livaat.com/static/AL-RASHEED-HD/playlist.m3u8',
  },

  // ——— Arabic news ———
  {
    id: 'aljazeera',
    nameAr: 'الجزيرة',
    nameEn: 'Al Jazeera Arabic',
    group: 'news',
    country: 'QA',
    language: 'ar',
    broadcaster: 'Al Jazeera Media Network',
    officialUrl: 'https://www.aljazeera.net/live',
    streamUrl: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
  },
  {
    id: 'aljazeera-mubasher',
    nameAr: 'الجزيرة مباشر',
    nameEn: 'Al Jazeera Mubasher',
    group: 'news',
    country: 'QA',
    language: 'ar',
    broadcaster: 'Al Jazeera Media Network',
    officialUrl: 'https://www.aljazeera.net/live',
    streamUrl: 'https://live-hls-web-ajm.getaj.net/AJM/index.m3u8',
  },
  {
    id: 'alarabiya',
    nameAr: 'العربية',
    nameEn: 'Al Arabiya',
    group: 'news',
    country: 'SA',
    language: 'ar',
    broadcaster: 'Al Arabiya',
    officialUrl: 'https://www.alarabiya.net/live-stream',
    streamUrl: 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8',
  },
  {
    id: 'alhadath',
    nameAr: 'الحدث',
    nameEn: 'Al Hadath',
    group: 'news',
    country: 'SA',
    language: 'ar',
    broadcaster: 'Al Arabiya',
    officialUrl: 'https://www.alarabiya.net/alhadath',
    streamUrl: 'https://live.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8',
  },
  {
    id: 'skynewsarabia',
    nameAr: 'سكاي نيوز عربية',
    nameEn: 'Sky News Arabia',
    group: 'news',
    country: 'SA',
    language: 'ar',
    broadcaster: 'Sky News Arabia',
    officialUrl: 'https://www.skynewsarabia.com/live',
    streamUrl: 'https://stream.skynewsarabia.com/hls/sna.m3u8',
  },
  {
    id: 'trt-arabi',
    nameAr: 'TRT عربي',
    nameEn: 'TRT Arabi',
    group: 'news',
    country: 'TR',
    language: 'ar',
    broadcaster: 'TRT (Turkish Radio and Television)',
    officialUrl: 'https://www.trtarabi.com/',
    streamUrl: 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8',
  },
  {
    id: 'dw-arabic',
    nameAr: 'DW عربية',
    nameEn: 'DW Arabic',
    group: 'news',
    country: 'DE',
    language: 'ar',
    broadcaster: 'Deutsche Welle',
    officialUrl: 'https://www.dw.com/ar/live-tv',
    streamUrl: 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8',
  },

  // ——— English / international ———
  {
    id: 'aljazeera-english',
    nameAr: 'الجزيرة الإنجليزية',
    nameEn: 'Al Jazeera English',
    group: 'world',
    country: 'QA',
    language: 'en',
    broadcaster: 'Al Jazeera Media Network',
    officialUrl: 'https://www.aljazeera.com/live',
    streamUrl: 'https://live-hls-apps-aje.getaj.net/AJE/index.m3u8',
  },
  {
    id: 'dw-english',
    nameAr: 'DW الإنجليزية',
    nameEn: 'DW English',
    group: 'world',
    country: 'DE',
    language: 'en',
    broadcaster: 'Deutsche Welle',
    officialUrl: 'https://www.dw.com/en/live-tv/channel-english',
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8',
  },
];

/**
 * Defensive filter: a curated entry must be a credential-free HTTPS HLS URL.
 * Guards against a bad edit ever shipping an http:// or credentialed stream to
 * a public page.
 */
export function isSafePublicStream(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
    if (url.port && url.port !== '443') return false;
    if (!url.pathname.toLowerCase().endsWith('.m3u8')) return false;
    if (!/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
}

export function getPublicChannels(): PublicChannel[] {
  const seen = new Set<string>();
  return PUBLIC_CHANNELS.filter(channel => {
    if (seen.has(channel.id) || !isSafePublicStream(channel.streamUrl)) return false;
    seen.add(channel.id);
    return true;
  });
}
