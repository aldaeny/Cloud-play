import type {NextApiRequest,NextApiResponse} from 'next';
import {backendChannel} from '../../../src/server/protected-live';
import {signHostingGeo} from '../../../src/server/playback-geo';
import {enforceRateLimit} from '../../../src/server/rate-limit';
const COOKIE='__Host-cloudplay-media',LEASE='__Host-cloudplay-lease';
function cookie(name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;}
export default async function handler(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store');
 if(!['POST','PUT','DELETE'].includes(req.method||'')){res.setHeader('Allow','POST, PUT, DELETE');return res.status(405).end();}
 // Explicit server configuration, not a client-controlled Host/Forwarded value.
 const publicOrigin=process.env.EXTERNAL_PUBLIC_ORIGIN;
 try{const configured=new URL(publicOrigin||'');if(configured.protocol!=='https:'||configured.origin!==publicOrigin)throw new Error();}catch{return res.status(503).end();}
 if(req.headers.origin!==publicOrigin)return res.status(403).end();
 if(!enforceRateLimit(req,res,{bucket:'catalog'}))return;
 const token=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/)?.[1] || (req.method==='DELETE'?req.cookies[COOKIE]:undefined);
 if(!token||token.split('.').length!==3)return res.status(401).end();
 try{
  const origin=new URL(process.env.API_INTERNAL_URL||'');
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.hash||origin.search)throw new Error();
  const id=backendChannel(typeof req.body?.channelId==='string'?req.body.channelId:'');
  const session=req.cookies[LEASE];
  const geo=req.method==='DELETE'?undefined:signHostingGeo(req,id,token);
  const upstream=await fetch(new URL(`/external-playback/${id}/session`,origin),{method:req.method,headers:{Authorization:`Bearer ${token}`,...(geo?{'x-external-geo':geo}:{}),...(session?{'x-playback-session':session}:{})},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!upstream.ok){
   if(req.method==='DELETE')res.setHeader('Set-Cookie',[cookie(COOKIE,'',0),cookie(LEASE,'',0)]);
   return res.status([401,403,404,429].includes(upstream.status)?upstream.status:503).json({error:'PLAYBACK_SESSION_UNAVAILABLE'});
  }
  if(req.method==='DELETE'){res.setHeader('Set-Cookie',[cookie(COOKIE,'',0),cookie(LEASE,'',0)]);return res.status(204).end();}
  const data=await upstream.json();if(typeof data.id!=='string'||!/^[a-f0-9-]{36}$/i.test(data.id))throw new Error();
  res.setHeader('Set-Cookie',[cookie(COOKIE,token,120),cookie(LEASE,data.id,120)]);
  return res.status(200).json({expiresAt:data.expiresAt});
 }catch{return res.status(503).json({error:'PLAYBACK_SESSION_UNAVAILABLE'});}
}
