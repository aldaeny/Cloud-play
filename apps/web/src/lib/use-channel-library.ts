'use client';
import { useCallback, useEffect, useState } from 'react';
import { Favorites } from './storage';
import { LIBRARY_EVENT } from './preferences';

/** Shared local/cloud favorite IDs, including updates from another tab or account sync. */
export function useChannelFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    const refresh = () => setFavorites(Favorites.get());
    refresh();
    window.addEventListener(LIBRARY_EVENT, refresh); window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(LIBRARY_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  const toggle = useCallback((id: string) => setFavorites(Favorites.toggle(id)), []);
  return { favorites, toggle };
}
