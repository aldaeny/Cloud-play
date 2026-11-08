import { notifyLibraryChanged } from './preferences';
import type { Channel } from '../types/channel';

export const STORAGE_KEYS = {
  HISTORY: 'cloud-play-history',
  /** Canonical TV key shared with LicensedTv, PublicTv and free-account sync. */
  FAVORITES: 'cloudplay-tv-favorites-v1',
  LEGACY_FAVORITES: 'cloud-play-favorites',
  PREFERENCES: 'cloud-play-preferences',
  LAST_CHANNEL: 'cloud-play-last-channel',
} as const;

export function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try { const item = localStorage.getItem(key); return item ? JSON.parse(item) as T : defaultValue; }
  catch { return defaultValue; }
}
export function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Session state still works. */ }
}
export function clearStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* Storage is optional. */ }
}
function readIds(key: string): string[] {
  const value = getStorage<unknown>(key, []);
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200))].slice(0, 1200) : [];
}
export type WatchHistoryEntry = { id: string; name: string; logo: string; watchedAt: string };
export const WatchHistory = {
  get: (): WatchHistoryEntry[] => {
    const value = getStorage<unknown>(STORAGE_KEYS.HISTORY, []);
    return Array.isArray(value) ? value.filter((x): x is WatchHistoryEntry => !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.name === 'string').map(x => ({ id: x.id, name: x.name, logo: typeof x.logo === 'string' ? x.logo : '', watchedAt: typeof x.watchedAt === 'string' ? x.watchedAt : '' })).slice(0, 20) : [];
  },
  /** Save metadata only; never persist stream endpoints or request headers. */
  add: (channel: Channel) => {
    const entry = { id: channel.id, name: channel.name, logo: channel.logo, watchedAt: new Date().toISOString() };
    setStorage(STORAGE_KEYS.HISTORY, [entry, ...WatchHistory.get().filter(c => c.id !== channel.id)].slice(0, 20));
  },
};
export const Favorites = {
  get: (): string[] => {
    const current = readIds(STORAGE_KEYS.FAVORITES);
    const legacy = readIds(STORAGE_KEYS.LEGACY_FAVORITES);
    const migrated = getStorage<boolean>('cloudplay-tv-favorites-migrated', false) === true;
    const merged = [...new Set([...current, ...(migrated ? [] : legacy)])].slice(0, 1200);
    // Migrate once, without deleting the old key or losing previously saved IDs.
    if (legacy.length && !migrated) {
      setStorage(STORAGE_KEYS.FAVORITES, merged);
      setStorage('cloudplay-tv-favorites-migrated', true);
      notifyLibraryChanged();
    }
    return merged;
  },
  toggle: (channelId: string): string[] => {
    const current = Favorites.get();
    const next = current.includes(channelId) ? current.filter(id => id !== channelId) : [...current, channelId].slice(0, 1200);
    setStorage(STORAGE_KEYS.FAVORITES, next);
    notifyLibraryChanged();
    return next;
  },
  isFavorite: (channelId: string) => Favorites.get().includes(channelId),
};
