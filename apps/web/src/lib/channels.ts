import type { Channel, ChannelCategory, ChannelQuality, EPGProgram } from '../types/channel';
import type { LicensedChannel } from '../server/licensed-iptv';
import type { Guide } from '../server/licensed-epg';
import { countryCode, countryLabel } from './iptv-country';
import { getStreamType } from './player-utils';

export class ChannelRequestError extends Error {
  constructor(message: string, public readonly status = 0) { super(message); this.name = 'ChannelRequestError'; }
}
async function requestData(signal?: AbortSignal): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 12000);
  try {
    const response = await fetch('/api/iptv/licensed', { cache: 'no-store', signal: controller.signal });
    const body: unknown = await response.json();
    return { response, body };
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ChannelRequestError('CONNECTION_FAILED');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
const CATEGORY_RULES: [ChannelCategory, RegExp][] = [
  ['sports', /sport|رياض|كرة|bein/i], ['news', /news|أخبار|اخبار|إخبار/i],
  ['movies', /movie|film|cinema|أفلام|افلام|سينما/i], ['series', /series|drama|مسلسل|دراما/i],
  ['kids', /kid|child|cartoon|أطفال|اطفال|كرتون/i], ['religious', /quran|islam|religio|قرآن|قران|دين|إسلام/i],
  ['music', /music|موسيق|أغان|اغاني/i], ['documentary', /document|discovery|وثائق/i],
  ['education', /educat|تعليم|ثقاف/i], ['comedy', /comedy|كوميدي/i], ['entertainment', /entertain|ترفيه|منوع/i],
];
export function categoryOf(group: string, name = ''): ChannelCategory {
  return CATEGORY_RULES.find(([, rule]) => rule.test(`${group} ${name}`))?.[0] ?? 'general';
}
/** Only an explicit resolution in source metadata is labelled; otherwise quality stays unknown. */
export function qualityOf(text: string): { quality: ChannelQuality | ''; qualityLabel: string } {
  const match = text.match(/(?:^|[\s[_-])(2160p|4k|uhd|1080p|fhd|720p|hd|480p|sd)(?=$|[\s\]_-])/i);
  const value = match?.[1].toLowerCase();
  if (value === '2160p' || value === '4k' || value === 'uhd') return { quality: '4K', qualityLabel: '4K' };
  if (value === '1080p' || value === 'fhd') return { quality: 'FHD', qualityLabel: '1080p' };
  if (value === '720p' || value === 'hd') return { quality: 'HD', qualityLabel: value === 'hd' ? 'HD' : '720p' };
  if (value === '480p' || value === 'sd') return { quality: 'SD', qualityLabel: value === 'sd' ? 'SD' : '480p' };
  return { quality: '', qualityLabel: '' };
}
export function adaptChannel(source: LicensedChannel): Channel {
  const code = countryCode(source);
  return {
    id: source.id, name: source.name, logo: source.logo ?? '', streamUrl: source.streamUrl ?? '',
    streamType: getStreamType(source.streamUrl ?? '') ?? 'hls', category: categoryOf(source.group, source.name), sourceGroup: source.group,
    countryCode: code, country: code ? countryLabel(code, true) : '', language: '',
    ...qualityOf(`${source.name} ${source.group}`), isLive: true,
    playable: source.playable && Boolean(source.streamUrl), epgId: source.epgId,
  };
}
function isLicensedChannel(value: unknown): value is LicensedChannel {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.group === 'string' && typeof c.epgId === 'string' && typeof c.playable === 'boolean' && (c.streamUrl === undefined || typeof c.streamUrl === 'string') && (c.logo === undefined || typeof c.logo === 'string');
}
/** The only public catalog is the operator's rights-reviewed playlist. No generated fallback data. */
export async function fetchChannels(signal?: AbortSignal): Promise<Channel[]> {
  const { response, body } = await requestData(signal);
  if (!response.ok || !body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) throw new ChannelRequestError('SOURCE_UNAVAILABLE', response.status);
  const rows = (body as { data: unknown[] }).data;
  if (!rows.every(isLicensedChannel)) throw new ChannelRequestError('INVALID_SOURCE', response.status);
  return rows.map(adaptChannel);
}
export async function fetchChannel(id: string, signal?: AbortSignal): Promise<Channel | null> {
  return (await fetchChannels(signal)).find(channel => channel.id === id) ?? null;
}
function validProgram(value: unknown): value is { start: string; end: string; title: string } {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.title === 'string' && typeof p.start === 'string' && typeof p.end === 'string' && Number.isFinite(Date.parse(p.start)) && Number.isFinite(Date.parse(p.end)) && Date.parse(p.end) > Date.parse(p.start);
}
/** EPG failures are independent of channel loading; an absent guide is an honest empty state. */
export async function fetchEPG(signal?: AbortSignal): Promise<Record<string, EPGProgram[]>> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 12000);
  let response: Response;
  try { response = await fetch('/api/iptv/epg', { cache: 'no-store', signal: controller.signal }); }
  catch (error) { if (signal?.aborted) throw error; throw new ChannelRequestError('GUIDE_UNAVAILABLE'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  if (!response.ok) throw new ChannelRequestError('GUIDE_UNAVAILABLE', response.status);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !(body as { data?: unknown }).data || typeof (body as { data: unknown }).data !== 'object') throw new ChannelRequestError('INVALID_GUIDE');
  const guide = (body as { data: Guide }).data;
  const result: Record<string, EPGProgram[]> = Object.create(null);
  for (const [id, entry] of Object.entries(guide)) {
    if (!entry || typeof entry !== 'object') continue;
    const programs = [entry.now, entry.next].filter(validProgram).map(p => ({ id: `${id}-${p.start}`, title: p.title, start: p.start, end: p.end }));
    if (programs.length) result[id] = programs;
  }
  return result;
}
