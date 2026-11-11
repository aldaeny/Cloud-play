import type {NextApiRequest,NextApiResponse} from 'next';
import {Readable} from 'node:stream';
import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web';
import {authorizeMedia,assertMediaBinding,mediaFailure,MediaAccessError,type MediaBinding} from './private-media-session';
import {parsePublicUrl,safeFetch,readCapped} from './safe-fetch';
import {enforceRateLimit} from './rate-limit';
export type BoundGrant={origin:string;path:string;expiresAt:number;binding?:MediaBinding;referrer?:string;userAgent?:string;role?:'key';purpose?:'selection';source?:string;depth?:number};
export type BoundCodec={open(token:string):BoundGrant;seal(grant:BoundGrant):string;route:string};
/** Restricted HLS URI grammar. No unknown URL-bearing extension is passed to
 * browsers; AES-128 identity keys are proxied just like segments. No DRM bypass. */
export function rewriteBoundHls(text:string,base:URL,grant:BoundGrant,codec:BoundCodec):string{
 if(!text.trimStart().startsWith('#EXTM3U')||text.length>2*1024*1024)throw new Error('INVALID_MANIFEST');
 let references=0;
 if(!Number.isInteger(grant.depth??0)||(grant.depth??0)>8)throw new Error('MANIFEST_DEPTH_LIMIT');
 const ref=(value:string,role?:'key')=>{
  if(++references>4000||value.includes('{$')||/[\u0000-\u0020\\]/.test(value))throw new Error('INVALID_REFERENCE');
  const target=parsePublicUrl(new URL(value,base).href);
  if(target.origin!==grant.origin)throw new Error('OFF_ORIGIN_REFERENCE');
  return `${codec.route}?t=${encodeURIComponent(codec.seal({...grant,path:target.pathname+target.search,role,depth:(grant.depth??0)+1}))}`;
 };
 return text.split(/\r?\n/).map(line=>{
  const value=line.trim();if(!value)return '';
  if(!value.startsWith('#'))return ref(value);
  if(!value.startsWith('#EXT'))return ''; // provider comments may contain secrets
  if(/^#EXT-X-(DEFINE|CONTENT-STEERING|SESSION-DATA):/i.test(value))throw new Error('UNSUPPORTED_MANIFEST');
  const uriCount=(value.match(/\bURI\s*=/gi)||[]).length;
  if(uriCount>1)throw new Error('AMBIGUOUS_REFERENCE');
  const key=/^#EXT-X-(?:SESSION-)?KEY:/i.test(value);
  if(key&&value!=='#EXT-X-KEY:METHOD=NONE'){
   if((value.match(/\bMETHOD=/g)||[]).length!==1)throw new Error('AMBIGUOUS_KEY');
   if(!/^#EXT-X-(?:SESSION-)?KEY:METHOD=AES-128,/.test(value)||!/\bURI="[^"]+"/.test(value)||/KEYFORMAT(?!="identity"(?:,|$))/.test(value)||/KEYFORMATVERSIONS/.test(value))throw new Error('UNSUPPORTED_KEY');
  }
  // Ambiguous, unquoted, duplicated or unfamiliar URI attributes fail closed.
  if(/(?:^|[, :])(?:[A-Z-]*URI)\s*=/i.test(value)&&!/(?:^|,)URI="[^"]+"/.test(value.replace(/^#[^:]+:/,'')))throw new Error('INVALID_REFERENCE');
  if(uriCount!==(value.match(/URI="[^"]+"/g)||[]).length)throw new Error('INVALID_REFERENCE');
  const rewritten=value.replace(/URI="([^"]*)"/g,(_m,uri:string)=>`URI="${ref(uri,key?'key':undefined)}"`);
  // Do not return provider origins/credentials via metadata, nested attributes
  // or HLS extension tags the proxy does not understand.
  if(/https?:\/\/|\{\$|URI\s*=\s*[^"\s]/i.test(rewritten))throw new Error('UNSUPPORTED_MANIFEST');
  return rewritten;
 }).join('\n');
}
export async function boundMediaProxy(req:NextApiRequest,res:NextApiResponse,codec:BoundCodec){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).end();}
 if(!enforceRateLimit(req,res,{bucket:'stream'}))return;
 let grant:BoundGrant;
 try{
  const current=await authorizeMedia(req);
  if(typeof req.query.t!=='string')throw new MediaAccessError(403,'BAD_TOKEN');
  try{grant=codec.open(req.query.t);}catch{throw new MediaAccessError(403,'BAD_TOKEN');}
  assertMediaBinding(grant.binding,current);
  if(!Number.isInteger(grant.depth??0)||(grant.depth??0)>8)throw new MediaAccessError(403,'MEDIA_DEPTH_LIMIT');
  if(grant.purpose)throw new MediaAccessError(403,'SELECTION_NOT_MEDIA');
  if(grant.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_TOKEN');
 }catch(error){return mediaFailure(res,error);}
 let target:URL;
 try{target=parsePublicUrl(new URL(grant.path,grant.origin).href);if(target.origin!==grant.origin)throw new Error();}catch{return res.status(403).json({error:'BAD_TOKEN'});}
 const range=req.headers.range;
 if(range!==undefined&&(typeof range!=='string'||range.length>100||!/^bytes=\d*-\d*$/.test(range)))return res.status(416).end();
 let response:Response,url:URL;
 const controller=new AbortController();const close=()=>controller.abort();req.once('aborted',close);res.once('close',close);
 try{
  ({response,url}=await safeFetch(target.href,{method:req.method==='HEAD'?'HEAD':'GET',headers:{...(range?{Range:range}:{}),...(grant.referrer?{Referer:grant.referrer}:{}),...(grant.userAgent?{'User-Agent':grant.userAgent}:{})},pinOrigin:true,maxRedirects:3,timeoutMs:25000,maxBytes:grant.role==='key'?16:64*1024*1024,signal:controller.signal,acceptStatus:true}));
 }catch{return res.status(502).json({error:'UPSTREAM_UNREACHABLE'});}
 if(!response.ok&&response.status!==206){await response.body?.cancel().catch(()=>{});return res.status(502).json({error:'UPSTREAM_ERROR'});}
 const type=response.headers.get('content-type')||'';
 try{
  if(req.method==='HEAD'){
   assertMediaBinding(grant.binding,await authorizeMedia(req));
   if(grant.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_TOKEN');
   await response.body?.cancel().catch(()=>{});if(type)res.setHeader('Content-Type',type);return res.status(response.status).end();
  }
  if(/mpegurl/i.test(type)||/\.m3u8?$/i.test(url.pathname)){
   const text=await readCapped(response,2*1024*1024);
   const body=rewriteBoundHls(text,url,grant,codec);
   assertMediaBinding(grant.binding,await authorizeMedia(req));
   if(grant.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_TOKEN');
   res.setHeader('Content-Type','application/vnd.apple.mpegurl; charset=utf-8');
   return res.status(200).send(body);
  }
  if(grant.role==='key'){
   const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length!==16)throw new Error('INVALID_KEY');
   assertMediaBinding(grant.binding,await authorizeMedia(req));
   if(grant.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_TOKEN');
   res.setHeader('Content-Type','application/octet-stream');return res.status(200).send(bytes);
  }
  // Recheck after headers: revocation during an upstream wait is not ignored.
  assertMediaBinding(grant.binding,await authorizeMedia(req));
  if(grant.expiresAt<=Date.now())throw new MediaAccessError(403,'BAD_TOKEN');
 }catch(error){await response.body?.cancel().catch(()=>{});return error instanceof MediaAccessError?mediaFailure(res,error):res.status(502).json({error:'INVALID_MEDIA'});}
 res.status(response.status);if(type)res.setHeader('Content-Type',type);
 for(const h of ['content-length','content-range','accept-ranges']){const value=response.headers.get(h);if(value)res.setHeader(h,value);}
 if(!response.body)return res.end();
 const stream=Readable.fromWeb(response.body as unknown as NodeWebReadableStream);
 const expiry=setTimeout(()=>{controller.abort();stream.destroy();res.destroy();},Math.max(1,grant.expiresAt-Date.now()));expiry.unref?.();
 stream.on('error',()=>res.destroy());res.once('close',()=>{clearTimeout(expiry);stream.destroy();});stream.pipe(res);
}
