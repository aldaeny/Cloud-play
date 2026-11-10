import type {NextApiRequest,NextApiResponse} from 'next';
import {backendChannel} from '../../../../src/server/protected-live';
import {enforceRateLimit} from '../../../../src/server/rate-limit';
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const metrics=req.query.action==='metrics';
 if(req.method!==(metrics?'POST':'GET')){res.setHeader('Allow','GET');return res.status(405).end();}
 if(!enforceRateLimit(req,res,{bucket:metrics?'catalog':'stream'}))return;
 if(req.headers['sec-fetch-site']==='cross-site'||(metrics&&req.headers.origin!==process.env.EXTERNAL_PUBLIC_ORIGIN))return res.status(403).end();
 const token=req.cookies['__Host-cloudplay-media'];const lease=req.cookies['__Host-cloudplay-lease'];
 if(!lease||!/^[a-f0-9-]{36}$/i.test(lease)||!token||!/^[A-Za-z0-9_.-]{20,8192}$/.test(token))return res.status(401).json({error:'SIGN_IN_REQUIRED'});
 try{
  const id=backendChannel(String(req.query.id));const action=req.query.action==='manifest.mpd'?'manifest':req.query.action;
  if(action!=='manifest'&&action!=='resource'&&action!=='metrics')return res.status(404).end();
  const origin=new URL(process.env.API_INTERNAL_URL||'');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/')throw new Error();
  const target=new URL(`/external-playback/${id}/${action}`,origin);
  if(action==='resource')for(const key of ['ticket','representation','number','time']){const value=req.query[key];if(typeof value==='string'&&value.length<=16000)target.searchParams.set(key,value);}
  // Only a cryptographically verified assertion is accepted by Nest. Never
  // synthesize country/platform from browser headers or forwarding headers.
  // Browser-supplied assertions are never forwarded. Geo is established by
  // the hosting boundary on session creation/renewal.
  const range=req.headers.range;
  if(range!==undefined&&(typeof range!=='string'||range.length>100||!/^bytes=\d*-\d*$/.test(range)))return res.status(416).end();
  const upstream=await fetch(target,{method:metrics?'POST':'GET',...(metrics?{body:JSON.stringify({event:req.body?.event,value:req.body?.value})}:{}),headers:{Authorization:`Bearer ${token}`,'x-playback-session':lease,...(range?{Range:range}:{}),...(metrics?{'Content-Type':'application/json'}:{})},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!upstream.ok){const cr=upstream.headers.get('content-range');if(cr&&/^bytes \*\/\d+$/.test(cr))res.setHeader('Content-Range',cr);return res.status([401,403,404,416,429].includes(upstream.status)?upstream.status:502).json({error:'PROTECTED_PLAYBACK_UNAVAILABLE'});}
  const mime=upstream.headers.get('content-type')||'';
  const reader=upstream.body?.getReader();if(!reader)throw new Error();
  const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024)throw new Error();chunks.push(value);}}finally{await reader.cancel();}
  const bytes=Buffer.concat(chunks);res.status(upstream.status);res.setHeader('Content-Type',mime);
  for(const header of ['content-range','accept-ranges','retry-after']){const value=upstream.headers.get(header);if(value&&value.length<100)res.setHeader(header,value);}
  if(/mpegurl|dash\+xml/i.test(mime))return res.send(bytes.toString('utf8').replaceAll(`/external-playback/${id}/resource`, `/api/external/${encodeURIComponent(String(req.query.id))}/resource`));
  return res.send(bytes);
 }catch{return res.status(503).json({error:'PROTECTED_PLAYBACK_UNAVAILABLE'});}
}
