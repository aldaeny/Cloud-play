import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
test('local setup creates unique secrets, bounded pool, Supabase authority and refuses overwrite', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cloudplay-env-'));
  try {
    mkdirSync(path.join(root, 'scripts'));
    copyFileSync('scripts/setup-local-env.js', path.join(root, 'scripts/setup-local-env.js'));
    copyFileSync('.env.example', path.join(root, '.env.example'));
    const first = spawnSync(process.execPath, [path.join(root, 'scripts/setup-local-env.js')], { encoding: 'utf8' });
    assert.equal(first.status, 0);
    const env = readFileSync(path.join(root, '.env'), 'utf8');
    const value = key => env.match(new RegExp(`^${key}="([^"]*)"`, 'm'))?.[1];
    assert.equal(statSync(path.join(root, '.env')).mode & 0o777, 0o600);
    assert.match(value('DEFAULT_TENANT_ID'), /^[a-f0-9-]{36}$/);
    assert.notEqual(value('DEFAULT_TENANT_ID'), '00000000-0000-0000-0000-000000000000');
    assert.match(value('XTREAM_ENCRYPTION_KEY'), /^[a-f0-9]{64}$/);
    assert.equal(value('API_END_USER_AUTHORITY'), 'supabase');
    const url = new URL(value('DATABASE_URL'));
    assert.equal(url.searchParams.get('connection_limit'), '3');
    assert.equal(url.searchParams.get('pool_timeout'), '5');
    const secrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ADMIN_JWT_SECRET', 'XTREAM_ENCRYPTION_KEY'].map(value);
    assert.equal(new Set(secrets).size, 4);
    assert.ok(secrets.every(secret => !first.stdout.includes(secret) && !first.stderr.includes(secret)));
    const second = spawnSync(process.execPath, [path.join(root, 'scripts/setup-local-env.js')]);
    assert.equal(second.status, 1);
    assert.equal(readFileSync(path.join(root, '.env'), 'utf8'), env);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
