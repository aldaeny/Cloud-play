import path from 'node:path';
/** Strict worker-generated HLS only. No provider URLs, key servers or DRM fallback. */
export function vodRelative(value: string, from = 'master.m3u8'): string {
  if (!value || value.length > 512 || !/^[a-zA-Z0-9_./-]+$/.test(value) || value.startsWith('/') || value.split('/').some(s => s === '.' || s === '..') || value.includes('//')) throw new Error('UNSAFE_VOD_REFERENCE');
  const result = path.posix.join(path.posix.dirname(from), value);
  if (!/\.(m3u8|ts|m4s|mp4|aac|vtt)$/.test(result)) throw new Error('UNSUPPORTED_VOD_RESOURCE');
  return result;
}
export function rewriteVod(text: string, from: string, sign: (key: string) => string): string {
  if (!text.startsWith('#EXTM3U') || text.length > 1024*1024 || /#EXT-X-(SESSION-KEY|KEY|CONTENT-STEERING|DEFINE|SESSION-DATA)/i.test(text)) throw new Error('UNSUPPORTED_VOD_MANIFEST');
  let count=0;
  const output=text.split(/\r?\n/).map(line=>{
    const value=line.trim();
    if(!value) return line;
    if(!value.startsWith('#')) { count++; return sign(vodRelative(value,from)); }
    if(/URI\s*=/i.test(value)) {
      const all=value.match(/URI\s*=/gi)||[];
      if((value.match(/URI="[^"]+"/g)||[]).length!==all.length)throw new Error('UNSUPPORTED_VOD_URI');
      if(!/^#EXT-X-(MAP|MEDIA|I-FRAME-STREAM-INF):/i.test(value)) throw new Error('UNSUPPORTED_VOD_URI');
      return value.replace(/URI="([^"]+)"/g,(_all,ref)=>{count++;return `URI="${sign(vodRelative(ref,from))}"`;});
    }
    return line;
  });
  if(!count || count>2000) throw new Error('INVALID_VOD_MANIFEST');
  return output.join('\n');
}
