import type {NextApiRequest,NextApiResponse} from 'next';
import {authorizeMedia,assertMediaBinding,setMediaCookie,mediaFailure,MediaAccessError,MEDIA_TTL_MS} from '../../../src/server/private-media-session';
import {openStream,sealStream,playlistSecret} from '../../../src/server/playlist-token';
import {openToken,sealPath} from '../../../src/server/xtream-token';
import {providerOrigin,providerFingerprint,proxySecret} from '../../../src/server/xtream-private';
import {enforceRateLimit} from '../../../src/server/rate-limit';
export const config={api:{bodyParser:{sizeLimit:'16kb'}}};
/** A selection descriptor is NOT playable and never renews its absolute cap.
 * Exchange requires a verified, live, same-user/session/IP/country Auth bearer.
 * Child resources expire with this short media grant, not a new rolling TTL. */
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
 if(!enforceRateLimit(req,res,{bucket:'catalog'}))return;
 try{
  const current=await authorizeMedia(req,false);
  const value=req.body?.url;
  if(typeof value!=='string'||value.length>12000||!/^\/api\/(playlist|xtream)\/stream\?t=[A-Za-z0-9_-]+&session=1$/.test(value))throw new MediaAccessError(403,'BAD_SELECTION');
  const target=new URL(value,'https://selection.invalid');const t=target.searchParams.get('t')!;
  const playlist=target.pathname==='/api/playlist/stream';
  const g=playlist?openStream(t,playlistSecret()):openToken(t,proxySecret());
  assertMediaBinding(g.binding,current);
  if(g.purpose!=='selection'||g.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_SELECTION');
  if(!playlist&&(('origin' in g?g.origin:undefined)!==providerOrigin()||!('source' in g)||g.source!==providerFingerprint()))throw new MediaAccessError(403,'SOURCE_CHANGED');
  const expiresAt=Math.min(Date.now()+MEDIA_TTL_MS,g.expiresAt,current.expiresAt,g.binding!.expiresAt);
  const media=playlist?sealStream({...g as ReturnType<typeof openStream>,purpose:undefined,expiresAt},playlistSecret(),expiresAt-Date.now()):sealPath(g.path,proxySecret(),expiresAt-Date.now(),expiresAt,g.binding,providerOrigin(),undefined,undefined,providerFingerprint());
  setMediaCookie(req,res,current);
  return res.status(200).json({url:`${target.pathname}?t=${encodeURIComponent(media)}`,expiresAt});
 }catch(error){return mediaFailure(res,error instanceof MediaAccessError?error:new MediaAccessError(403,'BAD_SELECTION'));}
}
