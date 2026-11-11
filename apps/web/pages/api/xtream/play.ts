import type { NextApiRequest, NextApiResponse } from 'next';
import { AccessError, accessStatus, requireOwner } from '../../../src/server/xtream-access';
import { isKind, playbackToken, PrivateError } from '../../../src/server/xtream-private';

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? '').trim();
}

/**
 * GET /api/xtream/play?kind=live|movie|series&id=123&ext=mp4
 * Owner-only. Mints a short-lived proxy URL. The Xtream credentials stay inside
 * the encrypted token and are never sent to the browser in the clear.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Legacy bearer capabilities are not live Auth/Geo-session authorization.
  // Never allow this alternate private delivery path to bypass the protected
  // backend lease boundary in production. Management/catalog remain intact.
  if(process.env.NODE_ENV==='production'){
    res.setHeader('Cache-Control','private, no-store');
    return res.status(503).json({error:'SESSION_BOUND_XTREAM_REQUIRED'});
  }

  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    await requireOwner(req);
  } catch (error) {
    const code = error instanceof AccessError ? error.code : 'AUTH_UNAVAILABLE';
    return res.status(accessStatus(code)).json({ error: code });
  }

  const kind = one(req.query.kind);
  const id = one(req.query.id);
  if (!isKind(kind) || !/^\d{1,18}$/.test(id)) return res.status(400).json({ error: 'INVALID_INPUT' });

  try {
    const { token, container } = playbackToken(kind, id, one(req.query.ext));
    return res.status(200).json({
      url: `/api/xtream/stream?t=${encodeURIComponent(token)}`,
      kind,
      container,
      hls: container === 'm3u8',
    });
  } catch (error) {
    const code = error instanceof PrivateError ? error.code : 'UPSTREAM_ERROR';
    const status = code === 'INVALID_INPUT' ? 400 : 503;
    return res.status(status).json({ error: code });
  }
}
