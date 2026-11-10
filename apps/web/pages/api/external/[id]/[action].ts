import type {NextApiRequest,NextApiResponse} from 'next';
import {backendChannel} from '../../../../src/server/protected-live';
import {enforceRateLimit} from '../../../../src/server/rate-limit';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 if(!enforceRateLimit(req,res,{bucket:'catalog'}))return;
 if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).end();
 const token=req.cookies['__Host-cloudplay-media'];
 if(!token||!/^[A-Za-z0-9_.-]{20,8192}$/.test(token))return res.status(401).json({error:'SIGN_IN_REQUIRED'});
 try{
  const id=backendChannel(String(req.query.id));const action=req.query.action;
  if(action!=='manifest'&&action!=='resource')return res.status(404).end();
  const origin=new URL(process.env.API_INTERNAL_URL||'');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error();
  const target=new URL(`/external-playback/${id}/${action}`,origin);
  if(action==='resource')for(const key of ['ticket','representation','number','time']){const value=req.query[key];if(typeof value==='string'&&value.length<=16000)target.searchParams.set(key,value);}
  // Only a cryptographically verified assertion is accepted by Nest. Never
  // synthesize country/platform from browser headers or forwarding headers.
  const context=req.headers['x-external-context'];
  const upstream=await fetch(target,{headers:{Authorization:`Bearer ${token}`,...(typeof context==='string'&&context.length<=2000?{'x-external-context':context}:{})},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!upstream.ok)return res.status([401,403,429].includes(upstream.status)?upstream.status:502).json({error:'PROTECTED_PLAYBACK_UNAVAILABLE'});
  const mime=upstream.headers.get('content-type')||'';
  const reader=upstream.body?.getReader();if(!reader)throw new Error();
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new Error();chunks.push(value);}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks);res.setHeader('Content-Type',mime);
  if(/mpegurl|dash\+xml/i.test(mime))return res.send(bytes.toString('utf8').replaceAll(`/external-playback/${id}/resource`, `/api/external/${encodeURIComponent(String(req.query.id))}/resource`));
  return res.send(bytes);
 }catch{return res.status(503).json({error:'PROTECTED_PLAYBACK_UNAVAILABLE'});}
}
