/**
 * GATE D tests for the HLS manifest rewriter.
 *
 * The rewriter is the layer that decides which upstream URIs may be handed back
 * to a browser through our origin. If it lets one internal address through, the
 * browser fetches it from our domain, so every child URI is validated.
 *
 * Run: node scripts/live-proxy-tests.js
 */
const assert = require('assert');
const path = require('path');
const { loadTs } = require('./lib/load-ts');

const ROOT = path.resolve(__dirname, '..');
const rewrite = loadTs(path.join(ROOT, 'apps/web/src/server/live/hls-rewrite.ts'));
const policy = loadTs(path.join(ROOT, 'apps/web/src/server/live/url-policy.ts'));

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const BASE = 'https://imn-live.esite-lab.com/hls/iraqia-general.m3u8';

function decodeTargets(body) {
  const urls = [];
  const pattern = /\/api\/stream\/([A-Za-z0-9_-]+)/g;
  let match;
  while ((match = pattern.exec(body))) urls.push(policy.decodeStreamTarget(match[1]));
  return urls;
}

/* --------------------------------------------------------------- happy path */

const MEDIA_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:4211
#EXTINF:6.000,
segment-4211.ts
#EXTINF:6.000,
/absolute/segment-4212.ts
#EXTINF:6.000,
https://other-cdn.example.net/live/segment-4213.ts
#EXT-X-ENDLIST
`;

test('rewrites every segment URI to a same-origin proxy path', () => {
  const result = rewrite.rewriteManifest(MEDIA_PLAYLIST, BASE);
  assert.equal(result.ok, true, result.ok ? '' : result.code);
  assert.equal(result.uriCount, 3);
  const urls = decodeTargets(result.body);
  assert.deepEqual(urls, [
    'https://imn-live.esite-lab.com/hls/segment-4211.ts',
    'https://imn-live.esite-lab.com/absolute/segment-4212.ts',
    'https://other-cdn.example.net/live/segment-4213.ts',
  ]);
});

test('keeps tags and timings byte-identical', () => {
  const result = rewrite.rewriteManifest(MEDIA_PLAYLIST, BASE);
  for (const tag of ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:6', '#EXT-X-MEDIA-SEQUENCE:4211', '#EXTINF:6.000,', '#EXT-X-ENDLIST']) {
    assert.ok(result.body.includes(tag), `missing ${tag}`);
  }
});

test('rewrites the variant playlist in a master manifest', () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=1280x720
https://edge2.example.net/720p/index.m3u8
`;
  const result = rewrite.rewriteManifest(master, BASE);
  assert.equal(result.ok, true, result.ok ? '' : result.code);
  const urls = decodeTargets(result.body);
  assert.deepEqual(urls, ['https://imn-live.esite-lab.com/hls/1080p/index.m3u8', 'https://edge2.example.net/720p/index.m3u8']);
});

test('rewrites encryption key URIs so AES-128 HLS keeps working', () => {
  const encrypted = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://keys.example.net/k/1.key",IV=0x1a2b
#EXT-X-MAP:URI="init.mp4"
#EXTINF:4,
s1.m4s
`;
  const result = rewrite.rewriteManifest(encrypted, BASE);
  assert.equal(result.ok, true, result.ok ? '' : result.code);
  const urls = decodeTargets(result.body);
  assert.deepEqual(urls, ['https://keys.example.net/k/1.key', 'https://imn-live.esite-lab.com/hls/init.mp4', 'https://imn-live.esite-lab.com/hls/s1.m4s']);
  assert.ok(result.body.includes('#EXT-X-KEY:METHOD=AES-128'), 'key method preserved');
  assert.ok(!result.body.includes('keys.example.net'), 'provider key host must not appear in the served manifest');
});

test('rewrites alternative audio/subtitle renditions', () => {
  const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="Arabic",URI="audio/ar.m3u8"
#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="English",URI="https://subs.example.net/en.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=900000,AUDIO="aac",SUBTITLES="subs"
video/index.m3u8
`;
  const result = rewrite.rewriteManifest(master, BASE);
  assert.equal(result.ok, true, result.ok ? '' : result.code);
  const urls = decodeTargets(result.body);
  assert.deepEqual(urls, ['https://imn-live.esite-lab.com/hls/audio/ar.m3u8', 'https://subs.example.net/en.m3u8', 'https://imn-live.esite-lab.com/hls/video/index.m3u8']);
});

test('handles CRLF manifests', () => {
  const result = rewrite.rewriteManifest('#EXTM3U\r\n#EXTINF:4,\r\na.ts\r\n', BASE);
  assert.equal(result.ok, true);
  assert.equal(result.uriCount, 1);
});

