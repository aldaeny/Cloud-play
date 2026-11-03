/**
 * GATE D + GATE B unit tests for the live URL policy and M3U parser.
 *
 * Run: node scripts/live-parser-tests.js
 * No network. Uses a fixture that mirrors the real iptv-org Iraq feed shape.
 */
const assert = require('assert');
const path = require('path');
const { loadTs } = require('./lib/load-ts');

const ROOT = path.resolve(__dirname, '..');
const policy = loadTs(path.join(ROOT, 'apps/web/src/server/live/url-policy.ts'));
const parser = loadTs(path.join(ROOT, 'apps/web/src/server/live/m3u.ts'));

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
const accepts = (url) => assert.equal(policy.checkManifestUrl(url).ok, true, `expected accept: ${url}`);
const rejects = (url, code) => {
  const verdict = policy.checkManifestUrl(url);
  assert.equal(verdict.ok, false, `expected reject: ${url}`);
  if (code) assert.equal(verdict.code, code, `${url} -> ${verdict.code}`);
};

/* ---------------------------------------------------------------- url policy */

test('accepts a normal public HLS manifest', () => accepts('https://imn-live.esite-lab.com/hls/iraqia-general.m3u8'));
test('accepts signed manifests with query strings (token stripped later)', () =>
  accepts('https://cdn.example.net/live/ch1/index.m3u8?token=abc&exp=99'));
test('accepts a manifest without an extension', () => accepts('https://cdn.example.net/live/playlist'));
test('still rejects a non-manifest media path', () =>
  rejects('https://cdn.example.net/movie/video.mp4', 'UNSUPPORTED_PATH'));

test('rejects plain http', () => rejects('http://imn-live.esite-lab.com/hls/a.m3u8', 'INSECURE_SCHEME'));
test('rejects ftp', () => rejects('ftp://cdn.example.net/a.m3u8', 'INSECURE_SCHEME'));
test('rejects userinfo credentials', () => rejects('https://user:pass@cdn.example.net/a.m3u8', 'HAS_CREDENTIALS'));
test('rejects bare token in userinfo', () => rejects('https://token@cdn.example.net/a.m3u8', 'HAS_CREDENTIALS'));

test('rejects IPv4 literal (SSRF)', () => rejects('https://127.0.0.1/a.m3u8', 'IP_LITERAL'));
test('rejects private range literal', () => rejects('https://10.0.0.5/a.m3u8', 'IP_LITERAL'));
test('rejects link-local literal', () => rejects('https://169.254.169.254/latest/meta-data/a.m3u8', 'IP_LITERAL'));
test('rejects IPv6 literal', () => rejects('https://[::1]/a.m3u8', 'IP_LITERAL'));
test('rejects IPv4-mapped IPv6', () => rejects('https://[::ffff:127.0.0.1]/a.m3u8', 'IP_LITERAL'));
test('rejects decimal-encoded IP hostname', () => rejects('https://2130706433/a.m3u8', 'IP_LITERAL'));
test('accepts a DNS name that merely starts with digits (not an IP literal)', () =>
  accepts('https://127.0.0.1.example.com/a.m3u8'));
// The WHATWG URL parser refuses to parse a numeric last label as a DNS name,
// so it surfaces as MALFORMED. Either way it never reaches fetch.
test('rejects a host whose last label is numeric', () => rejects('https://cdn.example.127/a.m3u8', 'MALFORMED'));

test('rejects localhost', () => rejects('https://localhost/a.m3u8', 'BLOCKED_HOST'));
test('rejects localhost subdomain', () => rejects('https://app.localhost/a.m3u8', 'BLOCKED_HOST'));
test('rejects .local mDNS', () => rejects('https://printer.local/a.m3u8', 'BLOCKED_HOST'));
test('rejects .internal', () => rejects('https://vault.internal/a.m3u8', 'BLOCKED_HOST'));
test('rejects cloud metadata hostname', () => rejects('https://metadata.google.internal/a.m3u8', 'BLOCKED_HOST'));
test('rejects single-label host', () => rejects('https://intranet/a.m3u8', 'MALFORMED'));
test('rejects relative url', () => rejects('/hls/a.m3u8', 'MALFORMED'));
test('rejects empty url', () => rejects('', 'TOO_LONG'));
test('rejects oversized url', () => rejects(`https://cdn.example.net/${'a'.repeat(2100)}.m3u8`, 'TOO_LONG'));
test('rejects non-manifest path for manifest check', () => rejects('https://cdn.example.net/video.mp4', 'UNSUPPORTED_PATH'));

