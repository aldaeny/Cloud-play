'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { PREFS_EVENT, notifyPrefsChanged } from './preferences';
import { DEFAULT_CHANNEL_SORT, isChannelSortKey, type ChannelSortKey } from './channel-sort';

/**
 * Persisted channel browsing preferences (view mode + sort engine).
 *
 * Read through `useSyncExternalStore` with a stable server snapshot so the first
 * client render matches SSR (no hydration mismatch), then upgrades to the saved
 * device choice. Storage failures are non-fatal: browsing still works.
 */
export type ChannelView = 'grid' | 'list';

const VIEW_KEY = 'cloudplay-channel-view';
const SORT_KEY = 'cloudplay-channel-sort';

type ChannelViewState = { view: ChannelView; sort: ChannelSortKey };

const SERVER_STATE: ChannelViewState = { view: 'grid', sort: DEFAULT_CHANNEL_SORT };
let snapshot: ChannelViewState | null = null;

function read(): ChannelViewState {
  try {
    const view = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
    const stored = localStorage.getItem(SORT_KEY);
    return { view, sort: isChannelSortKey(stored) ? stored : DEFAULT_CHANNEL_SORT };
  } catch { return SERVER_STATE; }
}

function getSnapshot(): ChannelViewState {
  if (!snapshot) snapshot = read();
  return snapshot;
}

function subscribe(onChange: () => void): () => void {
  const invalidate = () => { snapshot = null; onChange(); };
  window.addEventListener(PREFS_EVENT, invalidate);
  window.addEventListener('storage', invalidate);
  return () => {
    window.removeEventListener(PREFS_EVENT, invalidate);
    window.removeEventListener('storage', invalidate);
  };
}

function write(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage optional */ }
  snapshot = null;
  notifyPrefsChanged();
}

export function useChannelView() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
  const setView = useCallback((view: ChannelView) => write(VIEW_KEY, view), []);
  const setSort = useCallback((sort: ChannelSortKey) => write(SORT_KEY, sort), []);
  return { ...state, setView, setSort };
}
