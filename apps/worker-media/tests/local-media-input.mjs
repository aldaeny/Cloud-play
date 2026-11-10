// Actual decoder process tests, no Redis/S3 required and no remote content.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { localMediaInput } = require('../dist/local-media-input.js');
const binary = process.env.FFMPEG;
const sample = process.env.MEDIA_FIXTURES && path.join(process.env.MEDIA_FIXTURES, 'sample.mp4');
if (!binary || !sample) throw new Error('EXPLICIT_LOCAL_FFMPEG_AND_FIXTURES_REQUIRED');
const execute = promisify(execFile);
const temp = await mkdtemp(path.join(tmpdir(), 'worker-media-security-'));
let requests = 0;
const server = createServer((_req, res) => { requests++; res.end('private fixture'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  for (const source of ['https://provider.example/stream.mp4', '../secret.mp4', '/tmp/playlist.m3u8']) assert.throws(() => localMediaInput(source));
  await execute(binary, ['-v', 'error', ...localMediaInput(sample), '-frames:v', '1', '-f', 'null', '-'], { timeout: 10000, maxBuffer: 65536 });
  const malicious = path.join(temp, 'uploaded.mp4');
  for (const destination of [`http://127.0.0.1:${server.address().port}/private`, 'http://169.254.169.254/latest/meta-data', 'file:///etc/passwd']) {
    await writeFile(malicious, `#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n${destination}\n#EXT-X-ENDLIST\n`);
    await assert.rejects(execute(binary, ['-v', 'error', ...localMediaInput(malicious), '-frames:v', '1', '-f', 'null', '-'], { timeout: 5000, maxBuffer: 65536 }));
  }
  assert.equal(requests, 0);
  console.log('PASS worker actual FFmpeg: valid MP4 decodes; nonlocal paths rejected; uploaded playlist-as-MP4 rejected; zero internal HTTP requests');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await rm(temp, { recursive: true, force: true }); }
