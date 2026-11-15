import type { NextApiRequest, NextApiResponse } from 'next';
import { enforceRateLimit } from '../../../src/server/rate-limit';

/**
 * GET /api/tmdb/enrich?title=&year=&kind=movie|series
 *
 * Display enrichment only — localized (Arabic when available) title, overview
 * and poster from TMDB metadata. It is never a playback source. Requires
 * TMDB_API_KEY in the environment (a v3 key or a v4 read token); without it
 * the endpoint reports { configured: false } and the UI keeps the source's
 * own metadata.
 */

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const key = (process.env.TMDB_API_KEY ?? '').trim();
  if (!key) return res.status(200).json({ configured: false });

  const title = first(req.query.title).trim().slice(0, 120);
  if (!title) return res.status(400).json({ error: 'INVALID_QUERY' });
  const year = first(req.query.year).replace(/\D/g, '').slice(0, 4);
  const kind = first(req.query.kind) === 'series' ? 'tv' : 'movie';

  const headers: Record<string, string> = { Accept: 'application/json' };
  let url = `https://api.themoviedb.org/3/search/${kind}?query=${encodeURIComponent(title)}`;
  if (year) url += kind === 'tv' ? `&first_air_date_year=${year}` : `&year=${year}`;
  url += '&language=ar';
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url += `&api_key=${encodeURIComponent(key)}`;

  type TmdbHit = { title?: string; name?: string; overview?: string | null; poster_path?: string | null };
  const grab = async (target: string): Promise<{ results?: TmdbHit[] }> => {
    const response = await fetch(target, { headers });
    if (!response.ok) throw new Error('tmdb status');
    return (await response.json()) as { results?: TmdbHit[] };
  };

  try {
    const localized = await grab(url);
    const hit = Array.isArray(localized.results) ? localized.results[0] : undefined;
    if (!hit) return res.status(200).json({ configured: true, found: false });
    const name = hit.title ?? hit.name ?? title;
    let overview = hit.overview ?? '';
    if (!overview) {
      try {
        const english = await grab(url.replace('&language=ar', '&language=en-US'));
        const alt = Array.isArray(english.results) ? english.results[0] : undefined;
        if (alt) overview = alt.overview ?? '';
      } catch { /* The localized answer stands on its own. */ }
    }
    res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000');
    return res.status(200).json({
      configured: true,
      found: true,
      name,
      overview: overview.slice(0, 600),
      poster: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : '',
    });
  } catch {
    return res.status(200).json({ configured: true, found: false });
  }
}
