import {createHash,randomUUID} from 'node:crypto';
import type {Request,Response,NextFunction} from 'express';
import type {PrismaService} from '../prisma.service';
/** Atomic shared fixed-window quota in the existing backend-only expiring
 * ledger. No schema mutation on startup. Explicit rollout; never fall back to
 * a local allowance after a database error. Uses DB time, not replica clocks.
 * This is a low-volume safety limit, not high-throughput Redis replacement. */
export class PostgresRateLimiter {
 constructor(private readonly db:PrismaService,private readonly windowMs=60000){
  if(!Number.isSafeInteger(windowMs)||windowMs<1000||windowMs>60000)throw new Error('QUOTA_WINDOW_INVALID');
 }
 async check(identity:string,sensitive:boolean):Promise<{allowed:boolean;retryAfter:number}>{
  const hash=createHash('sha256').update(identity).digest('hex');
  return this.db.$transaction(async tx=>{
   // Serializes the general and sensitive allowance together across replicas.
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'quota:'+hash}))`;
   const [{now}]=await tx.$queryRaw<Array<{now:Date}>>`SELECT clock_timestamp() AS now`;
   const bucket=Math.floor(now.getTime()/this.windowMs),expiry=(bucket+1)*this.windowMs;
   const prefix=`quota:${bucket}:${hash}:`,retryAfter=Math.max(1,Math.ceil((expiry-now.getTime())/1000));
   const general=await tx.externalGeoNonce.count({where:{id:{startsWith:prefix+'general:'}}});
   const auth=sensitive?await tx.externalGeoNonce.count({where:{id:{startsWith:prefix+'auth:'}}}):0;
   if(general>=100||auth>=10)return {allowed:false,retryAfter};
   await tx.externalGeoNonce.createMany({data:[{id:prefix+'general:'+randomUUID(),expiresAt:new Date(expiry)},...(sensitive?[{id:prefix+'auth:'+randomUUID(),expiresAt:new Date(expiry)}]:[])]});
   return {allowed:true,retryAfter:0};
  },{maxWait:2000,timeout:3000});
 }
 async prune():Promise<void>{
  // Restricted to quota records; must never delete live Geo/session anchors.
  await this.db.$executeRaw`DELETE FROM "ExternalGeoNonce" WHERE id IN (SELECT id FROM "ExternalGeoNonce" WHERE id LIKE 'quota:%' AND "expiresAt"<=clock_timestamp() ORDER BY "expiresAt",id LIMIT 500 FOR UPDATE SKIP LOCKED)`;
 }
}
export function sharedRateLimiter(store:PostgresRateLimiter){
 let nextPrune=0;
 return async(req:Request,res:Response,next:NextFunction)=>{
  try{
   if(Date.now()>=nextPrune){nextPrune=Date.now()+1000;await store.prune();}
   // Default Express trust proxy MUST stay false until a separate trusted-ingress
   // policy exists. Client XFF/country/claimed user never grants a new budget.
   const key=req.socket.remoteAddress||'unknown';
   const sensitive=req.method==='POST'&&/^\/auth\/(?:login|register|admin\/login|refresh)\/?$/i.test(req.path);
   const result=await store.check(key,sensitive);
   if(!result.allowed){res.setHeader('Retry-After',String(result.retryAfter));res.status(429).json({code:'RATE_LIMITED',retryAfter:result.retryAfter});return;}
   next();
  }catch{res.setHeader('Retry-After','1');res.status(503).json({code:'RATE_LIMIT_AUTHORITY_UNAVAILABLE'});}
 };
}
