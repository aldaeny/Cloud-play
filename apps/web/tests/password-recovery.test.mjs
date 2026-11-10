/**
 * Regression tests for password recovery.
 *
 * Bug being covered: `resetPasswordForEmail` was wired up, but nothing in the app
 * called `auth.updateUser`. A user who opened the reset link landed on /login
 * with a temporary recovery session and NO way to set a new password — recovery
 * could never be completed.
 *
 * These render the REAL AccountPanel with a stubbed account context, so they
 * assert actual markup rather than a reimplementation. No new dependency:
 * react-dom/server ships with the app's existing react-dom.
 *
 * Run: npm run test:recovery --workspace aether-web
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const repoRoot = path.resolve(webRoot, '../..');
const require = createRequire(path.join(webRoot, 'package.json'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { passed++; console.log(`  PASS  ${name}`); })
    .catch(error => { failed++; failures.push(name); console.log(`  FAIL  ${name}\n        ${error.message}`); });
}

const out = mkdtempSync(path.join(webRoot, '.recovery-test-'));

try {
  const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  // Compile the panel plus its provider; the provider is stubbed at runtime via
  // a require hook so no network or Supabase config is needed.
  execFileSync(process.execPath, [
    tsc, 'src/components/account/AccountPanel.tsx',
    '--outDir', out, '--rootDir', '.', '--module', 'commonjs',
    '--target', 'es2022', '--jsx', 'react-jsx', '--esModuleInterop',
    '--skipLibCheck', '--strict', '--lib', 'es2022,dom',
  ], { cwd: webRoot, stdio: 'pipe' });

  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');

  // Stub the account context module the compiled panel imports.
  const providerPath = path.join(out, 'src/components/account/AccountProvider.js');
  mkdirSync(path.dirname(providerPath), { recursive: true });

  let context = {};
  writeFileSync(providerPath, `
    const state = require(${JSON.stringify(path.join(out, '__context.js'))});
    exports.useAccount = () => state.value;
  `);
  const contextFile = path.join(out, '__context.js');
  writeFileSync(contextFile, 'exports.value = {};');
  const contextStore = require(contextFile);

  // next/link and the Icon component are irrelevant to these assertions.
  const linkPath = path.join(out, '__link.js');
  writeFileSync(linkPath, `
    const React = require(${JSON.stringify(require.resolve('react'))});
    module.exports = function Link(props){ return React.createElement('a', { href: props.href }, props.children); };
    module.exports.default = module.exports;
  `);
  const iconPath = path.join(out, 'src/components/icons/Icon.js');
  mkdirSync(path.dirname(iconPath), { recursive: true });
  writeFileSync(iconPath, `
    const React = require(${JSON.stringify(require.resolve('react'))});
    module.exports = function Icon(){ return React.createElement('span', null, ''); };
    module.exports.default = module.exports;
  `);

  // Intercept 'next/link' before the panel is loaded.
  const Module = require('node:module');
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'next/link') return linkPath;
    return originalResolve.call(this, request, ...rest);
  };

  const panelPath = path.join(out, 'src/components/account/AccountPanel.js');
  const { default: AccountPanel } = require(panelPath);

  function render(overrides = {}, language = 'en') {
    contextStore.value = {
      configured: true, loading: false, user: null, syncState: 'idle',
      signIn: async () => {}, signUp: async () => {}, signOut: async () => {},
      resetPassword: async () => {}, recoveryActive: false,
      updatePassword: async () => {}, clearAccountLibrary: async () => {},
      ...overrides,
    };
    return renderToStaticMarkup(React.createElement(AccountPanel, { language }));
  }

  console.log('\npassword-recovery');

  await check('provider exposes a recovery completion API', async () => {
    const src = require('node:fs').readFileSync(path.join(webRoot, 'src/components/account/AccountProvider.tsx'), 'utf8');
    assert.ok(src.includes('updatePassword'), 'must expose updatePassword');
    assert.ok(/auth\.updateUser\(\s*\{\s*password\s*\}\s*\)/.test(src), 'must call Supabase auth.updateUser');
    assert.ok(src.includes("event === 'PASSWORD_RECOVERY'"), 'must listen for the recovery event');
  });

  await check('recovery flag is cleared only AFTER Supabase confirms the change', async () => {
    const src = require('node:fs').readFileSync(path.join(webRoot, 'src/components/account/AccountProvider.tsx'), 'utf8');
    const body = src.slice(src.indexOf('const updatePassword'), src.indexOf('const clearAccountLibrary'));
    const throwAt = body.indexOf('if (error) throw error');
    const clearAt = body.indexOf('setRecoveryActive(false)');
    assert.ok(throwAt > -1 && clearAt > -1, 'both guard and clear must exist');
    assert.ok(throwAt < clearAt, 'a failed update must not clear the recovery state');
  });

  await check('a recovery session shows the new-password form, not the signed-in view', async () => {
    const html = render({ recoveryActive: true, user: { id: 'u1', email: 'owner@example.com' } });
    assert.ok(html.includes('Set a new password'), 'must prompt for a new password');
    assert.ok(html.includes('type="password"'), 'must render a password input');
    assert.ok(html.includes('Save password'), 'must offer a submit action');
    assert.ok(!html.includes('Signed in as'), 'must not fall through to the signed-in view');
    assert.ok(!html.includes('Sign out'), 'must not offer sign-out mid-recovery');
  });

  await check('recovery asks for no email, because the session already identifies the user', async () => {
    const html = render({ recoveryActive: true, user: { id: 'u1', email: 'owner@example.com' } });
    assert.ok(!html.includes('type="email"'), 'email must not be requested during recovery');
  });

  await check('recovery password field uses new-password autocomplete', async () => {
    const html = render({ recoveryActive: true, user: { id: 'u1', email: null } });
    // React 18 preserves the camelCase attribute name in static markup.
    assert.match(html, /autocomplete="new-password"/i);
    assert.doesNotMatch(html, /autocomplete="current-password"/i);
  });

  await check('Arabic recovery copy is localized', async () => {
    const html = render({ recoveryActive: true, user: { id: 'u1', email: null } }, 'ar');
    assert.ok(html.includes('تعيين كلمة مرور جديدة'), 'Arabic heading');
    assert.ok(html.includes('حفظ كلمة المرور'), 'Arabic submit');
    assert.ok(!html.includes('Set a new password'), 'no English leakage');
  });

  await check('normal sign-in is unchanged (design freeze)', async () => {
    const html = render();
    assert.ok(html.includes('Sign in'));
    assert.ok(html.includes('type="email"'));
    assert.match(html, /autocomplete="current-password"/i);
    assert.ok(html.includes('Completely free'), 'free badge still shown');
    assert.ok(html.includes('Forgot password?'));
    assert.ok(!html.includes('Set a new password'));
  });

  await check('signed-in view is unchanged when not recovering (design freeze)', async () => {
    const html = render({ user: { id: 'u1', email: 'owner@example.com' }, syncState: 'synced' });
    assert.ok(html.includes('Signed in as'));
    assert.ok(html.includes('owner@example.com'));
    assert.ok(html.includes('Sign out'));
    assert.ok(html.includes('Synced'));
    assert.ok(!html.includes('Set a new password'));
  });

  await check('unconfigured and loading states are unchanged', async () => {
    assert.ok(render({ configured: false }).includes('Accounts are not enabled'));
    assert.ok(render({ loading: true }).includes('Checking your account'));
  });

  await check('recovery works even before the session resolves to a user', async () => {
    // Supabase can emit PASSWORD_RECOVERY before `user` is populated.
    const html = render({ recoveryActive: true, user: null });
    assert.ok(html.includes('Set a new password'));
    assert.ok(html.includes('type="password"'));
  });

  await check('the panel enforces the same 6-character minimum on recovery', async () => {
    const src = require('node:fs').readFileSync(path.join(webRoot, 'src/components/account/AccountPanel.tsx'), 'utf8');
    const recoveryBlock = src.slice(src.indexOf('if (showNewPassword) {'), src.indexOf('const cleanEmail'));
    assert.ok(recoveryBlock.includes('password.length < 6'), 'must validate length');
    assert.ok(recoveryBlock.includes('await updatePassword(password)'), 'must call the provider');
    assert.ok(!recoveryBlock.includes('signIn('), 'must not silently sign in instead');
  });

  await check('showNewPassword is declared before handleSubmit and all early returns', async () => {
    const src = require('node:fs').readFileSync(path.join(webRoot, 'src/components/account/AccountPanel.tsx'), 'utf8');
    const decl = src.indexOf('const showNewPassword');
    assert.ok(decl > -1);
    assert.ok(decl < src.indexOf('async function handleSubmit'), 'temporal-dead-zone hazard');
    assert.ok(decl < src.indexOf('if (!configured)'));
  });

  Module._resolveFilename = originalResolve;
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Failures:', failures.join(', '));
  process.exit(1);
}
