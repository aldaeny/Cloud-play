import type { NextApiRequest, NextApiResponse } from 'next';
import { AccessError, accessStatus, requireOwner } from '../../../src/server/xtream-access';
import { importPlaylist, PlaylistError } from '../../../src/server/playlist-import';

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } };

/**
 * POST /api/playlist/import  { url }
 *
 * Owner-only. Fetches an M3U playlist the owner supplies, parses it, and returns
 * channels whose playback URLs are same-origin sealed tokens.
 *
 * POST rather than GET on purpose: playlist URLs frequently embed a username and
 * password in the query string, and a GET would copy those into browser history,
 * proxy logs and access logs. A request body does not.
 *
 * The response never echoes the playlist URL or any raw stream URL.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let owner: Awaited<ReturnType<typeof requireOwner>>;
  try {
    owner = await requireOwner(req,res);
  } catch (error) {
    const code = error instanceof AccessError ? error.code : 'AUTH_UNAVAILABLE';
    return res.status(accessStatus(code)).json({ error: code });
  }

  const body = (req.body ?? {}) as { url?: unknown };
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || url.length > 4096) return res.status(400).json({ error: 'INVALID_URL' });

  try {
    const result = await importPlaylist(url, owner.userId, owner.media);
    return res.status(200).json({ data: result });
  } catch (error) {
    const code = error instanceof PlaylistError ? error.code : 'UPSTREAM_ERROR';
    const status =
      code === 'INVALID_URL' ? 400
        : code === 'RATE_LIMIT' ? 429
          : code === 'NOT_A_PLAYLIST' || code === 'EMPTY_PLAYLIST' || code === 'TOO_LARGE' ? 422
            : 503;
    return res.status(status).json({ error: code });
  }
}