test('accepts child segment urls from manifests', () => {
  for (const url of [
    'https://cdn.example.net/live/ch1/seg-1.ts',
    'https://cdn.example.net/live/ch1/chunk.m4s',
    'https://cdn.example.net/live/ch1/init.mp4',
    'https://cdn.example.net/live/ch1/enc.key',
  ]) assert.equal(policy.checkChildUrl(url).ok, true, url);
});
test('rejects child urls that point inside the network', () => {
  for (const url of ['https://127.0.0.1/seg.ts', 'http://cdn.example.net/seg.ts', 'https://localhost/seg.ts']) {
    assert.equal(policy.checkChildUrl(url).ok, false, url);
  }
});

test('allowlist empty means open public internet', () => {
  delete process.env.CLOUDPLAY_LIVE_HOST_ALLOWLIST;
  accepts('https://any-provider.example/a.m3u8');
});
test('allowlist restricts to listed hosts and their subdomains', () => {
  process.env.CLOUDPLAY_LIVE_HOST_ALLOWLIST = 'esite-lab.com, example.net';
  accepts('https://imn-live.esite-lab.com/a.m3u8');
  accepts('https://cdn.example.net/a.m3u8');
  rejects('https://other.example.org/a.m3u8', 'BLOCKED_ALLOWLIST');
  delete process.env.CLOUDPLAY_LIVE_HOST_ALLOWLIST;
});
test('denylist blocks a host and its subdomains', () => {
  process.env.CLOUDPLAY_LIVE_HOST_DENYLIST = 'evil.example';
  rejects('https://evil.example/a.m3u8', 'BLOCKED_DENYLIST');
  rejects('https://cdn.evil.example/a.m3u8', 'BLOCKED_DENYLIST');
  delete process.env.CLOUDPLAY_LIVE_HOST_DENYLIST;
});

test('stripSecrets removes query, hash and userinfo', () => {
  assert.equal(
    policy.stripSecrets('https://user:pass@cdn.example.net/live/a.m3u8?token=secret#frag'),
    'https://cdn.example.net/live/a.m3u8',
  );
});
test('hasSecretMaterial detects tokens', () => {
  assert.equal(policy.hasSecretMaterial('https://cdn.example.net/a.m3u8?token=1'), true);
  assert.equal(policy.hasSecretMaterial('https://cdn.example.net/a.m3u8'), false);
});
test('stream target round-trips through base64url', () => {
  const url = 'https://cdn.example.net/live/a.m3u8?token=abc/+=';
  const token = policy.encodeStreamTarget(url);
  assert.ok(!token.includes('/') && !token.includes('+') && !token.includes('='), 'token must be url safe');
  assert.equal(policy.decodeStreamTarget(token), url);
});
test('decodeStreamTarget rejects junk', () => {
  for (const bad of ['', 'a/b', 'has space', 'x'.repeat(5000)]) assert.throws(() => policy.decodeStreamTarget(bad));
});

/* -------------------------------------------------------------------- parser */

const FIXTURE = `#EXTM3U
#EXTINF:-1 tvg-id="AlIraqia.iq@SD" tvg-logo="https://cdn.example.net/logo.png" group-title="Iraq;News",Al Iraqia (1080p)
https://imn-live.esite-lab.com/hls/iraqia-general.m3u8
#EXTINF:-1 tvg-id="AfaqTV.iq@SD",Afaq TV
https://stream.afaq.iq/live/channel/afaqtv/playlist.m3u8
#EXTINF:-1 tvg-id="AfaqTV.iq@SD",Afaq TV duplicate
https://stream.afaq.iq/live/channel/afaqtv/playlist.m3u8
#EXTINF:-1 tvg-id="MiranTV.iq@SD",Miran TV
http://insecure.example.org/miran.m3u8
#EXTINF:-1 tvg-id="Blocked.iq@SD",Blocked channel
#EXTVLCOPT:http-referrer=https://example.org
https://cdn.example.net/blocked.m3u8
#EXTINF:-1 tvg-id="NoName.iq@SD" tvg-name=""
https://cdn.example.net/noname.m3u8
#EXTINF:-1 tvg-id="Deep.iq@SD",Deep link
https://cdn.example.net/a.m3u8?token=supersecret&user=42
#EXTINF:-1 tvg-id="Priv.iq@SD",Private host
https://10.1.2.3/internal.m3u8
`;

test('parser requires an #EXTM3U header', () => assert.throws(() => parser.parseM3U('<html></html>'), /NOT_A_PLAYLIST/));
test('parser rejects oversized input', () =>
  assert.throws(() => parser.parseM3U(`#EXTM3U\n${'x'.repeat(9 * 1024 * 1024)}`), /PLAYLIST_TOO_LARGE/));

