import type { NextApiRequest, NextApiResponse } from 'next';
import { signHostingGeo, apiGeoHeaders } from '../../../src/server/playback-geo';
import { enforceRateLimit } from '../../../src/server/rate-limit';
const COOKIE='__Host-cloudplay-vod';
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const action=req.query.action;
  const expected=action==='session'||action==='end'||action==='heartbeat'?'POST':action==='catalog'||action==='profiles'||action==='devices'||action==='media'?'GET':null;
  if(!expected)return res.status(404).end();
  if(req.method!==expected){res.setHeader('Allow',expected);return res.status(405).end();}
  let publicOrigin:URL;
  try{publicOrigin=new URL(process.env.VOD_PUBLIC_ORIGIN||'');if(publicOrigin.protocol!=='https:'||publicOrigin.origin!==process.env.VOD_PUBLIC_ORIGIN)throw new Error();}catch{return res.status(503).json({error:'VOD_PUBLIC_ORIGIN_NOT_CONFIGURED'});}
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==publicOrigin.origin)||(expected==='POST'&&req.headers.origin!==publicOrigin.origin))return res.status(403).end();
  if(!enforceRateLimit(req,res,{bucket:action==='media'?'stream':'catalog'}))return;
  const token=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/)?.[1]||(action==='media'||action==='end'?req.cookies[COOKIE]:undefined);
  if(!token||!/^[A-Za-z0-9_.-]{20,4096}$/.test(token)||token.split('.').length!==3)return res.status(401).json({error:'SIGN_IN_REQUIRED'});
  try{
    const origin=new URL(process.env.API_INTERNAL_URL||'');
    if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error();
    let path:string,body:unknown,scope:string|undefined;
    if(action==='catalog')path='/search';
    else if(action==='profiles')path='/profiles';
    else if(action==='devices')path='/playback/devices';
    else if(action==='session'){
      const b=req.body;
      if(!uuid(b?.titleId)||!uuid(b?.profileId)||!uuid(b?.deviceId)||(b.episodeId!==undefined&&!uuid(b.episodeId)))return res.status(400).end();
      path='/playback/sessions';scope=`vod:${b.titleId}`;
      body={titleId:b.titleId,profileId:b.profileId,deviceId:b.deviceId,...(b.episodeId?{episodeId:b.episodeId}:{})};
    }else if(action==='end'||action==='heartbeat'){
      if(!uuid(req.body?.sessionId))return res.status(400).end();
      path=`/playback/sessions/${req.body.sessionId}/${action}`;
    }else{
      const {session,title,resource,expires,signature}=req.query;
      if(!uuid(session)||!uuid(title)||typeof resource!=='string'||!/^[-A-Za-z0-9_]{1,1024}$/.test(resource)||typeof expires!=='string'||!/^\d{13}$/.test(expires)||typeof signature!=='string'||!/^[-A-Za-z0-9_]{43}$/.test(signature))return res.status(400).end();
      const search=new URLSearchParams({resource,expires,signature});
      path=`/playback/sessions/${session}/media?${search}`;scope=`vod:${title}`;
    }
    const upstream=await fetch(new URL(path,origin),{method:expected,headers:{Authorization:`Bearer ${token}`,...apiGeoHeaders(req,expected,path,token),...(scope?{'x-external-geo':signHostingGeo(req,scope,token)}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
    if(!upstream.ok)return res.status([400,401,403,404,409,429].includes(upstream.status)?upstream.status:503).json({error:'VOD_REQUEST_DENIED'});
    const reader=upstream.body?.getReader();if(!reader)throw new Error();
    let size=0;const chunks:Uint8Array[]=[];
    try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>(action==='media'?16*1024*1024:1024*1024))throw new Error();chunks.push(value);}}finally{await reader.cancel();}
    const bytes=Buffer.concat(chunks);
    if(action==='media'){
      const type=upstream.headers.get('content-type')||'';
      if(!/^(application\/vnd\.apple\.mpegurl|video\/mp2t|video\/mp4|text\/vtt|audio\/aac)(;|$)/i.test(type))throw new Error();
      res.setHeader('Content-Type',type);
      if(/mpegurl/i.test(type))return res.status(200).send(bytes.toString('utf8').replaceAll(`/playback/sessions/${req.query.session}/media?`,`/api/vod/media?session=${req.query.session}&title=${req.query.title}&`));
      return res.status(200).send(bytes);
    }
    const data=JSON.parse(bytes.toString('utf8'));
    if(action==='session'){
      if(!uuid(data.sessionId)||typeof data.manifestUrl!=='string'||!data.manifestUrl.startsWith(`/playback/sessions/${data.sessionId}/media?`))throw new Error();
      res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`);
      return res.status(200).json({sessionId:data.sessionId,url:data.manifestUrl.replace(`/playback/sessions/${data.sessionId}/media?`,`/api/vod/media?session=${data.sessionId}&title=${req.body.titleId}&`),expiresAt:data.expiresAt,resumeAtSec:data.resumeAtSec});
    }
    if(action==='heartbeat')res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`);
    return res.status(200).json(data);
  }catch{return res.status(503).json({error:'VOD_AUTHORITY_OR_TRUSTED_INGRESS_UNAVAILABLE'});}
}
