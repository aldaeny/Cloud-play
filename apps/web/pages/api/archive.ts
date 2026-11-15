import { publicFetch } from '../../src/server/public-fetch';
import type { NextApiRequest, NextApiResponse } from 'next';
import { enforceRateLimit } from '../../src/server/rate-limit';

/**
 * GET /api/archive?q=&page=      → feature-film catalogue from Internet Archive
 * GET /api/archive?id=<identifier> → one film's direct MP4 URL and metadata
 *
 * Internet Archive hosts public-domain and freely licensed films, served by
 * their own CDN. Both calls run server-side so the browser never talks to a
 * third-party API directly, responses are CDN-cacheable, and no credentials
 * are involved. The `id` branch validates the identifier shape before use.
 */

const SEARCH_URL = 'https://archive.org/advancedsearch.php';
const TIMEOUT_MS = 12_000;

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function asText(value: unknown): string {
  const single = first(value);
  if (typeof single === 'string') return single;
  if (typeof single === 'number') return String(single);
  return '';
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await publicFetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('upstream status');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

type ArchiveDoc = { identifier?: string | string[]; title?: unknown; year?: unknown };

function toRow(doc: ArchiveDoc) {
  const id = String(first(doc.identifier) ?? '');
  return {
    id,
    title: asText(doc.title) || id,
    year: asText(doc.year),
    poster: `https://archive.org/services/img/${encodeURIComponent(id)}`,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const id = first(req.query.id) === undefined ? '' : String(first(req.query.id)).trim();
  if (id) {
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/i.test(id)) return res.status(400).json({ error: 'INVALID_ID' });
    try {
      const meta = await fetchJson(`https://archive.org/metadata/${encodeURIComponent(id)}`) as {
        files?: { name: string; format?: string; size?: string | number }[];
        metadata?: { title?: unknown; year?: unknown; description?: unknown };
      };
      const files = Array.isArray(meta.files) ? meta.files : [];
      const mp4s = files
        .filter(file => /\.(mp4|m4v)$/i.test(file.name) && !/sample|trailer/i.test(file.name))
        .sort((a, b) => Number(b.size ?? 0) - Number(a.size ?? 0));
      const best = mp4s[0];
      if (!best) return res.status(404).json({ error: 'NO_PLAYABLE_FILE' });
      const description = asText(meta.metadata?.description)
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      return res.status(200).json({
        id,
        title: asText(meta.metadata?.title) || id,
        year: asText(meta.metadata?.year),
        description,
        url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(best.name)}`,
        poster: `https://archive.org/services/img/${encodeURIComponent(id)}`,
      });
    } catch {
      return res.status(503).json({ error: 'SOURCE_UNAVAILABLE' });
    }
  }

  const q = (first(req.query.q) === undefined ? '' : String(first(req.query.q))).trim().slice(0, 120);
  const rawPage = Number(first(req.query.page) ?? '1');
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(Math.floor(rawPage), 50) : 1;
  const term = q ? ` AND (${q})` : '';
  const url = `${SEARCH_URL}?q=${encodeURIComponent(`collection:(feature_films) AND mediatype:(movies)${term}`)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=downloads&sort%5B%5D=-downloads&rows=40&page=${page}&output=json`;
  try {
    const body = await fetchJson(url) as { response?: { numFound?: number; docs?: ArchiveDoc[] } };
    const docs = Array.isArray(body.response?.docs) ? body.response.docs : [];
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      data: docs.map(toRow).filter(row => row.id),
      total: Number(body.response?.numFound) || docs.length,
      page,
    });
  } catch {
    return res.status(503).json({ error: 'SOURCE_UNAVAILABLE' });
  }
}