test('parser counts raw entries, duplicates, invalid and unnamed', () => {
  const { report } = parser.parseM3U(FIXTURE);
  assert.equal(report.raw, 8, 'eight #EXTINF blocks in the fixture');
  assert.equal(report.duplicates, 1, 'identical url counted once');
  assert.equal(report.unnamed, 1, 'empty name is reported, not published');
  assert.equal(report.invalid, 3, 'http, player-options and private host');
});

test('parser marks only public https manifests playable', () => {
  const { channels } = parser.parseM3U(FIXTURE);
  const byName = Object.fromEntries(channels.map((channel) => [channel.name, channel]));
  assert.equal(byName['Al Iraqia (1080p)'].playable, true);
  assert.equal(byName['Afaq TV'].playable, true);
  assert.equal(byName['Miran TV'].playable, false);
  assert.equal(byName['Miran TV'].blockedReason, 'INSECURE_SCHEME');
  assert.equal(byName['Blocked channel'].playable, false);
  assert.equal(byName['Blocked channel'].blockedReason, 'PLAYER_OPTIONS');
  assert.equal(byName['Private host'].playable, false);
  assert.equal(byName['Private host'].blockedReason, 'IP_LITERAL');
});

test('parser normalises group-title to a slash path', () => {
  const { channels } = parser.parseM3U(FIXTURE);
  assert.equal(channels.find((channel) => channel.name === 'Al Iraqia (1080p)').group, 'Iraq/News');
});

test('parser keeps only safe https logos', () => {
  const { channels } = parser.parseM3U(FIXTURE);
  assert.equal(channels.find((channel) => channel.name === 'Al Iraqia (1080p)').logo, 'https://cdn.example.net/logo.png');
  const { channels: insecure } = parser.parseM3U(
    `#EXTM3U\n#EXTINF:-1 tvg-logo="http://cdn.example.net/a.png",A\nhttps://cdn.example.net/a.m3u8\n` +
      `#EXTINF:-1 tvg-logo="https://cdn.example.net/a.svg?x=1",B\nhttps://cdn.example.net/b.m3u8\n`,
  );
  assert.equal(insecure[0].logo, undefined);
  assert.equal(insecure[1].logo, undefined);
});

test('parser never leaks query secrets into the channel record', () => {
  const { channels } = parser.parseM3U(FIXTURE);
  assert.ok(!JSON.stringify(channels).includes('supersecret'), 'token must not be serialised');
});

test('provider URLs live in a side table, never on the channel object', () => {
  const { channels, urls } = parser.parseM3U(FIXTURE);
  const serialised = JSON.stringify(channels);
  assert.ok(!serialised.includes('esite-lab.com'), 'channel objects must not carry provider hosts');
  assert.ok(!serialised.includes('supersecret'), 'channel objects must not carry tokens');
  const deepLink = channels.find((channel) => channel.name === 'Deep link');
  assert.equal(urls.get(deepLink.id), 'https://cdn.example.net/a.m3u8?token=supersecret&user=42', 'the server keeps the real URL separately');
  for (const channel of channels) {
    assert.ok(!Object.values(channel).some((value) => typeof value === 'string' && value.includes('token=')), channel.name);
  }
});

test('mergeFeeds preserves the url side table', () => {
  const operator = parser.parseM3U(`#EXTM3U\n#EXTINF:-1,Al Iraqia\nhttps://operator.example.net/a.m3u8\n`);
  const merged = parser.mergeFeeds([operator, parser.parseM3U(FIXTURE)]);
  const iraqia = merged.channels.find((channel) => channel.name === 'Al Iraqia');
  assert.equal(merged.urls.get(iraqia.id), 'https://operator.example.net/a.m3u8');
  // The inline FIXTURE has two playable entries, and the operator adds one more.
  assert.equal(merged.urls.size, 3);
  for (const channel of merged.channels.filter((entry) => entry.playable)) {
    assert.ok(merged.urls.has(channel.id), `${channel.name} must keep a server-side url`);
  }
});

test('parser produces stable ids across identical runs', () => {
  const first = parser.parseM3U(FIXTURE).channels.map((channel) => channel.id);
  const second = parser.parseM3U(FIXTURE).channels.map((channel) => channel.id);
  assert.deepEqual(first, second);
});

test('parser dedupes the same channel name with different quality suffix', () => {
  const { report } = parser.parseM3U(
    `#EXTM3U\n#EXTINF:-1,Al Sharqiya (1080p)\nhttps://cdn.example.net/a.m3u8\n` +
      `#EXTINF:-1,Al Sharqiya (720p)\nhttps://cdn.example.net/b.m3u8\n`,
  );
  assert.equal(report.duplicates, 1);
});

