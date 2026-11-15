import { publicFetch } from '../../../src/server/public-fetch';
import { enforceRateLimit } from '../../../src/server/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * GET /api/movies/archive?search=&page=
 *
 * Public-domain feature films from Internet Archive's public search API.
 * The upstream query is FIXED (collection:feature_films); the visitor can only
 * add an encoded title filter and a page number, so this endpoint can never be
 * turned into an arbitrary upstream fetch. No credentials, no keys — the
 * Internet Archive search API and file hosting are public.
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_BYTES = 4 * 1024 * 1024;
const PAGE_SIZE = 60;
const MAX_PAGE = 50;

type ArchiveDoc = { identifier?: unknown; title?: unknown; year?: unknown; description?: unknown };
type CacheEntry = { at: number; body: unknown };

const cache = new Map<string, CacheEntry>();

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Archive.org returns scalar OR array fields depending on the record. */
function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const firstString = value.find(item => typeof item === 'string');
    return typeof firstString === 'string' ? firstString : '';
  }
  return '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  if (!enforceRateLimit(req, res, { bucket: 'public' })) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const rawSearch = first(req.query.search).trim().slice(0, 80);
  // Letters, numbers, spaces, apostrophes and dashes only — no query operators.
  const search = rawSearch.replace(/[^\p{L}\p{N} '’-]/gu, '').trim();
  const rawPage = Number(first(req.query.page)) || 1;
  const page = Math.min(Math.max(Math.floor(rawPage), 1), MAX_PAGE);

  const cacheKey = `${search}|${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return res.status(200).json(cached.body);

  const queryParts = ['collection:feature_films'];
  if (search) queryParts.push(`title:("${search}")`);
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(queryParts.join(' AND '))}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=description&sort=-downloads&rows=${PAGE_SIZE}&page=${page}&output=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await publicFetch(url, { signal: controller.signal, redirect: 'follow', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('upstream status');
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error('upstream too large');
    const body = JSON.parse(text) as { response?: { numFound?: unknown; docs?: unknown } };
    const docs = Array.isArray(body.response?.docs) ? (body.response.docs as ArchiveDoc[]) : [];
    const numFound = typeof body.response?.numFound === 'number' ? body.response.numFound : docs.length;

    const data = docs.flatMap(doc => {
      const id = typeof doc.identifier === 'string' ? doc.identifier : '';
      if (!/^[A-Za-z0-9._-]+$/.test(id)) return [];
      const title = asText(doc.title).trim() || id;
      const yearValue = typeof doc.year === 'number' ? doc.year : Number.parseInt(String(doc.year ?? ''), 10);
      const description = asText(doc.description).replace(/\s+/g, ' ').trim().slice(0, 300);
      return [{
        id,
        title,
        year: Number.isFinite(yearValue) ? yearValue : null,
        description,
        thumb: `https://archive.org/services/img/${id}`,
        embed: `https://archive.org/embed/${id}`,
        details: `https://archive.org/details/${id}`,
      }];
    });

    const payload = { data, total: numFound, page, pageSize: PAGE_SIZE, source: 'https://archive.org/details/feature_films' };
    if (cache.size > 120) cache.clear();
    cache.set(cacheKey, { at: Date.now(), body: payload });
    return res.status(200).json(payload);
  } catch {
    return res.status(503).json({ error: 'SOURCE_UNAVAILABLE' });
  } finally {
    clearTimeout(timer);
  }
}
