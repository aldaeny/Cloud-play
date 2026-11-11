import {openToken} from '../../../src/server/xtream-token';
import {proxySecret,providerOrigin} from '../../../src/server/xtream-private';
import {streamUrl,playlistSecret} from '../../../src/server/playlist-token';
import {parsePublicUrl} from '../../../src/server/safe-fetch';
import type {MediaBinding} from '../../../src/server/private-media-session';
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

  let media:MediaBinding|undefined;
  try {
    ({media}=await requireOwner(req,res));
  } catch (error) {
    const code = error instanceof AccessError ? error.code : 'AUTH_UNAVAILABLE';
    return res.status(accessStatus(code)).json({ error: code });
  }

  const kind = one(req.query.kind);
  const view = one(req.query.view) || 'groups';
  if (!isKind(kind)) return res.status(400).json({ error: 'INVALID_INPUT' });

  try {
    if (view === 'groups') return res.status(200).json({ data: await listGroups(kind) });
    if (view === 'items') return res.status(200).json({ data: images(await listItems(kind, one(req.query.category)),media) });
    if (view === 'episodes') {
      if (kind !== 'series') return res.status(400).json({ error: 'INVALID_INPUT' });
      return res.status(200).json({ data: images(await listEpisodes(one(req.query.series)),media) });
    }
    return res.status(400).json({ error: 'INVALID_INPUT' });
  } catch (error) {
    const code = error instanceof PrivateError ? error.code : 'UPSTREAM_ERROR';
    const status = code === 'INVALID_INPUT' ? 400 : code === 'RATE_LIMIT' ? 429 : 503;
    return res.status(status).json({ error: code });
  }
}

function images<T extends {icon?:string}>(rows:T[],binding?:MediaBinding):T[]{
 if(!binding)return rows;
 return rows.map(row=>{let icon:string|undefined;
  try{if(row.icon){let target:URL;if(row.icon.startsWith('/api/xtream/stream?t=')){const g=openToken(decodeURIComponent(row.icon.split('?t=')[1]),proxySecret());target=parsePublicUrl(new URL(g.path,providerOrigin()).href);}else target=parsePublicUrl(row.icon);
   icon=streamUrl({origin:target.origin,path:target.pathname+target.search,binding,expiresAt:binding.expiresAt},playlistSecret(),120000);
  }}catch{/* Invalid/private artwork is not fetched or leaked. */}
  return {...row,icon};
 });
}
