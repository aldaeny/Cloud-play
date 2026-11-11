import { rewriteVod, vodRelative } from './vod-manifest';
describe('private VOD manifest boundary',()=>{
  it('rewrites nested variants, map and audio URI references',()=>{
    const result=rewriteVod('#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=100\nlow.m3u8\n','master.m3u8',key=>'/protected/'+key);
    expect(result).toContain('URI="/protected/audio.m3u8"');expect(result).toContain('/protected/low.m3u8');
    expect(vodRelative('segment.ts','low/playlist.m3u8')).toBe('low/segment.ts');
  });
  it.each(['https://provider.invalid/x.ts','//evil/x.ts','../x.ts','a/../../x.ts','a%2f../secret','/bucket/x.ts','file:///x.ts','keys.bin','a.ts?token=x'])('rejects unsafe resource %s',value=>expect(()=>vodRelative(value)).toThrow());
  it.each(['#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\na.ts', '#EXTM3U\n#EXT-X-CONTENT-STEERING:SERVER-URI="https://evil"\na.ts','not a playlist'])('does not downgrade DRM or external control',text=>expect(()=>rewriteVod(text,'master.m3u8',x=>x)).toThrow());
});
