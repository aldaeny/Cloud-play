/**
 * Tests for the where-to-watch rights guide.
 *
 * Load-bearing invariants: the guide is informational only (never a stream
 * list), it never labels a paid rights holder as free, and every "watch inside
 * the platform" link points at a channel that actually exists in the curated
 * list.
 *
 * Run: npm run test:rights --workspace aether-web
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
  const out = mkdtempSync(path.join(webRoot, '.rights-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/competition-rights.ts',
    'src/server/public-tv.ts',
    '--outDir', out,
    '--rootDir', '.',
    '--module', 'commonjs',
    '--target', 'es2022',
    '--skipLibCheck',
  ], { cwd: webRoot, stdio: 'pipe' });
  return out;
}

const out = compile();
try {
  const mod = await import(pathToFileURL(path.join(out, 'src/server/competition-rights.js')).href);
  const tv = await import(pathToFileURL(path.join(out, 'src/server/public-tv.js')).href);
  const comps = mod.getCompetitionRights();
  const channels = tv.getPublicChannels();

  console.log('\nWhere-to-watch rights guide\n');

  await check('the guide covers the leagues people actually ask for', () => {
    const ids = comps.map(c => c.id);
    for (const id of ['premier-league', 'laliga', 'roshn-league', 'iraqi-league']) {
      assert.ok(ids.includes(id), `${id} missing`);
    }
  });

  await check('NO stream URL anywhere in the guide data', () => {
    const json = JSON.stringify(comps);
    assert.ok(!json.includes('.m3u8'), 'guide contains an m3u8 URL');
    assert.ok(!/"streamUrl"/.test(json), 'guide contains a streamUrl field');
  });

  await check('Premier League is never presented as free', () => {
    const pl = comps.find(c => c.id === 'premier-league');
    assert.ok(pl.platforms.every(p => p.access === 'paid'), 'a Premier League platform is marked free');
    assert.ok(/ما فيه قناة مفتوحة/.test(pl.verdictAr), 'Arabic verdict must state there is no free channel');
    assert.ok(/No free-to-air/i.test(pl.verdictEn), 'English verdict must state there is no free channel');
  });

  await check('beIN and TOD are marked paid everywhere they appear', () => {
    for (const comp of comps) {
      for (const p of comp.platforms) {
        if (/beIN|^TOD$/i.test(p.nameEn)) {
          assert.equal(p.access, 'paid', `${comp.id}/${p.id} must be paid`);
        }
      }
    }
  });

  await check('the Iraq-specific 1001 sharing is stated and sourced to beIN', () => {
    const laliga = comps.find(c => c.id === 'laliga');
    const p = laliga.platforms.find(x => x.id === '1001-laliga');
    assert.ok(p, '1001 platform missing');
    assert.ok(/1001/.test(laliga.verdictAr), 'Arabic verdict must mention 1001');
    assert.ok(/العراق/.test(laliga.territoryAr), 'territory must name Iraq');
    assert.ok(laliga.sourceUrl.includes('beinmediagroup.com'), 'must cite the official beIN release');
    assert.equal(p.officialUrl, 'https://1001.tv/');
  });

  await check('1001 is not overclaimed as fully free', () => {
    const p = comps.find(c => c.id === 'laliga').platforms.find(x => x.id === '1001-laliga');
    assert.equal(p.access, 'freemium', 'sponsorship may lapse — must not claim unconditional free');
    assert.ok(/تحقّق داخل التطبيق/.test(p.accessAr), 'Arabic cost must tell the user to verify in-app');
    assert.ok(/check inside the app/i.test(p.accessEn), 'English cost must tell the user to verify in-app');
  });

  await check('Al Sharqiya is described as highlights, not full live matches', () => {
    const p = comps.find(c => c.id === 'laliga').platforms.find(x => x.id === 'alsharqiya-laliga');
    assert.equal(p.access, 'free');
    assert.ok(/ليست مباريات كاملة/.test(p.scopeAr), 'must not imply full live matches');
    assert.ok(/not full live matches/i.test(p.scopeEn), 'must not imply full live matches');
  });

  await check('every "watch inside the platform" link resolves to a real curated channel', () => {
    const ids = new Set(channels.map(c => c.id));
    let links = 0;
    for (const comp of comps) {
      for (const p of comp.platforms) {
        if (p.inAppChannelId) {
          links++;
          assert.ok(ids.has(p.inAppChannelId), `${p.id} links to nonexistent channel ${p.inAppChannelId}`);
        }
      }
    }
    assert.ok(links >= 2, `expected >= 2 in-app links, got ${links}`);
  });

  await check('in-app links only ever point at free platforms', () => {
    for (const comp of comps) {
      for (const p of comp.platforms) {
        if (p.inAppChannelId) assert.equal(p.access, 'free', `${p.id} links in-app but is not free`);
      }
    }
  });

  await check('the anchor targets exist in the rendered card markup', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PublicTv.tsx'), 'utf8');
    assert.ok(/id=\{channel\.id\}/.test(src), 'cards need an id so guide anchors resolve');
  });

  await check('every platform and source URL is HTTPS and credential-free', () => {
    for (const comp of comps) {
      for (const url of [comp.sourceUrl, ...comp.platforms.map(p => p.officialUrl)]) {
        const u = new URL(url);
        assert.equal(u.protocol, 'https:', `${url} is not HTTPS`);
        assert.equal(u.username, '');
        assert.equal(u.password, '');
      }
    }
  });

  await check('every competition cites an official source with a bilingual label', () => {
    for (const comp of comps) {
      assert.ok(comp.sourceLabelAr.trim().length > 5, `${comp.id} missing Arabic source label`);
      assert.ok(comp.sourceLabelEn.trim().length > 5, `${comp.id} missing English source label`);
    }
  });

  await check('Arabic commentary is claimed for every listed platform', () => {
    for (const comp of comps) {
      for (const p of comp.platforms) {
        assert.equal(p.arabicCommentary, true, `${p.id} does not offer Arabic commentary and should not be listed`);
      }
    }
  });

  await check('getFreeOptions returns only genuinely free platforms', () => {
    const free = mod.getFreeOptions();
    assert.ok(free.length >= 3, `expected >= 3 free options, got ${free.length}`);
    assert.ok(free.every(p => p.access === 'free'));
    assert.ok(!free.some(p => /beIN|^TOD$/i.test(p.nameEn)), 'a paid holder leaked into free options');
  });

  await check('ids are unique across competitions and platforms', () => {
    assert.equal(new Set(comps.map(c => c.id)).size, comps.length);
    const platformIds = comps.flatMap(c => c.platforms.map(p => p.id));
    assert.equal(new Set(platformIds).size, platformIds.length);
  });

  await check('the guard rejects malformed entries', () => {
    const original = mod.COMPETITION_RIGHTS;
    const base = original[0];
    const snapshot = [...original];
    const bad = [
      { ...base, sourceUrl: 'http://example.com/' },
      { ...base, sourceUrl: 'not a url' },
      { ...base, platforms: [] },
      { ...base, verdictAr: '' },
      { ...base, platforms: [{ ...base.platforms[0], officialUrl: 'https://u:p@example.com/' }] },
      { ...base, platforms: [{ ...base.platforms[0], access: 'whatever' }] },
    ];
    for (const entry of bad) {
      original.length = 0;
      original.push(entry);
      assert.equal(mod.getCompetitionRights().length, 0, `guard accepted ${JSON.stringify(entry.sourceUrl)}`);
    }
    original.length = 0;
    original.push(...snapshot);
    assert.equal(mod.getCompetitionRights().length, snapshot.length);
  });

  await check('the component renders no player and no stream', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/RightsGuide.tsx'), 'utf8');
    assert.ok(!/<video|MediaViewer|VideoPlayer|\.m3u8|streamUrl/i.test(src), 'RightsGuide must not contain a player or stream');
    assert.ok((src.match(/rel="noopener noreferrer"/g) ?? []).length >= 2, 'external links must be safe');
    assert.ok(/rg-caution/.test(src), 'must warn about unlicensed restreams');
  });

  await check('the guide is wired into the curated live view', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/LiveTv.tsx'), 'utf8');
    assert.ok(/import RightsGuide/.test(src), 'RightsGuide not imported');
    assert.ok(/<RightsGuide language=\{language\} \/>/.test(src), 'RightsGuide not rendered');
  });

  await check('styles exist and reuse the existing design tokens', () => {
    const css = readFileSync(path.join(webRoot, 'src/styles/public-tv.css'), 'utf8');
    for (const cls of ['.rg ', '.rg-comp', '.rg-platform', '.rg-badge.free', '.rg-badge.paid', '.rg-caution']) {
      assert.ok(css.includes(cls), `missing style ${cls}`);
    }
    assert.ok(css.includes('var(--glass-surface)'), 'cards must reuse the glass token');
  });

  await check('no stray non-Arabic words leaked into the Arabic copy', () => {
    const src = readFileSync(path.join(webRoot, 'src/server/competition-rights.ts'), 'utf8');
    assert.ok(!/\(shared\)|\bdengan\b/i.test(src), 'stray foreign word in Arabic copy');
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
