// إدارة التخزين المحلي (LocalStorage)
export const STORAGE_KEYS = {
  HISTORY: 'cloud-play-history',
  FAVORITES: 'cloud-play-favorites',
  PREFERENCES: 'cloud-play-preferences',
  LAST_CHANNEL: 'cloud-play-last-channel'
};

export function getStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) as T : defaultValue;
  } catch (e) {
    console.error("Storage error:", e);
    return defaultValue;
  }
}

export function setStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

export function clearStorage(key: string) {
  localStorage.removeItem(key);
}

// أمثلة على الاستخدام:
export const WatchHistory = {
  get: () => getStorage<any[]>(STORAGE_KEYS.HISTORY, []),
  add: (channel: any) => {
    const history = getStorage<any[]>(STORAGE_KEYS.HISTORY, []);
    const filtered = history.filter(c => c.id !== channel.id);
    setStorage(STORAGE_KEYS.HISTORY, [channel, ...filtered].slice(0, 20));
  }
};

export const Favorites = {
  get: () => getStorage<string[]>(STORAGE_KEYS.FAVORITES, []),
  toggle: (channelId: string) => {
    const favs = getStorage<string[]>(STORAGE_KEYS.FAVORITES, []);
    const index = favs.indexOf(channelId);
    if (index > -1) {
      favs.splice(index, 1);
    } else {
      favs.push(channelId);
    }
    setStorage(STORAGE_KEYS.FAVORITES, favs);
    return favs;
  },
  isFavorite: (channelId: string) => {
    const favs = getStorage<string[]>(STORAGE_KEYS.FAVORITES, []);
    return favs.includes(channelId);
  }
};