test('parser strips control characters and bidi overrides from names', () => {
  const { channels } = parser.parseM3U(`#EXTM3U\n#EXTINF:-1,A\u202eB\u0000C\nhttps://cdn.example.net/a.m3u8\n`);
  assert.equal(channels[0].name, 'A B C');
});

test('parser stops at the channel cap instead of growing without bound', () => {
  const body = Array.from({ length: 40 }, (_, index) => `#EXTINF:-1,Channel ${index}\nhttps://cdn.example.net/${index}.m3u8`).join('\n');
  const { channels } = parser.parseM3U(`#EXTM3U\n${body}`);
  assert.equal(channels.length, 40);
});

test('mergeFeeds lets the operator feed win over the public feed', () => {
  const operator = parser.parseM3U(`#EXTM3U\n#EXTINF:-1,Al Iraqia\nhttps://operator.example.net/a.m3u8\n`);
  const publicFeed = parser.parseM3U(FIXTURE);
  const merged = parser.mergeFeeds([operator, publicFeed]);
  const iraqia = merged.channels.filter((channel) => channel.name.toLowerCase().includes('al iraqia'));
  assert.equal(iraqia.length, 1, 'one Al Iraqia only');
  assert.equal(iraqia[0].name, 'Al Iraqia');
  assert.ok(merged.report.duplicates >= 1);
});


/* --------------------------------------------------- real iptv-org iq fixture */
/* Numbers below were produced by parsing the committed fixture. If the parser
 * changes, this test tells us exactly which counter moved. */

const fs = require('fs');
const crypto = require('crypto');

const FIXTURE_PATH = path.join(ROOT, 'apps/web/test-fixtures/iptv-org-iq-2026-11-03.m3u');

test('real Iraq fixture is present and byte-identical to the pinned export', () => {
  const bytes = fs.readFileSync(FIXTURE_PATH);
  assert.equal(bytes.length, 8445);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'd68091aec7d3383f1f52f7918d6a7dcf1966bf0ae8574c9274501e7c4dab3464');
});

test('real Iraq fixture parses to the measured numbers', () => {
  const { channels, report } = parser.parseM3U(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert.deepEqual(report, { total: 61, duplicates: 11, invalid: 6, playerOptionOnly: 1, unnamed: 0, raw: 72 });
  assert.equal(channels.length, 61);
  assert.equal(channels.filter((channel) => channel.playable).length, 55);
});

test('real Iraq fixture: only http:// and player-option entries are blocked', () => {
  const { channels } = parser.parseM3U(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const blocked = channels.filter((channel) => !channel.playable);
  assert.equal(blocked.length, 6);
  for (const channel of blocked) {
    assert.ok(['INSECURE_SCHEME', 'PLAYER_OPTIONS'].includes(channel.blockedReason), `${channel.name}: ${channel.blockedReason}`);
  }
});

test('real Iraq fixture: duplicate names are collapsed, not duplicated in the UI', () => {
  const { channels } = parser.parseM3U(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const names = channels.map((channel) => channel.name.replace(/\s*\(\d{3,4}p\)\s*/g, '').toLowerCase());
  assert.equal(new Set(names).size, names.length, 'no two visible channel names may collide');
});

test('real Iraq fixture: every playable channel has a stable id and no query secrets', () => {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const first = parser.parseM3U(raw).channels;
  const second = parser.parseM3U(raw).channels;
  assert.deepEqual(first.map((channel) => channel.id), second.map((channel) => channel.id));
  const serialised = JSON.stringify(first);
  assert.ok(!/token=|password=|api[_-]?key=/i.test(serialised), 'no credential-shaped strings');
});

function realFixtureSummary() {
  const { channels, report } = parser.parseM3U(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  const playable = channels.filter((channel) => channel.playable).length;
  return `${report.raw} raw entries -> ${report.total} channels ` +
    `(${report.duplicates} duplicates collapsed, ${report.invalid} unplayable, ${report.unnamed} unnamed) -> ` +
    `${playable} playable, ${channels.length - playable} blocked`;
}

/* -------------------------------------------------------------------- report */
/* -------------------------------------------------------------------- report */

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  if (result.ok) console.log(`  ok   ${result.name}`);
  else console.log(`  FAIL ${result.name}\n         ${result.error}`);
}
console.log(`\nREAL FIXTURE  ${realFixtureSummary()}`);
console.log(`${results.length - failed.length}/${results.length} live parser + URL policy tests passed`);
if (failed.length) {
  process.exitCode = 1;
  console.error(`${failed.length} FAILED`);
}
