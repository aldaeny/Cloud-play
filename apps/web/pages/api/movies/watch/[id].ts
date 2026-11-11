import { publicFetch } from '../../../../src/server/public-fetch';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicFilm } from '../../../../src/server/public-films';
import { enforceRateLimit } from '../../../../src/server/rate-limit';

/**
 * GET /api/movies/watch/<film-id>
 *
 * Public, no auth. Resolves an Internet Archive item to its best browser-playable
 * MP4 and 302-redirects the <video> element straight to archive.org, so the film
 * bytes never pass through this app (no bandwidth cost, no re-hosting).
 *
 * Why resolve at runtime instead of hardcoding filenames: Archive uploads use
 * inconsistent names (`<id>.mp4`, `Title_512kb.mp4`, `Title.ia.mp4`) and items get
 * re-derived. Reading the item's own metadata keeps every card playable and lets
 * us refuse dark/removed items instead of showing a broken player.
 */

type ArchiveFile = { name?: unknown; format?: unknown; size?: unknown };
type ArchiveMetadata = { is_dark?: unknown; files?: unknown };

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const resolved = new Map<string, { location: string; expires: number }>();

/** Rank a derivative by how reliably a browser can play it. -1 = unusable. */
function scoreFile(file: ArchiveFile): number {
  if (typeof file.name !== 'string') return -1;
  const name = file.name.toLowerCase();
  // Thumbnails and other nested artefacts are never the feature.
  if (name.includes('/') || !name.endsWith('.mp4')) return -1;
  const format = typeof file.format === 'string' ? file.format.toLowerCase() : '';
  const lowBitrate = name.includes('512kb');
  if (format === 'h.264') return lowBitrate ? 200 : 400;
  if (format === 'h.264 ia') return lowBitrate ? 190 : 380;
  if (format.includes('h.264')) return lowBitrate ? 180 : 350;
  if (lowBitrate) return 170;
  if (format.includes('mpeg4')) return 150;
  return 100;
}

function pickPlayableFile(files: unknown): string | null {
  if (!Array.isArray(files)) return null;
  let best: { name: string; score: number; size: number } | null = null;
  for (const entry of files as ArchiveFile[]) {
    if (!entry || typeof entry !== 'object') continue;
    const score = scoreFile(entry);
    if (score < 0) continue;
    const size = Number(entry.size);
    const bytes = Number.isFinite(size) ? size : 0;
    const name = entry.name as string;
    if (!best || score > best.score || (score === best.score && bytes > best.size)) {
      best = { name, score, size: bytes };
    }
  }
  return best?.name ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'catalog' })) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  const film = getPublicFilm(id);
  if (!film) return res.status(404).json({ error: 'FILM_NOT_FOUND' });

  const cached = resolved.get(film.id);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.redirect(302, cached.location);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await publicFetch(
      `https://archive.org/metadata/${encodeURIComponent(film.archiveId)}`,
      { signal: controller.signal, redirect: 'follow', headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return res.status(502).json({ error: 'SOURCE_UNREACHABLE' });
    const metadata = (await response.json()) as ArchiveMetadata;
    // Dark items are withdrawn/flagged: never send a visitor to them.
    if (!metadata || metadata.is_dark === true) {
      return res.status(410).json({ error: 'FILM_UNAVAILABLE' });
    }
    const name = pickPlayableFile(metadata.files);
    if (!name) return res.status(404).json({ error: 'NO_PLAYABLE_FILE' });

    const location = `https://archive.org/download/${encodeURIComponent(film.archiveId)}/${encodeURIComponent(name)}`;
    resolved.set(film.id, { location, expires: Date.now() + CACHE_TTL_MS });
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.redirect(302, location);
  } catch {
    return res.status(502).json({ error: 'SOURCE_UNREACHABLE' });
  } finally {
    clearTimeout(timer);
  }
}
