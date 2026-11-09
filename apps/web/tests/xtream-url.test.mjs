/**
 * Tests for the Xtream playlist-URL builder and the M3U importer's move to the
 * shared pop-up player.
 *
 * The builder handles credentials, so the load-bearing checks are that it never
 * leaks them into the wrong URL component, never keeps a pasted path/query, and
 * refuses non-http schemes.
 *
 * Run: npm run test:xtream-url --workspace aether-web
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

const out = mkdtempSync(path.join(webRoot, '.xtream-url-test-'));
try {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc, 'src/lib/xtream-playlist-url.ts',
    '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
    '--target', 'es2022', '--skipLibCheck', '--strict',
  ], { cwd: webRoot, stdio: 'pipe' });

  const { buildXtreamPlaylistUrl } = await import(pathToFileURL(path.join(out, 'src/lib/xtream-playlist-url.js')).href);
  const parts = { server: 'http://example.com:8080', username: 'alice', password: 's3cret' };

  console.log('\nXtream playlist URL builder + M3U pop-up player\n');

  await check('builds the standard get.php m3u_plus URL', () => {
    const url = new URL(buildXtreamPlaylistUrl(parts));
    assert.equal(url.origin, 'http://example.com:8080');
    assert.equal(url.pathname, '/get.php');
    assert.equal(url.searchParams.get('username'), 'alice');
    assert.equal(url.searchParams.get('password'), 's3cret');
    assert.equal(url.searchParams.get('type'), 'm3u_plus');
    assert.equal(url.searchParams.get('output'), 'ts');
  });

  await check('assumes http when the provider omits the scheme', () => {
    const url = new URL(buildXtreamPlaylistUrl({ ...parts, server: 'example.com:8080' }));
    assert.equal(url.protocol, 'http:');
    assert.equal(url.host, 'example.com:8080');
  });

  await check('keeps https when the provider offers it', () => {
    const url = new URL(buildXtreamPlaylistUrl({ ...parts, server: 'https://example.com:2053' }));
    assert.equal(url.protocol, 'https:');
    assert.equal(url.port, '2053');
  });

  await check('discards a pasted path, query and fragment', () => {
    const url = new URL(buildXtreamPlaylistUrl({ ...parts, server: 'http://example.com:8080/panel/old.php?x=1#frag' }));
    assert.equal(url.pathname, '/get.php');
    assert.equal(url.hash, '');
    assert.equal(url.searchParams.get('x'), null);
  });

  await check('credentials never land in the URL userinfo', () => {
    const raw = buildXtreamPlaylistUrl({ ...parts, server: 'http://bob:hunter2@example.com:8080' });
    const url = new URL(raw);
    assert.equal(url.username, '', 'pasted userinfo must be stripped');
    assert.equal(url.password, '');
    assert.ok(!raw.includes('bob:hunter2@'), 'embedded credentials leaked into the URL');
    assert.equal(url.searchParams.get('username'), 'alice');
  });

  await check('percent-encodes special characters in credentials', () => {
    const url = new URL(buildXtreamPlaylistUrl({ ...parts, username: 'a b&c', password: 'p@ss/w?d#e' }));
    assert.equal(url.searchParams.get('username'), 'a b&c');
    assert.equal(url.searchParams.get('password'), 'p@ss/w?d#e');
    assert.ok(url.search.includes('%40') || url.search.includes('%2F'), 'special characters were not encoded');
  });

  await check('trims surrounding whitespace', () => {
    const url = new URL(buildXtreamPlaylistUrl({ server: '  http://example.com:8080  ', username: ' alice ', password: ' s3cret ' }));
    assert.equal(url.host, 'example.com:8080');
    assert.equal(url.searchParams.get('username'), 'alice');
    assert.equal(url.searchParams.get('password'), 's3cret');
  });

  await check('returns null when any field is empty', () => {
    for (const bad of [
      { ...parts, server: '' }, { ...parts, server: '   ' },
      { ...parts, username: '' }, { ...parts, password: '' },
    ]) assert.equal(buildXtreamPlaylistUrl(bad), null);
  });

  await check('refuses non-http schemes', () => {
    for (const server of ['ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/plain,hi']) {
      assert.equal(buildXtreamPlaylistUrl({ ...parts, server }), null, `accepted ${server}`);
    }
  });

  await check('refuses malformed or hostless input', () => {
    for (const server of ['http://', 'not a url', '::::', 'http://nohost']) {
      assert.equal(buildXtreamPlaylistUrl({ ...parts, server }), null, `accepted ${server}`);
    }
  });

  await check('the builder performs no network access', () => {
    const src = readFileSync(path.join(webRoot, 'src/lib/xtream-playlist-url.ts'), 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|axios/.test(src), 'builder must stay pure');
  });

  await check('the importer opens the shared pop-up player, not an inline viewer', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PlaylistImport.tsx'), 'utf8');
    assert.ok(/import \{ VideoPlayerModal \}/.test(src), 'pop-up player not imported');
    assert.ok(/<VideoPlayerModal/.test(src), 'pop-up player not rendered');
    assert.ok(!/MediaViewer/.test(src), 'the inline MediaViewer must be gone');
  });

  await check('stream type comes from the parsed container, not the proxy path', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PlaylistImport.tsx'), 'utf8');
    // The proxy URL is /api/playlist/stream?t=... with no extension, so sniffing
    // the path would mislabel MP4 sources as HLS.
    assert.ok(/streamType: row\.kind === 'hls' \? 'hls' : 'mp4'/.test(src), 'must trust the parsed kind');
    assert.ok(!/getStreamType\(row\.url\)/.test(src), 'must not sniff the opaque proxy URL');
  });

  await check('the importer shares the TV library favorites key', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PlaylistImport.tsx'), 'utf8');
    assert.ok(src.includes("'cloudplay-tv-favorites-v1'"), 'favorites key must match the rest of the TV library');
    assert.ok(/onFavoriteToggle=\{toggleFavorite\}/.test(src), 'star must be wired, not a no-op');
  });

  await check('the builder is collapsed by default and marks its toggle state', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PlaylistImport.tsx'), 'utf8');
    assert.ok(/useState\(false\);\n {2}const \[server/.test(src), 'builder should start collapsed');
    assert.ok(/aria-expanded=\{showXtream\}/.test(src), 'toggle needs aria-expanded');
    assert.ok(/type="password"/.test(src), 'the password field must be masked');
  });

  await check('the credentials hint and own-use notice are present in both languages', () => {
    const src = readFileSync(path.join(webRoot, 'src/components/iptv/PlaylistImport.tsx'), 'utf8');
    for (const key of ['helpTitle', 'helpBody', 'xtreamHint', 'ownUse', 'buildFailed']) {
      assert.equal((src.match(new RegExp(`${key}:`, 'g')) ?? []).length, 2, `${key} must exist in ar and en`);
    }
    assert.ok(/تبقى في متصفحك/.test(src), 'Arabic must state credentials stay in the browser');
    assert.ok(/stay in your browser/.test(src), 'English must state credentials stay in the browser');
  });

  await check('styles exist for the new help and builder panels', () => {
    const css = readFileSync(path.join(webRoot, 'src/styles/private-player.css'), 'utf8');
    for (const cls of ['.pli-help', '.pli-builder', '.pli-builder-toggle', '.pli-builder-body']) {
      assert.ok(css.includes(cls), `missing style ${cls}`);
    }
  });

  await check('the import endpoint stays owner-only and POST-only', () => {
    const src = readFileSync(path.join(webRoot, 'pages/api/playlist/import.ts'), 'utf8');
    assert.ok(/requireOwner\(req\)/.test(src), 'owner gate must remain');
    assert.ok(/req\.method !== 'POST'/.test(src), 'must stay POST so credentials avoid logs');
    assert.ok(/no-store/.test(src), 'response must not be cached');
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
