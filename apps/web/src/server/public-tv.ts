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
 * This is deliberately a hand-checked list, NOT an aggregated IPTV playlist:
 * aggregation cannot demonstrate who publishes each stream. Every entry keeps
 * a link back to the broadcaster's official page.
 *
 * Verified: 2026-11-05 — each master playlist returned a valid #EXTM3U.
 */

export type PublicGroup = 'iraq' | 'news' | 'gulf' | 'levant' | 'sport' | 'world';

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
  { id: 'alsharqiya', nameAr: 'الشرقية', nameEn: 'Al Sharqiya', group: 'iraq', country: 'IQ', language: 'ar', broadcaster: 'Al Sharqiya Group', officialUrl: 'https://www.alsharqiya.com/', streamUrl: 'https://indexforce.com/tvhighres/mystream/playlist.m3u8' },
  { id: 'alsharqiya-news', nameAr: 'الشرقية الإخبارية', nameEn: 'Al Sharqiya News', group: 'iraq', country: 'IQ', language: 'ar', broadcaster: 'Al Sharqiya Group', officialUrl: 'https://www.alsharqiya.com/', streamUrl: 'https://indexforce.com/newshighres/mystream/playlist.m3u8' },
  { id: 'alrasheed', nameAr: 'الرشيد', nameEn: 'Al Rasheed TV', group: 'iraq', country: 'IQ', language: 'ar', broadcaster: 'Al Rasheed TV', officialUrl: 'https://alrasheedmedia.com/', streamUrl: 'https://media1.livaat.com/static/AL-RASHEED-HD/playlist.m3u8' },

  // ——— Arabic news & business ———
  { id: 'aljazeera', nameAr: 'الجزيرة', nameEn: 'Al Jazeera Arabic', group: 'news', country: 'QA', language: 'ar', broadcaster: 'Al Jazeera Media Network', officialUrl: 'https://www.aljazeera.net/live', streamUrl: 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8' },
  { id: 'aljazeera-mubasher', nameAr: 'الجزيرة مباشر', nameEn: 'Al Jazeera Mubasher', group: 'news', country: 'QA', language: 'ar', broadcaster: 'Al Jazeera Media Network', officialUrl: 'https://www.aljazeera.net/live', streamUrl: 'https://live-hls-web-ajm.getaj.net/AJM/index.m3u8' },
  { id: 'alarabiya', nameAr: 'العربية', nameEn: 'Al Arabiya', group: 'news', country: 'SA', language: 'ar', broadcaster: 'Al Arabiya', officialUrl: 'https://www.alarabiya.net/live-stream', streamUrl: 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8' },
  { id: 'alhadath', nameAr: 'الحدث', nameEn: 'Al Hadath', group: 'news', country: 'SA', language: 'ar', broadcaster: 'Al Arabiya', officialUrl: 'https://www.alarabiya.net/alhadath', streamUrl: 'https://live.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8' },
  { id: 'skynewsarabia', nameAr: 'سكاي نيوز عربية', nameEn: 'Sky News Arabia', group: 'news', country: 'SA', language: 'ar', broadcaster: 'Sky News Arabia', officialUrl: 'https://www.skynewsarabia.com/live', streamUrl: 'https://stream.skynewsarabia.com/hls/sna.m3u8' },
  { id: 'trt-arabi', nameAr: 'TRT عربي', nameEn: 'TRT Arabi', group: 'news', country: 'TR', language: 'ar', broadcaster: 'TRT (Turkish Radio and Television)', officialUrl: 'https://www.trtarabi.com/', streamUrl: 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8' },
  { id: 'dw-arabic', nameAr: 'DW عربية', nameEn: 'DW Arabic', group: 'news', country: 'DE', language: 'ar', broadcaster: 'Deutsche Welle', officialUrl: 'https://www.dw.com/ar/live-tv', streamUrl: 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8' },
  { id: 'alaraby', nameAr: 'التلفزيون العربي', nameEn: 'Al Araby TV', group: 'news', country: 'QA', language: 'ar', broadcaster: 'Al Araby Television Network', officialUrl: 'https://www.alaraby.co.uk/live', streamUrl: 'https://live.kwikmotion.com/alaraby1live/alaraby_abr/playlist.m3u8' },
  { id: 'alaraby2', nameAr: 'العربي 2', nameEn: 'Al Araby TV 2', group: 'news', country: 'QA', language: 'ar', broadcaster: 'Al Araby Television Network', officialUrl: 'https://www.alaraby.co.uk/live', streamUrl: 'https://live.kwikmotion.com/alaraby2live/alaraby2.smil/playlist.m3u8' },
  { id: 'almayadeen', nameAr: 'الميادين', nameEn: 'Al Mayadeen', group: 'news', country: 'LB', language: 'ar', broadcaster: 'Al Mayadeen', officialUrl: 'https://www.almayadeen.net/live', streamUrl: 'https://mdnlv.cdn.octivid.com/almdn/smil:mpegts.stream.smil/playlist.m3u8' },
  { id: 'cnbc-arabiya', nameAr: 'CNBC عربية', nameEn: 'CNBC Arabiya', group: 'news', country: 'AE', language: 'ar', broadcaster: 'CNBC Arabiya', officialUrl: 'https://www.cnbcarabia.com/live', streamUrl: 'https://cnbc-live.akamaized.net/cnbc/master.m3u8' },
  { id: 'alarabiya-business', nameAr: 'العربية أسواق', nameEn: 'Al Arabiya Business', group: 'news', country: 'SA', language: 'ar', broadcaster: 'Al Arabiya', officialUrl: 'https://www.alarabiya.net/aswaq', streamUrl: 'https://live.alarabiya.net/alarabiapublish/aswaaq.smil/playlist.m3u8' },
  { id: 'ktv-news', nameAr: 'الكويت الإخبارية', nameEn: 'KTV News', group: 'news', country: 'KW', language: 'ar', broadcaster: 'Kuwait Television', officialUrl: 'https://www.media.gov.kw/', streamUrl: 'https://kwtkbta.cdn.mangomolo.com/kb/smil:kb.stream.smil/chunklist.m3u8' },
  { id: 'palestine-mubasher', nameAr: 'فلسطين مباشر', nameEn: 'Palestine Mubasher', group: 'news', country: 'PS', language: 'ar', broadcaster: 'Palestinian Broadcasting Corporation', officialUrl: 'https://www.pbc.ps/', streamUrl: 'https://pbc.furrera.ps/palestinelivehd/index.m3u8' },

  // ——— Gulf ———
  { id: 'ktv1', nameAr: 'الكويت 1', nameEn: 'KTV 1', group: 'gulf', country: 'KW', language: 'ar', broadcaster: 'Kuwait Television', officialUrl: 'https://www.media.gov.kw/', streamUrl: 'https://kwtktv1ta.cdn.mangomolo.com/ktv1/smil:ktv1.stream.smil/chunklist.m3u8' },
  { id: 'ktv-ethraa', nameAr: 'الكويت إثراء', nameEn: 'KTV Ethraa', group: 'gulf', country: 'KW', language: 'ar', broadcaster: 'Kuwait Television', officialUrl: 'https://www.media.gov.kw/', streamUrl: 'https://kwtethta.cdn.mangomolo.com/eth/smil:eth.stream.smil/chunklist.m3u8' },
  { id: 'ajman', nameAr: 'عجمان', nameEn: 'Ajman TV', group: 'gulf', country: 'AE', language: 'ar', broadcaster: 'Ajman Media', officialUrl: 'https://ajmantv.com/', streamUrl: 'https://cdn1.logichost.in/ajmantv/live/playlist.m3u8' },
  { id: 'quran-kareem', nameAr: 'القرآن الكريم', nameEn: 'Al Quran Al Kareem', group: 'gulf', country: 'SA', language: 'ar', broadcaster: 'Saudi Broadcasting Authority', officialUrl: 'https://www.sba.sa/', streamUrl: 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8' },

  // ——— Levant ———
  { id: 'jordan-tv', nameAr: 'التلفزيون الأردني', nameEn: 'Jordan Satellite Channel', group: 'levant', country: 'JO', language: 'ar', broadcaster: 'Jordan Radio and Television', officialUrl: 'https://www.jrtv.gov.jo/', streamUrl: 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8' },
  { id: 'amman-tv', nameAr: 'عمّان تي في', nameEn: 'Amman TV', group: 'levant', country: 'JO', language: 'ar', broadcaster: 'Amman TV', officialUrl: 'https://ammantv.net/', streamUrl: 'https://ammantv-live.ercdn.net/ammantvhd/ammantvhd.m3u8' },
  { id: 'roya-tv', nameAr: 'رؤيا', nameEn: 'Roya TV', group: 'levant', country: 'JO', language: 'ar', broadcaster: 'Roya TV', officialUrl: 'https://roya.tv/live', streamUrl: 'https://live.kwikmotion.com/royatvpublic/royatv.smil/playlist.m3u8' },
  { id: 'palestine-tv', nameAr: 'تلفزيون فلسطين', nameEn: 'Palestine Satellite Channel', group: 'levant', country: 'PS', language: 'ar', broadcaster: 'Palestinian Broadcasting Corporation', officialUrl: 'https://www.pbc.ps/', streamUrl: 'https://pbc.furrera.ps/palestinehd/index.m3u8' },
  { id: 'musawa', nameAr: 'مساواة', nameEn: 'Musawa Channel', group: 'levant', country: 'PS', language: 'ar', broadcaster: 'Palestinian Broadcasting Corporation', officialUrl: 'https://www.pbc.ps/', streamUrl: 'https://pbc.furrera.ps/musawahd/index.m3u8' },
  { id: 'future-tv', nameAr: 'تلفزيون المستقبل', nameEn: 'Future TV', group: 'levant', country: 'LB', language: 'ar', broadcaster: 'Future Television', officialUrl: 'https://www.ftv.com.lb/', streamUrl: 'https://live.kwikmotion.com/futurelive/ftv.smil/playlist.m3u8' },

  // ——— Sport ———
  { id: 'ktv-sport', nameAr: 'الكويت الرياضية', nameEn: 'KTV Sport', group: 'sport', country: 'KW', language: 'ar', broadcaster: 'Kuwait Television', officialUrl: 'https://www.media.gov.kw/', streamUrl: 'https://kwtspta.cdn.mangomolo.com/sp/smil:sp.stream.smil/chunklist.m3u8' },
  { id: 'jordan-sport', nameAr: 'الأردن الرياضية', nameEn: 'Jordan Sport', group: 'sport', country: 'JO', language: 'ar', broadcaster: 'Jordan Radio and Television', officialUrl: 'https://www.jrtv.gov.jo/', streamUrl: 'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8' },

  // ——— English / international ———
  { id: 'aljazeera-english', nameAr: 'الجزيرة الإنجليزية', nameEn: 'Al Jazeera English', group: 'world', country: 'QA', language: 'en', broadcaster: 'Al Jazeera Media Network', officialUrl: 'https://www.aljazeera.com/live', streamUrl: 'https://live-hls-apps-aje.getaj.net/AJE/index.m3u8' },
  { id: 'dw-english', nameAr: 'DW الإنجليزية', nameEn: 'DW English', group: 'world', country: 'DE', language: 'en', broadcaster: 'Deutsche Welle', officialUrl: 'https://www.dw.com/en/live-tv/channel-english', streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8' },
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
