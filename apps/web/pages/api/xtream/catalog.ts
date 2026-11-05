import type { NextApiRequest, NextApiResponse } from 'next';
import { AccessError, accessStatus, requireOwner } from '../../../src/server/xtream-access';
import { isKind, listEpisodes, listGroups, listItems, PrivateError } from '../../../src/server/xtream-private';

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? '').trim();
}

/**
 * GET /api/xtream/catalog?kind=live|movie|series&view=groups|items|episodes
 * Owner-only. Returns names/ids/artwork — never provider URLs or credentials.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
  const view = one(req.query.view) || 'groups';
  if (!isKind(kind)) return res.status(400).json({ error: 'INVALID_INPUT' });

  try {
    if (view === 'groups') return res.status(200).json({ data: await listGroups(kind) });
    if (view === 'items') return res.status(200).json({ data: await listItems(kind, one(req.query.category)) });
    if (view === 'episodes') {
      if (kind !== 'series') return res.status(400).json({ error: 'INVALID_INPUT' });
      return res.status(200).json({ data: await listEpisodes(one(req.query.series)) });
    }
    return res.status(400).json({ error: 'INVALID_INPUT' });
  } catch (error) {
    const code = error instanceof PrivateError ? error.code : 'UPSTREAM_ERROR';
    const status = code === 'INVALID_INPUT' ? 400 : code === 'RATE_LIMIT' ? 429 : 503;
    return res.status(status).json({ error: code });
  }
}
