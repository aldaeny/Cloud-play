import type {CastRequest} from './CastNativeOverlay';
const allowedMovies=new Set([
 'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4',
 'https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4',
]);
/** Validate messages before sharing media with a local-network device. */
export function parseCastRequest(raw:string,source:string,origin:string):CastRequest|null {
 try{
  if(raw.length>4096||new URL(source).origin!==origin)return null;
  const d=JSON.parse(raw) as Record<string,unknown>;
  if(d.type!=='cloudplay.cast.v1'||typeof d.url!=='string'||d.url.length>2048||typeof d.title!=='string'||d.title.length>140||!['mp4','hls'].includes(String(d.kind)))return null;
  const u=new URL(d.url);const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||host.endsWith('.local')||host.endsWith('.localhost'))return null;
  if(d.kind==='mp4'&&!allowedMovies.has(u.href))return null;
  if(d.kind==='hls'&&!u.pathname.toLowerCase().endsWith('.m3u8'))return null;
  const position=typeof d.position==='number'&&Number.isFinite(d.position)?Math.max(0,Math.min(86400,d.position)):0;
  return {url:u.href,kind:d.kind as 'hls'|'mp4',title:d.title.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,140),position};
 }catch{return null}
}
