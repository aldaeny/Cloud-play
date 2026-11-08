/**
 * Tests for the free-to-air satellite reference.
 *
 * The critical invariant: this data set must NEVER become a playable channel
 * list. It exists precisely because these networks have no verifiable open web
 * stream, so the tests assert there is no stream URL, no player, and no
 * encrypted transponder anywhere in it.
 *
 * Run: npm run test:fta --workspace aether-web
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

function compile() {
  const out = mkdtempSync(path.join(webRoot, '.fta-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/free-to-air.ts',
    'src/lib/country-flag.ts',
    '--outDir', out,
    '--rootDir', '.',
    '--module', 'commonjs',
    '--target', 'es2022',
    '--skipLibCheck',
  ], { cwd: webRoot, stdio: 'pipe' });
  return out;
}

const out = compile();
let entries = [];
let mod;
try {
  mod = await import(pathToFileURL(path.join(out, 'src/server/free-to-air.js')).href);
  const { countryFlag } = await import(pathToFileURL(path.join(out, 'src/lib/country-flag.js')).href);
  entries = mod.getFreeToAir();

  console.log('\nFree-to-air reference\n');

  await check('the reference is non-empty', () => {
    assert.ok(entries.length >= 2, `expected >= 2 entries, got ${entries.length}`);
  });

  await check('Al Kass and Thmanyah are both present', () => {
    const ids = entries.map(e => e.id);
    assert.ok(ids.includes('alkass'), 'Al Kass missing');
    assert.ok(ids.includes('thmanyah'), 'Thmanyah missing');
  });

  await check('NO entry carries a stream URL of any kind', () => {
    for (const entry of entries) {
      for (const key of Object.keys(entry)) {
        assert.ok(!/stream|playlist|m3u8|hls/i.test(key), `${entry.id} exposes a stream-like field: ${key}`);
      }
      assert.ok(!JSON.stringify(entry).includes('.m3u8'), `${entry.id} contains an m3u8 URL`);
    }
  });

  await check('ids are unique', () => {
    assert.equal(new Set(entries.map(e => e.id)).size, entries.length);
  });

  await check('every entry has bilingual names, coverage, status and broadcaster', () => {
    for (const entry of entries) {
      for (const key of ['nameAr', 'nameEn', 'coverageAr', 'coverageEn', 'webStatusAr', 'webStatusEn', 'broadcaster']) {
        assert.ok(typeof entry[key] === 'string' && entry[key].trim().length > 3, `${entry.id}.${key} is empty`);
      }
    }
  });

  await check('official pages are HTTPS and credential-free', () => {
    for (const entry of entries) {
      const url = new URL(entry.officialUrl);
      assert.equal(url.protocol, 'https:', `${entry.id} is not HTTPS`);
      assert.equal(url.username, '', `${entry.id} has embedded credentials`);
      assert.equal(url.password, '', `${entry.id} has embedded credentials`);
    }
  });

  await check('every entry lists at least one free transponder', () => {
    for (const entry of entries) assert.ok(entry.bands.length > 0, `${entry.id} has no bands`);
  });

  await check('Al Kass does NOT list the encrypted 10770 transponder', () => {
    const alkass = entries.find(e => e.id === 'alkass');
    assert.ok(alkass, 'Al Kass missing');
    assert.ok(!alkass.bands.some(b => b.frequency === 10770), 'encrypted Al Kass 5–8 transponder must never be listed as free');
  });

  await check('the status text names the encryption boundary for Al Kass', () => {
    const alkass = entries.find(e => e.id === 'alkass');
    assert.ok(/مشفّرة/.test(alkass.webStatusAr), 'Arabic status must state 5–8 are encrypted');
    assert.ok(/encrypted/i.test(alkass.webStatusEn), 'English status must state 5–8 are encrypted');
  });

  await check('tuning values are physically sane', () => {
    for (const entry of entries) {
      for (const band of entry.bands) {
        assert.ok(band.frequency > 10000 && band.frequency < 13000, `${entry.id} frequency out of Ku band`);
        assert.ok(['H', 'V'].includes(band.polarization), `${entry.id} bad polarization`);
        assert.ok(band.symbolRate >= 1000 && band.symbolRate <= 45000, `${entry.id} bad symbol rate`);
        assert.ok(/^\d\/\d$/.test(band.fec), `${entry.id} bad FEC`);
        assert.ok(/DVB-S2?/.test(band.standard), `${entry.id} bad standard`);
        assert.ok(band.satellite.trim().length > 3, `${entry.id} missing satellite name`);
      }
    }
  });

  await check('Thmanyah and Al Kass frequencies are not conflated across satellites', () => {
    const thmanyah = entries.find(e => e.id === 'thmanyah');
    const alkass = entries.find(e => e.id === 'alkass');
    // Both use 11919 but on different satellites/polarizations — the pair
    // (satellite, frequency, polarization) must stay distinct.
    const key = b => `${b.satellite}|${b.frequency}|${b.polarization}`;
    const thKeys = thmanyah.bands.map(key);
    for (const band of alkass.bands) assert.ok(!thKeys.includes(key(band)), `collision on ${key(band)}`);
  });

  await check('every country renders a real flag, not a boxed letter', () => {
    for (const entry of entries) {
      const flag = countryFlag(entry.country);
      const points = [...flag].map(c => c.codePointAt(0));
      assert.equal(points.length, 2, `${entry.country} produced ${points.length} code points`);
      assert.ok(points.every(p => p >= 0x1f1e6 && p <= 0x1f1ff), `${entry.country} is not a regional-indicator pair`);
    }
  });

  await check('the guard rejects malformed entries', () => {
    const base = entries[0];
    const bad = [
      { ...base, officialUrl: 'http://example.com/' },
      { ...base, officialUrl: 'not a url' },
      { ...base, officialUrl: 'https://user:pass@example.com/' },
      { ...base, bands: [] },
      { ...base, bands: [{ ...base.bands[0], frequency: 999 }] },
      { ...base, bands: [{ ...base.bands[0], polarization: 'X' }] },
      { ...base, nameAr: '' },
    ];
    const original = mod.FREE_TO_AIR;
    for (const entry of bad) {
      original.length = 0;
      original.push(entry);
      assert.equal(mod.getFreeToAir().length, 0, `guard accepted ${JSON.stringify(entry.officialUrl)}`);
    }
    original.length = 0;
    original.push(base);
    assert.equal(mod.getFreeToAir().length, 1);
  });

  await check('the component renders no player, video element or stream source', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/FtaReference.tsx'), 'utf8');
    assert.ok(!/<video|MediaViewer|VideoPlayer|\.m3u8|streamUrl/i.test(src), 'FtaReference must not contain a player or stream');
    assert.ok(/notPlayable/.test(src), 'component must label entries as not playable');
    assert.ok(/rel="noopener noreferrer"/.test(src), 'external link must be safe');
  });

  await check('the reference is wired into the curated live view', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/LiveTv.tsx'), 'utf8');
    assert.ok(/import FtaReference/.test(src), 'FtaReference not imported');
    assert.ok(/<FtaReference language=\{language\} \/>/.test(src), 'FtaReference not rendered');
    assert.ok(/mode === 'curated'/.test(src), 'must only render in curated mode');
  });

  await check('styles exist and stay inside the existing design tokens', () => {
    const css = readFileSync(path.join(webRoot, 'src/styles/public-tv.css'), 'utf8');
    for (const cls of ['.fta ', '.fta-card', '.fta-table', '.fta-badge', '.fta-note']) {
      assert.ok(css.includes(cls), `missing style ${cls}`);
    }
    assert.ok(css.includes('var(--glass-surface)'), 'cards must reuse the glass token');
  });

  await check('the new sports streams are in the curated playable list', () => {
    const src = readFileSync(path.join(webRoot, 'src/server/public-tv.ts'), 'utf8');
    assert.ok(src.includes("id: 'iraqia-sport'"), 'Iraqia Sport missing');
    assert.ok(src.includes("id: 'oman-sport'"), 'Oman Sports missing');
    assert.ok(src.includes('imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8'), 'Iraqia stream URL missing');
    assert.ok(src.includes('partneta.cdn.mgmlcdn.com/omsport'), 'Oman stream URL missing');
  });

  await check('no non-Arabic stray words leaked into the Arabic copy', () => {
    const src = readFileSync(path.join(webRoot, 'src/server/free-to-air.ts'), 'utf8');
    assert.ok(!/\bdengan\b|\bdan\b|\bthe\b/i.test(src.split('webStatusAr:')[1]?.split('\n')[0] ?? ''), 'stray foreign word in Arabic copy');
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
