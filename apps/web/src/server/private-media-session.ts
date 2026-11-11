import type {NextApiRequest,NextApiResponse} from 'next';
import {signHostingGeo} from './playback-geo';
export type MediaBinding={userId:string;sessionId:string;country:string;ipHash:string;expiresAt:number};
export const PRIVATE_COOKIE='__Host-cloudplay-private';
export const MEDIA_TTL_MS=120000;
export class MediaAccessError extends Error{
 constructor(public readonly status:number,public readonly code:string){super(code);}
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function mediaToken(req:NextApiRequest,allowCookie=true):string{
 const auth=req.headers.authorization;
 const token=typeof auth==='string'?auth.match(/^Bearer ([A-Za-z0-9_.-]{20,4096})$/i)?.[1]:undefined;
 const cookie=allowCookie?req.cookies?.[PRIVATE_COOKIE]:undefined;
 const value=token||cookie;
 if(!value||!/^[-A-Za-z0-9_.]{20,4096}$/.test(value)||value.split('.').length!==3)throw new MediaAccessError(401,'SIGN_IN_REQUIRED');
 return value;
}
export function sameSite(req:NextApiRequest){
 const configured=process.env.PRIVATE_MEDIA_PUBLIC_ORIGIN||process.env.EXTERNAL_PUBLIC_ORIGIN;
 let origin:URL;try{origin=new URL(configured||'');if(origin.protocol!=='https:'||origin.origin!==configured)throw new Error();}catch{throw new MediaAccessError(503,'PUBLIC_ORIGIN_NOT_CONFIGURED');}
 if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==configured))throw new MediaAccessError(403,'CROSS_SITE_DENIED');
 // Mutations must carry the explicit browser origin, never a Host-derived one.
 if(req.method==='POST'&&req.headers.origin!==configured)throw new MediaAccessError(403,'CROSS_SITE_DENIED');
}
export async function authorizeMedia(req:NextApiRequest,allowCookie=true):Promise<MediaBinding>{
 sameSite(req);const token=mediaToken(req,allowCookie);
 let target:URL;try{target=new URL(process.env.API_INTERNAL_URL||'');if(target.protocol!=='https:'||target.username||target.password||target.pathname!=='/'||target.hash||target.search)throw new Error();}catch{throw new MediaAccessError(503,'AUTH_UNAVAILABLE');}
 let geo:string;try{geo=signHostingGeo(req,'private-media',token,true);}catch{throw new MediaAccessError(403,'TRUSTED_GEO_REQUIRED');}
 let response:Response;
 try{response=await fetch(new URL('/private-media/authorize',target),{method:'POST',headers:{Authorization:`Bearer ${token}`,'x-external-geo':geo},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{throw new MediaAccessError(503,'AUTH_UNAVAILABLE');}
 if(!response.ok)throw new MediaAccessError([401,403,429].includes(response.status)?response.status:503,'PRIVATE_MEDIA_DENIED');
 let b:MediaBinding;try{const text=await response.text();if(text.length>2048)throw new Error();b=JSON.parse(text);
 if(!uuid.test(b.userId)||!uuid.test(b.sessionId)||!/^[A-Z]{2}$/.test(b.country)||!/^[a-f0-9]{64}$/.test(b.ipHash)||!Number.isSafeInteger(b.expiresAt)||b.expiresAt<=Date.now())throw new Error();
 }catch{throw new MediaAccessError(503,'AUTH_UNAVAILABLE');}return b;
}
export function assertMediaBinding(grant:MediaBinding|undefined,current:MediaBinding){
 if(!grant||grant.userId!==current.userId||grant.sessionId!==current.sessionId||grant.country!==current.country||grant.ipHash!==current.ipHash||grant.expiresAt<=Date.now())throw new MediaAccessError(403,'MEDIA_SESSION_MISMATCH');
}
export function setMediaCookie(req:NextApiRequest,res:NextApiResponse,b:MediaBinding){
 const ttl=Math.max(0,Math.min(120,Math.floor((b.expiresAt-Date.now())/1000)));
 res.setHeader('Set-Cookie',`${PRIVATE_COOKIE}=${mediaToken(req,false)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttl}`);
}
export function mediaFailure(res:NextApiResponse,error:unknown){
 const e=error instanceof MediaAccessError?error:new MediaAccessError(503,'AUTH_UNAVAILABLE');
 // Fixed code/status only: never bearer, capability, provider URL or IP.
 return res.status(e.status).json({error:e.code});
}
