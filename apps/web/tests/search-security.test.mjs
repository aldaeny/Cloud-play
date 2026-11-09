/**
 * Tests for Arabic-aware search normalization and the security header policy.
 *
 * Run: npm run test:search-security --workspace aether-web
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

const out = mkdtempSync(path.join(webRoot, '.search-test-'));
try {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [
    tsc, 'src/lib/search-normalize.ts',
    '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
    '--target', 'es2022', '--skipLibCheck', '--strict',
  ], { cwd: webRoot, stdio: 'pipe' });

  const { normalizeForSearch, matchesSearch, searchBlob } =
    await import(pathToFileURL(path.join(out, 'src/lib/search-normalize.js')).href);

  console.log('\nArabic search normalization\n');

  await check('folds alef variants so bare alef finds hamza forms', () => {
    for (const variant of ['\u0623', '\u0625', '\u0622', '\u0671']) {
      assert.equal(normalizeForSearch(`${variant}\u062E\u0628\u0627\u0631`), normalizeForSearch('\u0627\u062E\u0628\u0627\u0631'));
    }
    assert.ok(matchesSearch('\u0627\u0644\u0623\u062E\u0628\u0627\u0631', '\u0627\u0644\u0627\u062E\u0628\u0627\u0631'));
  });

  await check('taa marbuta matches haa (الجزيره finds الجزيرة)', () => {
    assert.ok(matchesSearch('\u0627\u0644\u062C\u0632\u064A\u0631\u0629', '\u0627\u0644\u062C\u0632\u064A\u0631\u0647'));
    assert.ok(matchesSearch('\u0627\u0644\u0639\u0631\u0627\u0642\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0629', '\u0631\u064A\u0627\u0636\u064A\u0647'));
  });

  await check('alef maqsura matches yaa', () => {
    assert.ok(matchesSearch('\u0645\u0635\u0637\u0641\u0649', '\u0645\u0635\u0637\u0641\u064A'));
  });

  await check('hamza carriers fold to their base letters', () => {
    assert.ok(matchesSearch('\u0624\u0627\u0626\u0644', '\u0648\u0627\u0626\u0644'));
    assert.equal(normalizeForSearch('\u0626'), normalizeForSearch('\u064A'));
  });

  await check('strips harakat and tatweel', () => {
    const vocalized = '\u0627\u0644\u0652\u0639\u064e\u0631\u064e\u0627\u0642\u0650\u064A\u0651\u0629';
    assert.ok(matchesSearch(vocalized, '\u0627\u0644\u0639\u0631\u0627\u0642\u064A\u0629'));
    const stretched = '\u0627\u0644\u0639\u0640\u0640\u0631\u0627\u0642\u064A\u0629';
    assert.ok(matchesSearch(stretched, '\u0627\u0644\u0639\u0631\u0627\u0642\u064A\u0629'));
  });

  await check('Arabic-Indic and Persian digits match ASCII digits', () => {
    assert.equal(normalizeForSearch('\u0662\u0664'), '24');
    assert.equal(normalizeForSearch('\u06F2\u06F4'), '24');
    assert.ok(matchesSearch('Channel 24', '\u0662\u0664'));
    assert.ok(matchesSearch('\u0642\u0646\u0627\u0629 \u0662\u0664', '24'));
  });

  await check('token matching is order-independent', () => {
    const name = '\u0627\u0644\u0639\u0631\u0627\u0642\u064A\u0629 \u0627\u0644\u0631\u064A\u0627\u0636\u064A\u0629';
    assert.ok(matchesSearch(name, '\u0631\u064A\u0627\u0636\u064A\u0629 \u0639\u0631\u0627\u0642'));
    assert.ok(matchesSearch(name, '\u0639\u0631\u0627\u0642 \u0631\u064A\u0627\u0636\u064A\u0629'));
  });

  await check('every token must be present (no false positives)', () => {
    assert.equal(matchesSearch('\u0627\u0644\u062C\u0632\u064A\u0631\u0629', '\u062C\u0632\u064A\u0631\u0629 \u0631\u064A\u0627\u0636\u0629'), false);
  });

  await check('English matching stays case-insensitive', () => {
    assert.ok(matchesSearch('Al Jazeera Arabic', 'jazeera'));
    assert.ok(matchesSearch('Al Jazeera Arabic', 'ARABIC al'));
    assert.equal(matchesSearch('Al Jazeera', 'bbc'), false);
  });

  await check('mixed Arabic + English + digits works together', () => {
    assert.ok(matchesSearch('\u0627\u0644\u0643\u0648\u064A\u062A KTV 1', 'ktv \u0661'));
  });

  await check('an empty or blank query matches everything', () => {
    for (const query of ['', '   ', '\t\n']) {
      assert.equal(matchesSearch('anything', query), true);
      assert.equal(matchesSearch('', query), true);
    }
  });

  await check('a non-empty query never matches empty text', () => {
    assert.equal(matchesSearch('', 'x'), false);
  });

  await check('whitespace is collapsed, not significant', () => {
    assert.equal(normalizeForSearch('  a   b  '), 'a b');
    assert.ok(matchesSearch('Al   Jazeera', 'al jazeera'));
  });

  await check('non-string input degrades to empty instead of throwing', () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      assert.equal(normalizeForSearch(value), '');
    }
  });

  await check('searchBlob skips non-strings and normalizes once', () => {
    const blob = searchBlob('\u0627\u0644\u062C\u0632\u064A\u0631\u0629', null, 'Al Jazeera', 7);
    assert.ok(blob.includes('al jazeera'));
    assert.ok(blob.includes(normalizeForSearch('\u0627\u0644\u062C\u0632\u064A\u0631\u0629')));
    assert.ok(!blob.includes('7'));
  });

  await check('normalization is idempotent', () => {
    for (const sample of ['\u0627\u0644\u062C\u0632\u064A\u0631\u0629', 'Al Jazeera', '\u0662\u0664 HD', '\u0645\u064f\u0635\u0637\u0641\u0649']) {
      const once = normalizeForSearch(sample);
      assert.equal(normalizeForSearch(once), once);
    }
  });

  await check('all four search surfaces use the normalizer', () => {
    const targets = [
      'src/components/iptv/PublicTv.tsx',
      'src/components/iptv/PrivatePlayer.tsx',
      'src/components/iptv/PlaylistImport.tsx',
      'src/components/movies/OpenMovies.tsx',
    ];
    for (const file of targets) {
      const src = readFileSync(path.join(webRoot, file), 'utf8');
      assert.ok(/from '\.\.\/\.\.\/lib\/search-normalize'/.test(src), `${file} does not import the normalizer`);
      assert.ok(/matchesSearch\(/.test(src), `${file} does not call matchesSearch`);
      assert.ok(!/toLowerCase\(\)\.includes\(needle\)/.test(src), `${file} still uses raw substring matching`);
    }
  });

  console.log('\nSecurity headers\n');
  const { securityHeaders, contentSecurityPolicy } = require(path.join(webRoot, 'security-headers.js'));
  const prod = securityHeaders(true);
  const dev = securityHeaders(false);
  const value = (rows, key) => rows.find(row => row.key === key)?.value;

  await check('production sets CSP, HSTS and frame protection', () => {
    assert.ok(value(prod, 'Content-Security-Policy'));
    assert.equal(value(prod, 'X-Frame-Options'), 'SAMEORIGIN');
    assert.match(value(prod, 'Strict-Transport-Security'), /max-age=31536000/);
    assert.match(value(prod, 'Strict-Transport-Security'), /includeSubDomains/);
  });

  await check('CSP blocks the dangerous vectors', () => {
    const csp = value(prod, 'Content-Security-Policy');
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.ok(!/default-src \*/.test(csp), 'default-src must not be wildcard');
  });

  await check('CSP allows what the player and auth actually need', () => {
    const csp = value(prod, 'Content-Security-Policy');
    assert.match(csp, /media-src 'self' https: blob:/, 'MSE playback needs blob: and https:');
    assert.match(csp, /connect-src 'self' https:/, 'hls.js/dash.js and Supabase need https:');
    assert.match(csp, /img-src 'self' https: data: blob:/, 'broadcaster logos need https:');
    assert.match(csp, /script-src 'self' 'unsafe-inline'/, 'Next hydration needs inline scripts until nonces land');
  });

  await check('CSP allows every external script origin the code actually loads', () => {
    // Guard against a future CSP edit silently breaking an existing feature
    // (this caught the Chromecast SDK being blocked).
    const csp = value(prod, 'Content-Security-Policy');
    const scriptSrc = csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src '));
    const sources = [
      readFileSync(path.join(webRoot, 'src/components/player/castWeb.ts'), 'utf8'),
    ].join('\n');
    const origins = new Set(
      [...sources.matchAll(/script\.src\s*=\s*'(https:\/\/[^/']+)\//g)].map(match => match[1]),
    );
    assert.ok(origins.size > 0, 'no external script origins found — update this guard if castWeb.ts changed');
    for (const origin of origins) {
      assert.ok(scriptSrc.includes(origin), `CSP script-src is missing ${origin}, which the player loads`);
    }
  });

  await check('HSTS is absent in development so local http still works', () => {
    assert.equal(value(dev, 'Strict-Transport-Security'), undefined);
    assert.equal(value(dev, 'X-Frame-Options'), undefined);
    assert.ok(!contentSecurityPolicy(false).includes('upgrade-insecure-requests'));
  });

  await check('development stays iframeable for previews', () => {
    assert.match(value(dev, 'Content-Security-Policy'), /frame-ancestors \*/);
  });

  await check('baseline hardening is present in both modes', () => {
    for (const rows of [prod, dev]) {
      assert.equal(value(rows, 'X-Content-Type-Options'), 'nosniff');
      assert.equal(value(rows, 'Referrer-Policy'), 'strict-origin-when-cross-origin');
      assert.equal(value(rows, 'X-DNS-Prefetch-Control'), 'off');
      assert.match(value(rows, 'Permissions-Policy'), /camera=\(\)/);
      assert.match(value(rows, 'Permissions-Policy'), /microphone=\(\)/);
      assert.match(value(rows, 'Permissions-Policy'), /geolocation=\(\)/);
    }
  });

  await check('player capabilities are not denied by Permissions-Policy', () => {
    const policy = value(prod, 'Permissions-Policy');
    assert.match(policy, /fullscreen=\(self\)/);
    assert.match(policy, /picture-in-picture=\(self\)/);
  });

  await check('header keys are unique (no accidental duplicates)', () => {
    for (const rows of [prod, dev]) {
      assert.equal(new Set(rows.map(row => row.key)).size, rows.length);
    }
  });

  await check('next.config.js applies the policy to every route', () => {
    const src = readFileSync(path.join(webRoot, 'next.config.js'), 'utf8');
    assert.ok(/require\('\.\/security-headers'\)/.test(src), 'policy module not imported');
    assert.ok(/source: '\/\(\.\*\)'/.test(src), 'policy must cover all routes');
    assert.ok(/securityHeaders\(process\.env\.NODE_ENV === 'production'\)/.test(src), 'must branch on production');
  });
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
