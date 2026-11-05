import { getSupabase } from './supabase';
import { notifyPrefsChanged, notifyLibraryChanged } from './preferences';
export { LIBRARY_EVENT, notifyLibraryChanged } from './preferences';

/**
 * Free-account library sync.
 *
 * localStorage remains the immediate source of truth for the UI. When a user
 * signs in, cloud rows are merged into the device, then the merged device
 * library is pushed back. While signed in, library changes are pushed again.
 * No payment/subscription data is involved.
 */
type LocalLibrary = {
  movieFavorites: string[];
  tvFavorites: string[];
  progress: Record<string, { position: number; duration: number }>;
};

function readStringArray(key: string, max: number): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 200).slice(0, max);
  } catch { return []; }
}

export function readLocalLibrary(): LocalLibrary | null {
  if (typeof window === 'undefined') return null;
  try {
    // Touch storage so private/blocked storage fails closed instead of wiping cloud data.
    void localStorage.length;
    const progress: LocalLibrary['progress'] = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('cloudplay-progress-v1-')) continue;
      const itemId = key.slice('cloudplay-progress-v1-'.length);
      if (!itemId || itemId.length > 200) continue;
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value && Number.isFinite(value.position) && Number.isFinite(value.duration) && value.position >= 0 && value.duration >= 0) {
          progress[itemId] = { position: Math.floor(value.position), duration: Math.floor(value.duration) };
        }
      } catch { /* ignore invalid progress entry */ }
    }
    return {
      movieFavorites: readStringArray('cloudplay-movie-favorites-v1', 1200),
      tvFavorites: readStringArray('cloudplay-tv-favorites-v1', 1200),
      progress,
    };
  } catch { return null; }
}

function writeStringArray(key: string, values: string[]) {
  try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* storage optional */ }
}

export async function mergeCloudIntoLocal(userId: string): Promise<void> {
  const supabase = getSupabase();
  const local = readLocalLibrary();
  if (!supabase || !local) return;

  const { data: favorites, error: favError } = await supabase
    .from('cloudplay_favorites')
    .select('item_type,item_id')
    .eq('user_id', userId);
  if (favError) throw favError;

  const movieSet = new Set(local.movieFavorites);
  const tvSet = new Set(local.tvFavorites);
  for (const row of favorites || []) {
    if (typeof row.item_id !== 'string') continue;
    if (row.item_type === 'movie') movieSet.add(row.item_id);
    if (row.item_type === 'channel') tvSet.add(row.item_id);
  }
  writeStringArray('cloudplay-movie-favorites-v1', [...movieSet].slice(0, 1200));
  writeStringArray('cloudplay-tv-favorites-v1', [...tvSet].slice(0, 1200));

  const { data: progress, error: progressError } = await supabase
    .from('cloudplay_progress')
    .select('item_id,position_sec,duration_sec')
    .eq('user_id', userId);
  if (progressError) throw progressError;

  for (const row of progress || []) {
    if (typeof row.item_id !== 'string' || local.progress[row.item_id]) continue;
    if (!Number.isFinite(row.position_sec) || !Number.isFinite(row.duration_sec)) continue;
    try {
      localStorage.setItem(`cloudplay-progress-v1-${row.item_id}`, JSON.stringify({
        position: Math.max(0, Math.floor(row.position_sec)),
        duration: Math.max(0, Math.floor(row.duration_sec)),
      }));
    } catch { /* storage optional */ }
  }

  // Refresh mounted lists; the account provider will push the merged state.
  notifyLibraryChanged();
  notifyPrefsChanged();
}

async function syncFavorites(userId: string, itemType: 'movie' | 'channel', ids: string[]) {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: existing, error } = await supabase
    .from('cloudplay_favorites')
    .select('item_id')
    .eq('user_id', userId)
    .eq('item_type', itemType);
  if (error) throw error;

  const existingIds = new Set((existing || []).map(row => row.item_id as string));
  const nextIds = new Set(ids);
  const toAdd = ids.filter(id => !existingIds.has(id)).map(item_id => ({ user_id: userId, item_type: itemType, item_id }));
  const toRemove = [...existingIds].filter(id => !nextIds.has(id));

  if (toAdd.length) {
    const { error: upsertError } = await supabase
      .from('cloudplay_favorites')
      .upsert(toAdd, { onConflict: 'user_id,item_type,item_id' });
    if (upsertError) throw upsertError;
  }
  if (toRemove.length) {
    const { error: deleteError } = await supabase
      .from('cloudplay_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .in('item_id', toRemove);
    if (deleteError) throw deleteError;
  }
}

export async function pushLocalToCloud(userId: string): Promise<void> {
  const supabase = getSupabase();
  const local = readLocalLibrary();
  if (!supabase || !local) return;

  await syncFavorites(userId, 'movie', local.movieFavorites);
  await syncFavorites(userId, 'channel', local.tvFavorites);

  const progressRows = Object.entries(local.progress).slice(0, 1200).map(([item_id, value]) => ({
    user_id: userId,
    item_id,
    position_sec: value.position,
    duration_sec: value.duration,
    updated_at: new Date().toISOString(),
  }));

  const { data: existingProgress, error: existingError } = await supabase
    .from('cloudplay_progress')
    .select('item_id')
    .eq('user_id', userId);
  if (existingError) throw existingError;

  if (progressRows.length) {
    const { error: upsertError } = await supabase
      .from('cloudplay_progress')
      .upsert(progressRows, { onConflict: 'user_id,item_id' });
    if (upsertError) throw upsertError;
  }

  const nextProgressIds = new Set(progressRows.map(row => row.item_id));
  const toRemove = (existingProgress || [])
    .map(row => row.item_id as string)
    .filter(id => !nextProgressIds.has(id));
  if (toRemove.length) {
    const { error: deleteError } = await supabase
      .from('cloudplay_progress')
      .delete()
      .eq('user_id', userId)
      .in('item_id', toRemove);
    if (deleteError) throw deleteError;
  }
}

export async function clearCloudLibrary(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error: favError } = await supabase.from('cloudplay_favorites').delete().eq('user_id', userId);
  if (favError) throw favError;
  const { error: progressError } = await supabase.from('cloudplay_progress').delete().eq('user_id', userId);
  if (progressError) throw progressError;
}
