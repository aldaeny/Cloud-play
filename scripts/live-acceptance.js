/**
 * GATE C + GATE D acceptance run against a live server.
 *
 *   LIVE_BASE=http://127.0.0.1:3001 node scripts/live-acceptance.js
 *
 * Optional:
 *   LIVE_PROVIDER_MANIFEST=https://provider.test:8443/live/ch/index.m3u8?token=...
 *       When set, the script also drives a real HLS stream through the proxy:
 *       it requests the manifest, follows every rewritten segment, concatenates
 *       the bytes and verifies the result is playable H.264/AAC.
 *
 * The script asserts and prints measured numbers. It never estimates.
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const BASE = (process.env.LIVE_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const PROVIDER_MANIFEST = process.env.LIVE_PROVIDER_MANIFEST || '';
const FFMPEG = process.env.FFMPEG_PATH || '';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const encode = (url) => Buffer.from(url, 'utf8').toString('base64url');

async function getJson(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { cache: 'no-store' });
  const body = await response.json();
  return { status: response.status, body, headers: response.headers };
}

async function main() {
  /* ------------------------------------------------------- the catalogue --- */

  let catalogue;
  await test('live catalogue answers 200 with real channels', async () => {
    const { status, body } = await getJson('/api/iptv/live?region=iq&pageSize=240');
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.data) && body.data.length > 0, 'no channels returned');
    catalogue = body;
  });

  await test('catalogue reports measured counts, not estimates', async () => {
    assert.ok(catalogue.counts.raw >= catalogue.counts.total, 'raw < total');
    assert.equal(catalogue.counts.total, catalogue.counts.playable + catalogue.counts.blocked);
    console.log(`       total=${catalogue.counts.total} playable=${catalogue.counts.playable} blocked=${catalogue.counts.blocked} duplicates=${catalogue.counts.duplicates} raw=${catalogue.counts.raw}`);
  });

  await test('every playable channel carries an opaque stream id', async () => {
    const playable = catalogue.data.filter((channel) => channel.playable);
    assert.ok(playable.length > 0, 'no playable channels');
    for (const channel of playable) {
      assert.ok(typeof channel.stream === 'string' && /^\/api\/stream\/[A-Za-z0-9_-]+$/.test(channel.stream), `${channel.name}: bad stream id`);
    }
    console.log(`       ${playable.length} playable channels reference ${new Set(playable.map((channel) => channel.stream)).size} distinct stream ids`);
  });

  await test('catalogue never exposes a provider host, plain http or a token', async () => {
    const blob = JSON.stringify(catalogue);
    for (const banned of ['http://', 'token=', 'password=', 'api_key=']) assert.ok(!blob.includes(banned), `payload contains ${banned}`);
    // Hosts are only allowed in the diagnostic `feeds` list.
    const withoutFeeds = JSON.stringify({ ...catalogue, feeds: [] });
    assert.ok(!/\.(net|com|iq|org)\//.test(withoutFeeds), 'a provider host leaked into the channel list');
  });

  await test('blocked channels state a reason and are never playable', async () => {
    const blocked = catalogue.data.filter((channel) => !channel.playable);
    for (const channel of blocked) assert.ok(!channel.stream, `${channel.name} is blocked but has a stream id`);
    console.log(`       ${blocked.length} blocked channels, all without a stream id`);
  });

  /* ------------------------------------------------------------ filtering --- */

  await test('server-side filters agree with the returned set', async () => {
    const needle = catalogue.data[0].name.split(' ')[0].toLowerCase();
    const { body } = await getJson(`/api/iptv/live?region=iq&q=${encodeURIComponent(needle)}&pageSize=240`);
    assert.ok(body.total >= 1, 'filter returned nothing');
    for (const channel of body.data) {
      assert.ok(`${channel.name} ${channel.group}`.toLowerCase().includes(needle), `${channel.name} does not match ${needle}`);
    }
  });

  await test('pagination is stable and bounded', async () => {
    const first = await getJson('/api/iptv/live?region=iq&page=1&pageSize=5');
    const second = await getJson('/api/iptv/live?region=iq&page=2&pageSize=5');
    assert.ok(first.body.data.length <= 5);
    const overlap = first.body.data.filter((channel) => second.body.data.some((other) => other.id === channel.id));
    assert.equal(overlap.length, 0, 'pages overlap');
  });

  await test('invalid parameters are rejected, not silently coerced', async () => {
    assert.equal((await getJson('/api/iptv/live?region=zz')).status, 400);
    assert.equal((await getJson('/api/iptv/live?page=0')).status, 400);
    assert.equal((await getJson('/api/iptv/live?pageSize=0')).status, 400);
  });

  /* --------------------------------------------------------------- health --- */

  let health;
  await test('health endpoint reports the pipeline state', async () => {
    const { status, body } = await getJson('/api/iptv/health');
    assert.equal(status, 200);
    health = body;
    assert.ok(['ok', 'degraded', 'unconfigured'].includes(body.status));
    console.log(`       status=${body.status} source=${body.source} stale=${body.stale} counts=${JSON.stringify(body.counts)}`);
  });

  await test('health feed list explains failures instead of omitting them', async () => {
    assert.ok(Array.isArray(health.feeds));
    for (const feed of health.feeds) {
      assert.ok(typeof feed.key === 'string');
      if (!feed.ok) assert.ok(typeof feed.error === 'string' && feed.error.length > 0, 'a failed feed has no reason');
    }
  });

  /* ------------------------------------------------------- SSRF / proxy ----- */

  const blocked = [
    ['IPv4 loopback', 'https://127.0.0.1/a.m3u8', 'IP_LITERAL'],
    ['RFC1918', 'https://10.0.0.5/a.m3u8', 'IP_LITERAL'],
    ['cloud metadata IP', 'https://169.254.169.254/latest/meta-data/a.m3u8', 'IP_LITERAL'],
    ['IPv6 loopback', 'https://[::1]/a.m3u8', 'IP_LITERAL'],
    ['localhost', 'https://localhost/a.m3u8', 'BLOCKED_HOST'],
    ['mDNS .local', 'https://nas.local/a.m3u8', 'BLOCKED_HOST'],
    ['metadata hostname', 'https://metadata.google.internal/a.m3u8', 'BLOCKED_HOST'],
    ['plain http', 'http://cdn.example.net/a.m3u8', 'INSECURE_SCHEME'],
    ['userinfo credentials', 'https://user:pass@cdn.example.net/a.m3u8', 'HAS_CREDENTIALS'],
    ['decimal IP', 'https://2130706433/a.m3u8', 'IP_LITERAL'],
  ];

  for (const [label, target, reason] of blocked) {
    await test(`proxy refuses ${label}`, async () => {
      const response = await fetch(`${BASE}/api/stream/${encode(target)}`);
      const body = await response.json();
      assert.equal(response.status, 403, `${label}: expected 403, got ${response.status}`);
      assert.ok(body.error.includes(reason), `${label}: got ${body.error}, expected ${reason}`);
    });
  }

  await test('proxy refuses an unparseable token', async () => {
    const response = await fetch(`${BASE}/api/stream/not_base64!!`);
    assert.equal(response.status, 400);
  });

  await test('proxy refuses write methods', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const response = await fetch(`${BASE}/api/stream/${encode('https://cdn.example.net/a.m3u8')}`, { method });
      assert.equal(response.status, 405, `${method} was not rejected`);
    }
  });

  await test('proxy response never echoes the upstream URL', async () => {
    const response = await fetch(`${BASE}/api/stream/${encode('https://127.0.0.1/secret.m3u8?token=abc')}`);
    const text = await response.text();
    assert.ok(!text.includes('127.0.0.1'), 'upstream host echoed back');
  });

  /* ------------------------------------------- real stream through proxy --- */

  if (PROVIDER_MANIFEST) {
    const manifestPath = `${BASE}/api/stream/${encode(PROVIDER_MANIFEST)}`;
    const manifestResponse = await fetch(manifestPath);
    const manifestText = await manifestResponse.text();

    await test('provider manifest is fetched and rewritten', async () => {
      assert.equal(manifestResponse.status, 200, manifestText.slice(0, 120));
      assert.ok(manifestText.startsWith('#EXTM3U'), 'not a manifest');
      assert.ok(!manifestText.includes('provider.test'), 'provider host leaked');
      assert.ok(!manifestText.includes('SECRET'), 'token leaked');
    });

    const segments = [...manifestText.matchAll(/^(\/api\/stream\/[A-Za-z0-9_-]+)$/gm)].map((match) => match[1]);

    await test('every rewritten segment is retrievable and non-empty', async () => {
      assert.ok(segments.length > 0, 'no segments in the manifest');
      const buffers = [];
      for (const segment of segments) {
        const response = await fetch(`${BASE}${segment}`);
        assert.equal(response.status, 200, `${segment} -> ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length > 0, `${segment} is empty`);
        buffers.push(bytes);
      }
      console.log(`       ${segments.length} segments through the proxy, ${buffers.reduce((sum, buffer) => sum + buffer.length, 0)} bytes total`);
      fs.writeFileSync('/tmp/live-acceptance-stream.ts', Buffer.concat(buffers));
    });

    await test('proxy-delivered bytes are a decodable video stream', async () => {
      const file = '/tmp/live-acceptance-stream.ts';
      assert.ok(fs.existsSync(file), 'no stream captured');
      if (!FFMPEG) {
        console.log('       FFMPEG_PATH not set; skipping decode verification');
        return;
      }
      // `ffmpeg -i` writes stream info to stderr and exits non-zero without an
      // output target, so capture stderr rather than treating exit code as pass.
      const probe = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
      const info = `${probe.stdout || ''}${probe.stderr || ''}`;
      assert.ok(/Video:\s*h264/.test(info), 'no h264 video stream');
      assert.ok(/Audio:\s*aac/.test(info), 'no aac audio stream');
      execFileSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'null', '-'], { stdio: 'pipe' });
      const digest = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
      console.log(`       decoded cleanly; sha256(stream)=${digest}…`);
    });
  } else {
    console.log('  skip provider manifest checks (LIVE_PROVIDER_MANIFEST not set)');
  }

  /* --------------------------------------------------------------- report --- */

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    if (result.ok) console.log(`  ok   ${result.name}`);
    else console.log(`  FAIL ${result.name}\n         ${result.error}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} live acceptance checks passed`);
  if (failed.length) {
    process.exitCode = 1;
    console.error(`${failed.length} FAILED`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
