import { publicFetch } from './public-fetch';
/** Fixed public source. No stream is fetched by the server. Source and stream providers are third parties. */
import { isIP } from 'node:net';
const IRAQ_SOURCE = 'https://iptv-org.github.io/iptv/countries/iq.m3u';
const ARAB_SOURCE = 'https://iptv-org.github.io/iptv/regions/arab.m3u';
const WORLD_SOURCE = 'https://iptv-org.github.io/iptv/index.m3u';
const MAX_BYTES = 1024 * 1024;
export type IraqChannel = { id: string; name: string; category: string; quality: string; playable: boolean; streamUrl?: string };
function text(v:string,max=140){return v.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,max)}
export function permittedHls(raw:string):string|undefined {
 if(raw.length>2048)return;
 try {
  const u=new URL(raw);const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||(u.port&&u.port!=='443')||!u.pathname.toLowerCase().endsWith('.m3u8')||isIP(host)||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||!host.includes('.')||!/^[a-z0-9.-]+$/.test(host))return;
  return u.href;
 } catch{return}
}
function separator(l:string){let quoted=false;for(let i=0;i<l.length;i++){if(l[i]==='"')quoted=!quoted;else if(l[i]===','&&!quoted)return i}return -1}
export function parsePlaylist(raw:string,maxEntries=1000):IraqChannel[] {
 const lines=raw.replace(/^\uFEFF/,'').split(/\r?\n/);
 if(lines[0]?.trim()!=='#EXTM3U')throw new Error('SOURCE_UNAVAILABLE');
 const out:IraqChannel[]=[];let name='';let special=false;
 for(const rawLine of lines){
  const l=rawLine.trim();
  if(l.startsWith('#EXTINF:')){const at=separator(l);name=at<0?'':text(l.slice(at+1));special=false;continue}
  if(l.startsWith('#EXTVLCOPT:')||l.startsWith('#EXTHTTP:')||l.startsWith('#KODIPROP:')){special=true;continue}
  if(!l||l.startsWith('#'))continue;
  if(name){if(out.length>=maxEntries)throw new Error('SOURCE_UNAVAILABLE');const url=special?undefined:permittedHls(l);out.push({id:String(out.length),name,category:'',quality:'',playable:!!url,...(url?{streamUrl:url}:{})});}
  name='';special=false;
 }
 return out;
}
function createReader(source:string,maxBytes=MAX_BYTES,maxEntries=1000) {
 let cached: {until:number;data:IraqChannel[]} | undefined;
 let pending:Promise<IraqChannel[]>|undefined;
 let hits=0,windowStart=0;
 return async function getChannels():Promise<IraqChannel[]> {
 const now=Date.now();if(now-windowStart>60_000){windowStart=now;hits=0}if(++hits>60)throw new Error('RATE_LIMIT');
 if(cached&&cached.until>now)return cached.data;if(pending)return pending;
 pending=(async()=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),8000);
  try{const r=await publicFetch(source,{signal:controller.signal,redirect:'error',cache:'no-store',headers:{Accept:'audio/x-mpegurl, text/plain'}});
   if(!r.ok||!r.body||Number(r.headers.get('content-length'))>maxBytes)throw new Error('SOURCE_UNAVAILABLE');
   const reader=r.body.getReader();const chunks:Uint8Array[]=[];let total=0;
   for(;;){const p=await reader.read();if(p.done)break;total+=p.value.byteLength;if(total>maxBytes){await reader.cancel();throw new Error('SOURCE_UNAVAILABLE')}chunks.push(p.value)}
   const data=parsePlaylist(Buffer.concat(chunks.map(c=>Buffer.from(c))).toString('utf8'),maxEntries);cached={until:Date.now()+60_000,data};return data;
  }finally{clearTimeout(timer)}
 })().finally(()=>{pending=undefined});return pending;
}

}
export const getIraqChannels = createReader(IRAQ_SOURCE);
export const getArabChannels = createReader(ARAB_SOURCE);
export const getWorldChannels = createReader(WORLD_SOURCE, 6 * 1024 * 1024, 25000);
