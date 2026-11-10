import {getSupabase} from './supabase';
let current:string|null=null;
let renewTimer:ReturnType<typeof setTimeout>|undefined;
let cleanupAuth:(()=>void)|undefined;
let cleanupOnline:(()=>void)|undefined;
let generation=0;
let queue:Promise<unknown>=Promise.resolve();
function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work,work);queue=next.catch(()=>{});return next;}
function channel(src:string){return src.startsWith('/api/external/')?decodeURIComponent(src.split('/')[3]||''):null;}
async function exchange(channelId:string,method:'POST'|'PUT'|'DELETE'){
 const auth=getSupabase();if(!auth)throw new Error('SIGN_IN_REQUIRED');
 // Supabase SDK owns refresh-token rotation and cross-tab refresh locking.
 // Refresh tokens NEVER enter the media bridge or its cookies.
 const {data,error}=await auth.auth.getSession();
 if(method!=='DELETE'&&(error||!data.session))throw new Error('SIGN_IN_REQUIRED');
 const response=await fetch('/api/external/session',{method,headers:{'Content-Type':'application/json',...(data.session?{Authorization:`Bearer ${data.session.access_token}`}:{})},body:JSON.stringify({channelId}),credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw new Error(`MEDIA_SESSION_${response.status}`);
}
async function release(){
 const old=current;current=null;generation++;clearTimeout(renewTimer);cleanupAuth?.();cleanupAuth=undefined;cleanupOnline?.();cleanupOnline=undefined;
 if(old)await exchange(old,'DELETE');
}
export function releaseMediaSession(src?:string):Promise<void>{return serial(async()=>{if(!src||current===channel(src))await release();});}
function schedule(id:string,g:number,delay=45000,retry=false){
 clearTimeout(renewTimer);
 renewTimer=setTimeout(()=>{void serial(async()=>{
  if(current!==id||g!==generation)return;
  try{await exchange(id,'PUT');schedule(id,g);}catch{
   // No new lease after a denial. Only retry the SAME lease, at most once.
   if(!retry)schedule(id,g,5000,true);else await release().catch(()=>{});
  }
 });},delay);
}
/** Existing player calls this at attach/retry. No second account authority. */
export function prepareMediaSession(src:string):Promise<void>{return serial(async()=>{
 const id=channel(src);if(id===null)return;if(!id)throw new Error('INVALID_CHANNEL');
 if(current===id){await exchange(id,'PUT');return;}
 if(current)await release();
 await exchange(id,'POST');current=id;const g=++generation;schedule(id,g);
 const subscription=getSupabase()?.auth.onAuthStateChange(event=>{
  // Do not await Supabase calls inside its auth-state callback (SDK lock).
  if(event==='SIGNED_OUT')setTimeout(()=>{void releaseMediaSession().catch(()=>{});},0);
  if(event==='TOKEN_REFRESHED')setTimeout(()=>{void serial(async()=>{if(current===id){try{await exchange(id,'PUT');schedule(id,g);}catch{await release().catch(()=>{});}}});},0);
 });cleanupAuth=()=>subscription?.data.subscription.unsubscribe();
 const online=()=>{void serial(async()=>{if(current===id)try{await exchange(id,'PUT');schedule(id,g);}catch{/* Existing lease must remain valid; no silent replacement. */}});};
 window.addEventListener('online',online);cleanupOnline=()=>window.removeEventListener('online',online);
});}
