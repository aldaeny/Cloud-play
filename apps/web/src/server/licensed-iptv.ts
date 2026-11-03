/** Operator-supplied, rights-reviewed local playlist; never fetch an arbitrary URL server-side. */
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { isIP } from 'node:net';
import { permittedHls } from './iraq-playlist';

export type LicensedChannel = { id:string; name:string; group:string; epgId:string; logo?:string; playable:boolean; streamUrl?:string };
const MAX_BYTES = 1024 * 1024;
const MAX_CHANNELS = 1200;
function clean(s:string, max=120) { return s.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,max); }
function attr(s:string,key:string) { return s.match(new RegExp(`(?:^|\\s)${key}="([^"\\r\\n]*)"`,'i'))?.[1] || ''; }
function splitInfo(s:string) { let quoted=false; for(let i=0;i<s.length;i++){if(s[i]==='"')quoted=!quoted;else if(s[i]===','&&!quoted)return [s.slice(0,i),s.slice(i+1)];} return [s,'']; }
function safeLogo(raw:string) {
 if(!raw || raw.length>1024)return undefined;
 try{const u=new URL(raw); const h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||(u.port&&u.port!=='443')||isIP(h)||!h.includes('.')||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||!/^[a-z0-9.-]+$/.test(h)||!/[.](?:png|jpe?g|webp)$/i.test(u.pathname))return undefined;return u.href;}catch{return undefined;}
}
export function parseLicensedPlaylist(raw:string):LicensedChannel[] {
 const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/); if(lines[0]?.trim()!=='#EXTM3U')throw new Error('INVALID_PLAYLIST');
 const result:LicensedChannel[]=[];let info:string|undefined;let special=false;const ids=new Set<string>();
 for(const line of lines){
  const s=line.trim();if(s.startsWith('#EXTINF:')){info=s;special=false;continue;}
  if(s.startsWith('#EXTVLCOPT:')||s.startsWith('#EXTHTTP:')||s.startsWith('#KODIPROP:')){special=true;continue;}
  if(!s||s.startsWith('#'))continue;
  if(info){
   if(result.length>=MAX_CHANNELS)throw new Error('TOO_MANY_CHANNELS');
   const [head,display]=splitInfo(info);const name=clean(display||attr(head,'tvg-name'));const group=clean(attr(head,'group-title'))||'Other';const epgId=clean(attr(head,'tvg-id'));
   const url=special?undefined:permittedHls(s);const logo=safeLogo(attr(head,'tvg-logo'));
   if(name){const id=createHash('sha256').update(`${epgId}\0${name}\0${s}`).digest('hex').slice(0,24);if(!ids.has(id)){ids.add(id);result.push({id,name,group,epgId,...(logo?{logo}:{}),playable:!!url,...(url?{streamUrl:url}:{})});}}
  }
  info=undefined;special=false;
 }
 return result;
}
/** Server-side operator configuration only; neither the filename nor a URL comes from the client. */
export async function readOperatorText(value:string|undefined,path:string|undefined,maxBytes=MAX_BYTES):Promise<string> {
 if(value){if(Buffer.byteLength(value,'utf8')>maxBytes)throw new Error('TOO_LARGE');return value;}
 if(!path)throw new Error('NOT_CONFIGURED');
 const file=await open(path,'r');
 try { const st=await file.stat();if(!st.isFile()||st.size>maxBytes)throw new Error('INVALID_FILE');
  const buf=Buffer.alloc(maxBytes+1);let total=0;while(total<buf.length){const x=await file.read(buf,total,buf.length-total,total);if(!x.bytesRead)break;total+=x.bytesRead;}if(total>maxBytes)throw new Error('TOO_LARGE');return buf.subarray(0,total).toString('utf8');
 } finally {await file.close();}
}
export async function readLicensedPlaylist():Promise<LicensedChannel[]> {
 if(process.env.CLOUDPLAY_IPTV_RIGHTS_CONFIRMED!=='true')throw new Error('NOT_CONFIGURED');
 return parseLicensedPlaylist(await readOperatorText(process.env.CLOUDPLAY_IPTV_M3U,process.env.CLOUDPLAY_IPTV_FILE));
}
