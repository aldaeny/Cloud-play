import type { Channel, ChannelQuality, StreamType } from '../types/channel';
import { CATEGORIES } from '../constants/categories';

export function formatQuality(quality: ChannelQuality | ''): string {
  return ({ '4K': '2160p', FHD: '1080p', HD: '720p', SD: '480p', '': 'Unknown' })[quality];
}
export function getQualityColor(quality: ChannelQuality | ''): string {
  return ({ '4K': 'bg-yellow-500 text-black', FHD: 'bg-purple-500 text-white', HD: 'bg-blue-500 text-white', SD: 'bg-gray-500 text-white', '': 'bg-gray-400 text-white' })[quality];
}
export function getStreamType(raw: string): StreamType | null {
  try {
    const path = new URL(raw, 'https://cloudplay.invalid').pathname.toLowerCase();
    if (path.endsWith('.m3u8')) return 'hls';
    if (path.endsWith('.mpd')) return 'dash';
    if (path.endsWith('.mp4')) return 'mp4';
    return null;
  } catch { return null; }
}
const qualityOrder: Record<ChannelQuality | '', number> = { '4K': 0, FHD: 1, HD: 2, SD: 3, '': 4 };
/** Filter only, preserving the source order. Sorting is a separate, explicit step. */
export function filterChannels(channels: Channel[], favorites: string[], searchQuery = '', categoryFilter = 'all', countryFilter = '', qualityFilter = ''): Channel[] {
  const needle = searchQuery.trim().toLocaleLowerCase();
  const saved = new Set(favorites);
  return channels.filter(channel => {
    const category = CATEGORIES.find(item => item.id === channel.category);
    if (needle && !`${channel.name} ${channel.country} ${channel.countryCode} ${channel.language} ${channel.sourceGroup} ${category?.ar ?? ''} ${category?.en ?? ''}`.toLocaleLowerCase().includes(needle)) return false;
    if (categoryFilter === 'favorites') return saved.has(channel.id);
    if (categoryFilter !== 'all' && channel.category !== categoryFilter) return false;
    if (countryFilter && (channel.countryCode || 'OTHER') !== countryFilter) return false;
    if (qualityFilter && (channel.quality || 'unknown') !== qualityFilter) return false;
    return true;
  });
}

/** Legacy helper kept for existing callers: filters, then pins favorites/Iraq. */
export function sortChannels(channels: Channel[], favorites: string[], searchQuery = '', categoryFilter = 'all', countryFilter = '', qualityFilter = '', sort = 'name'): Channel[] {
  const saved = new Set(favorites);
  const result = filterChannels(channels, favorites, searchQuery, categoryFilter, countryFilter, qualityFilter);
  return [...result].sort((a, b) => {
    const favoriteOrder = Number(saved.has(b.id)) - Number(saved.has(a.id));
    if (favoriteOrder) return favoriteOrder;
    const iraqOrder = Number(b.countryCode === 'IQ') - Number(a.countryCode === 'IQ');
    if (iraqOrder) return iraqOrder;
    let order = 0;
    if (sort === 'country') order = (a.country || '\uffff').localeCompare(b.country || '\uffff');
    else if (sort === 'quality') order = qualityOrder[a.quality] - qualityOrder[b.quality];
    else if (sort === 'category') order = a.category.localeCompare(b.category);
    return order || a.name.localeCompare(b.name, 'ar');
  });
}