/* ------------------------------------------------------- rejection behaviour */

const attacks = [
  ['internal IPv4 segment', '#EXTM3U\n#EXTINF:4,\nhttps://127.0.0.1/seg.ts\n', 'IP_LITERAL'],
  ['private range segment', '#EXTM3U\n#EXTINF:4,\nhttps://10.0.0.9/seg.ts\n', 'IP_LITERAL'],
  ['cloud metadata segment', '#EXTM3U\n#EXTINF:4,\nhttps://169.254.169.254/latest/meta-data/seg.ts\n', 'IP_LITERAL'],
  ['localhost segment', '#EXTM3U\n#EXTINF:4,\nhttps://localhost/seg.ts\n', 'BLOCKED_HOST'],
  ['dot-local segment', '#EXTM3U\n#EXTINF:4,\nhttps://nas.local/seg.ts\n', 'BLOCKED_HOST'],
  ['plain http segment', '#EXTM3U\n#EXTINF:4,\nhttp://cdn.example.net/seg.ts\n', 'INSECURE_SCHEME'],
  ['credentials in segment', '#EXTM3U\n#EXTINF:4,\nhttps://user:pass@cdn.example.net/seg.ts\n', 'HAS_CREDENTIALS'],
  ['internal key uri', '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://127.0.0.1/key"\n#EXTINF:4,\nhttps://cdn.example.net/s.ts\n', 'IP_LITERAL'],
  ['internal map uri', '#EXTM3U\n#EXT-X-MAP:URI="http://169.254.169.254/init.mp4"\n#EXTINF:4,\nhttps://cdn.example.net/s.m4s\n', 'INSECURE_SCHEME'],
  ['internal variant', '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nhttps://192.168.1.1/v.m3u8\n', 'IP_LITERAL'],
  ['IPv6 loopback segment', '#EXTM3U\n#EXTINF:4,\nhttps://[::1]/seg.ts\n', 'IP_LITERAL'],
];

for (const [label, manifest, reason] of attacks) {
  test(`rejects ${label}`, () => {
    const result = rewrite.rewriteManifest(manifest, BASE);
    assert.equal(result.ok, false, `${label} was accepted`);
    assert.ok(result.code.includes(reason), `${label}: got ${result.code}, expected ${reason}`);
  });
}

test('rejects a non-manifest body', () => {
  const result = rewrite.rewriteManifest('<html>not a playlist</html>', BASE);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NOT_A_MANIFEST');
});

test('rejects an oversized manifest', () => {
  const result = rewrite.rewriteManifest(`#EXTM3U\n${'a'.repeat(5 * 1024 * 1024)}`, BASE);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MANIFEST_TOO_LARGE');
});

test('rejects a manifest with more URIs than the cap', () => {
  const body = ['#EXTM3U', ...Array.from({ length: 20 }, (_, index) => `#EXTINF:4,\nseg-${index}.ts`)].join('\n');
  const result = rewrite.rewriteManifest(body, BASE, { maxUri: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'TOO_MANY_URIS');
});

test('one bad URI rejects the whole manifest (no partial leakage)', () => {
  const mixed = '#EXTM3U\n#EXTINF:4,\ngood.ts\n#EXTINF:4,\nhttps://169.254.169.254/bad.ts\n#EXTINF:4,\nalso-good.ts\n';
  const result = rewrite.rewriteManifest(mixed, BASE);
  assert.equal(result.ok, false);
  assert.ok(!('body' in result), 'no partially rewritten body may be returned');
});

test('a served manifest exposes no provider host or token', () => {
  const signed = '#EXTM3U\n#EXTINF:4,\nhttps://cdn.example.net/seg.ts?token=SECRET123&exp=1\n';
  const result = rewrite.rewriteManifest(signed, 'https://cdn.example.net/live/index.m3u8?token=SECRET123');
  assert.equal(result.ok, true);
  assert.ok(!result.body.includes('SECRET123'), 'token leaked into the manifest');
  assert.ok(!result.body.includes('cdn.example.net'), 'provider host leaked into the manifest');
  // The proxy must re-use the exact signed URL (the token is still required
  // upstream); it simply must never be visible to the client.
  assert.deepEqual(decodeTargets(result.body), ['https://cdn.example.net/seg.ts?token=SECRET123&exp=1']);
});

/* -------------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  if (result.ok) console.log(`  ok   ${result.name}`);
  else console.log(`  FAIL ${result.name}\n         ${result.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} manifest rewriter tests passed`);
if (failed.length) {
  process.exitCode = 1;
  console.error(`${failed.length} FAILED`);
}
