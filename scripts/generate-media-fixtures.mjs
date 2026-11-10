// Generates original synthetic video/audio/text only; no external content.
// FFMPEG=/absolute/path/to/ffmpeg node scripts/generate-media-fixtures.mjs <output>
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const binary = process.env.FFMPEG;
if (!binary || !path.isAbsolute(binary)) throw new Error('EXPLICIT_FFMPEG_PATH_REQUIRED');
const out = path.resolve(process.argv[2] || '.cache/media-fixtures');
mkdirSync(path.join(out, 'hls'), { recursive: true });
const run = args => execFileSync(binary, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
for (const [name, size] of [['low', '320x180'], ['high', '640x360']]) {
  run(['-f', 'lavfi', '-i', `testsrc=size=${size}:rate=24`, '-t', '20', '-an', '-c:v', 'libx264',
    '-threads', '2', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '48', '-sc_threshold', '0',
    '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', path.join(out, `hls/${name}.m3u8`)]);
}
for (const [name, frequency] of [['en', '440'], ['ar', '550']]) {
  run(['-f', 'lavfi', '-i', `sine=frequency=${frequency}:sample_rate=48000`, '-t', '20', '-vn', '-c:a', 'aac', '-b:a', '64k',
    '-f', 'hls', '-hls_time', '2', '-hls_playlist_type', 'vod', path.join(out, `hls/audio-${name}.m3u8`)]);
}
writeFileSync(path.join(out, 'hls/master.m3u8'), `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="English",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="audio-en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Arabic",LANGUAGE="ar",DEFAULT=NO,AUTOSELECT=YES,URI="audio-ar.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="Arabic",LANGUAGE="ar",DEFAULT=NO,AUTOSELECT=YES,URI="subtitles.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=300000,RESOLUTION=320x180,CODECS="avc1.42c00d,mp4a.40.2",AUDIO="audio",SUBTITLES="subs"
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360,CODECS="avc1.42c01e,mp4a.40.2",AUDIO="audio",SUBTITLES="subs"
high.m3u8
`);
writeFileSync(path.join(out, 'hls/subtitles.m3u8'), '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:20\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:20,\nsubtitle.vtt\n#EXT-X-ENDLIST\n');
writeFileSync(path.join(out, 'hls/subtitle.vtt'), 'WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:126000\n\n00:00:00.000 --> 00:00:15.000\nCloud Play synthetic fixture — اختبار\n');
run(['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
  '-t', '20', '-c:v', 'libx264', '-threads', '2', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-g', '48',
  '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', path.join(out, 'sample.mp4')]);
run(['-i', path.join(out, 'sample.mp4'), '-map', '0', '-c', 'copy', '-f', 'dash', '-seg_duration', '2',
  '-adaptation_sets', 'id=0,streams=v id=1,streams=a', path.join(out, 'manifest.mpd')]);
console.log('Generated synthetic HLS (two video/two audio/one subtitle), DASH and MP4 fixtures at', out);
