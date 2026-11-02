import { SaxesParser } from 'saxes';
import { readLicensedPlaylist,readOperatorText } from './licensed-iptv';
export type Program = {start:string;end:string;title:string;titleAr?:string;titleEn?:string};
export type Guide = Record<string,{now?:Program;next?:Program}>;
const MAX_PROGRAMS=5000, MAX_XML_BYTES=1024*1024;
function text(s:string){return s.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().slice(0,180)}
export function xmltvTime(v:string):number|null {
 const m=v.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?$/);if(!m)return null;
 const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);if(year<1970||year>2100||month<1||month>12||day<1||hour>23||minute>59||second>59)return null;
 const utc=Date.UTC(year,month-1,day,hour,minute,second);const d=new Date(utc);if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)return null;
 let offset=0;if(m[7]&&m[7]!=='Z'){const n=m[7];const h=Number(n.slice(1,3)),min=Number(n.slice(3,5));if(h>14||min>59||(h===14&&min!==0))return null;offset=(h*60+min)*(n[0]==='-'?-1:1)}
 return utc-offset*60000;
}
export function parseXmltv(raw:string,channels:Set<string>,now=Date.now()):Guide {
 if(Buffer.byteLength(raw,'utf8')>MAX_XML_BYTES)throw new Error('TOO_LARGE');
 const parser=new SaxesParser();let count=0,root=false,current:{channel:string;start:number|null;end:number|null;titles:Record<string,string>}|undefined;let titleLang:string|undefined,titleText='';const programs=new Map<string,Program[]>();
 parser.on('doctype',()=>{throw new Error('DOCTYPE_NOT_ALLOWED')});
 parser.on('opentag',node=>{
  if(!root){if(node.name!=='tv')throw new Error('INVALID_GUIDE');root=true;}
  if(node.name==='programme'){
   if(++count>MAX_PROGRAMS)throw new Error('TOO_MANY_PROGRAMS');
   const a=node.attributes as Record<string,string>;current={channel:text(a.channel||''),start:xmltvTime(a.start||''),end:xmltvTime(a.stop||''),titles:{}};
  }else if(node.name==='title'&&current){const a=node.attributes as Record<string,string>;titleLang=text(a.lang||'other').toLowerCase();titleText='';}
 });
 parser.on('text',v=>{if(titleLang!==undefined)titleText=(titleText+v).slice(0,500)});
 parser.on('cdata',v=>{if(titleLang!==undefined)titleText=(titleText+v).slice(0,500)});
 parser.on('closetag',node=>{
  if(node.name==='title'&&current&&titleLang!==undefined){const label=text(titleText);if(label&&!current.titles[titleLang])current.titles[titleLang]=label;titleLang=undefined;}
  if(node.name==='programme'&&current){const {channel,start,end,titles}=current;const title=titles.ar||titles.en||Object.values(titles)[0];
   if(channels.has(channel)&&title&&start!==null&&end!==null&&end>start&&end>now&&start<now+48*3600000){const list=programs.get(channel)||[];list.push({start:new Date(start).toISOString(),end:new Date(end).toISOString(),title,...(titles.ar?{titleAr:titles.ar}:{}),...(titles.en?{titleEn:titles.en}:{})});programs.set(channel,list);}
   current=undefined;
  }
 });
 parser.write(raw).close();if(!root)throw new Error('INVALID_GUIDE');const result:Guide=Object.create(null);
 for(const [id,list] of programs){list.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));const current=list.find(p=>Date.parse(p.start)<=now&&Date.parse(p.end)>now);const upcoming=list.find(p=>Date.parse(p.start)>now&&(!current||Date.parse(p.start)>=Date.parse(current.end)));if(current||upcoming)result[id]={...(current?{now:current}:{}),...(upcoming?{next:upcoming}:{})};}
 return result;
}
export async function readLicensedGuide():Promise<Guide>{
 if(process.env.CLOUDPLAY_EPG_RIGHTS_CONFIRMED!=='true')throw new Error('NOT_CONFIGURED');
 const channels=await readLicensedPlaylist();const ids=new Set(channels.map(c=>c.epgId).filter(Boolean));const data=await readOperatorText(process.env.CLOUDPLAY_EPG_XML,process.env.CLOUDPLAY_EPG_FILE,MAX_XML_BYTES);return parseXmltv(data,ids);
}
