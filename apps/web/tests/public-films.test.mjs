/**
 * Tests for the PUBLIC film library and its resolver route.
 *
 * Offline/structural: they assert the curation rules hold, that the library is
 * genuinely public (no auth, no env gate), and that the resolver refuses dark or
 * unplayable Archive items instead of handing the player a broken URL.
 * Archive.org is stubbed — real item availability was checked separately.
 *
 * Run: npm run test:films --workspace aether-web
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
  const out = mkdtempSync(path.join(webRoot, '.public-test-'));
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc,
    'src/server/public-films.ts',
    'pages/api/movies/watch/[id].ts',
    '--outDir', out,
    '--module', 'commonjs',
    '--target', 'es2022',
    '--moduleResolution', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--strict',
    '--types', 'node',
  ], { cwd: webRoot, stdio: 'pipe' });
  return out;
}

function invoke(handler, { method = 'GET', id = '' } = {}) {
  const headers = {};
  let status = 0;
  let body = null;
  const res = {
    setHeader(name, value) { headers[name.toLowerCase()] = value; return this; },
    status(code) { status = code; return this; },
    json(value) { body = value; return this; },
    redirect(code, location) { status = code; headers.location = location; return this; },
  };
  return Promise.resolve(handler({ method, query: { id }, headers: {} }, res))
    .then(() => ({ status, body, headers }));
}

/** Replace global fetch for one call. */
async function withFetch(stub, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

const ok = metadata => async () => ({ ok: true, status: 200, json: async () => metadata });

const GENRES = ['classic', 'noir', 'comedy', 'horror', 'western', 'family', 'adventure', 'animation'];

async function main() {
  const out = compile();
  const mod = await import(pathToFileURL(path.join(out, 'src/server/public-films.js')).href);
  const routeMod = await import(pathToFileURL(path.join(out, 'pages/api/movies/watch/[id].js')).href);
  const handler = routeMod.default?.default ?? routeMod.default;
  const films = mod.PUBLIC_FILMS;
  const archiveFilms = films.filter(f => f.archiveId);

  console.log('\nPublic film library\n');

  await check('the library is substantial', () => {
    assert.ok(films.length >= 30, `expected >= 30 films, got ${films.length}`);
    assert.ok(archiveFilms.length >= 25, `expected >= 25 Archive films, got ${archiveFilms.length}`);
  });

  await check('ids are unique and URL-safe', () => {
    assert.equal(new Set(films.map(f => f.id)).size, films.length);
    for (const film of films) assert.match(film.id, /^[a-z0-9-]+$/, `bad id ${film.id}`);
  });

  await check('every film has complete bilingual metadata', () => {
    for (const film of films) {
      assert.ok(film.title && film.titleAr, `title missing for ${film.id}`);
      assert.ok(film.ar && film.en, `description missing for ${film.id}`);
      assert.match(film.year, /^\d{4}$/, `bad year for ${film.id}`);
      assert.ok(GENRES.includes(film.genre), `bad genre for ${film.id}`);
    }
  });

  await check('every film carries a license, credit and https source', () => {
    for (const film of films) {
      assert.ok(['public-domain', 'cc-by'].includes(film.license), `bad license for ${film.id}`);
      assert.ok(film.licenseLabel && film.credit, `attribution missing for ${film.id}`);
      assert.ok(film.licenseUrl.startsWith('https://'), `license url for ${film.id}`);
      assert.ok(film.source.startsWith('https://'), `source url for ${film.id}`);
    }
  });

  await check('posters are https and watch urls are same-origin or https', () => {
    for (const film of films) {
      assert.ok(mod.filmPoster(film).startsWith('https://'), `poster for ${film.id}`);
      const watch = mod.filmWatchUrl(film);
      assert.ok(watch.startsWith('/api/movies/watch/') || watch.startsWith('https://'), `watch url for ${film.id}`);
      // Casting requires a query-free URL.
      assert.ok(!watch.includes('?'), `watch url must not carry a query: ${film.id}`);
    }
  });

  await check('absoluteWatchUrl absolutises the resolver and passes direct files through', () => {
    const archiveFilm = archiveFilms[0];
    const absolute = mod.absoluteWatchUrl(archiveFilm, 'https://cloud-play-iraq.vercel.app');
    assert.equal(absolute, `https://cloud-play-iraq.vercel.app/api/movies/watch/${archiveFilm.id}`);
    const direct = films.find(f => f.url);
    assert.equal(mod.absoluteWatchUrl(direct, 'https://example.com'), direct.url);
  });

  await check('lookup rejects unknown ids', () => {
    assert.equal(mod.getPublicFilm('does-not-exist'), undefined);
    assert.equal(mod.getPublicFilm('bunny').id, 'bunny');
  });

  await check('route is public: no auth and no env configured', async () => {
    delete process.env.XTREAM_OWNER_EMAILS;
    delete process.env.XTREAM_CATALOG_ENABLED;
    const res = await invoke(handler, { id: 'bunny' });
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('https://'));
    assert.ok(/s-maxage=\d+/.test(res.headers['cache-control'] ?? ''), 'must be CDN-cacheable');
  });

  await check('route rejects unknown films and non-GET methods', async () => {
    assert.equal((await invoke(handler, { id: 'nope' })).status, 404);
    const post = await invoke(handler, { method: 'POST', id: 'bunny' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, 'GET, HEAD');
  });

  await check('resolver picks the best browser-playable MP4', async () => {
    const res = await withFetch(ok({
      files: [
        { name: 'cover.thumbs/cover_0001.jpg', format: 'Thumbnail Images' },
        { name: 'movie.ogv', format: 'Ogg Video', size: '900' },
        { name: 'movie.mkv', format: 'Matroska', size: '9000' },
        { name: 'movie_512kb.mp4', format: '512Kb h.264', size: '500' },
        { name: 'movie.mp4', format: 'h.264', size: '4000' },
      ],
    }), () => invoke(handler, { id: 'his-girl-friday' }));
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, 'https://archive.org/download/his_girl_friday/movie.mp4');
  });

  await check('resolver refuses dark (withdrawn) items', async () => {
    const res = await withFetch(ok({ is_dark: true, files: [{ name: 'x.mp4', format: 'h.264' }] }),
      () => invoke(handler, { id: 'royal-wedding' }));
    assert.equal(res.status, 410);
    assert.equal(res.body.error, 'FILM_UNAVAILABLE');
    assert.equal(res.headers.location, undefined);
  });

  await check('resolver refuses items with no playable file', async () => {
    const res = await withFetch(ok({ files: [{ name: 'x.ogv', format: 'Ogg Video' }, { name: 'y.thumbs/z.jpg' }] }),
      () => invoke(handler, { id: 'penny-serenade' }));
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'NO_PLAYABLE_FILE');
  });

  await check('resolver reports an unreachable source as 502', async () => {
    const down = await withFetch(async () => { throw new Error('network'); },
      () => invoke(handler, { id: 'gullivers-travels' }));
    assert.equal(down.status, 502);
    const bad = await withFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }),
      () => invoke(handler, { id: 'scarlet-street' }));
    assert.equal(bad.status, 502);
  });

  await check('resolver only ever redirects to archive.org', async () => {
    const res = await withFetch(ok({ files: [{ name: 'evil.mp4', format: 'h.264' }] }),
      () => invoke(handler, { id: 'the-stranger' }));
    assert.equal(res.status, 302);
    assert.equal(new URL(res.headers.location).hostname, 'archive.org');
  });

  await check('the library carries no private-provider references', () => {
    const text = JSON.stringify(films);
    for (const marker of ['xtream', 'redchicks', 'XTREAM_']) {
      assert.ok(!text.toLowerCase().includes(marker.toLowerCase()), `leaked ${marker}`);
    }
  });

  rmSync(out, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
}

main().catch(error => { console.error(error); process.exit(1); });
