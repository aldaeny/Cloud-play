// Actual disposable GoTrue + PostgreSQL + Mailpit SMTP, never production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import pg from 'pg';
const auth = 'http://127.0.0.1:9999';
const smtp = 'http://127.0.0.1:8025';
const dbUrl = process.env.AUTH_TEST_DATABASE_URL;
if (!dbUrl || new URL(dbUrl).hostname !== '127.0.0.1' || new URL(dbUrl).port !== '5439') throw new Error('ISOLATED_AUTH_TEST_DB_REQUIRED');
const pool = new pg.Pool({ connectionString: dbUrl, connectionTimeoutMillis: 3000 });
const evidence = [];
async function passed(label) {
  evidence.push(`PASS ${label}`);
  console.log(`PASS ${label}`);
  await writeFile('auth-recovery-evidence.txt', evidence.join('\n') + '\n');
}
async function call(path, body, access, method = 'POST') {
  const response = await fetch(auth + path, { method, signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: { 'content-type': 'application/json', ...(access ? { authorization: `Bearer ${access}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data };
}
async function mailToken(email, type, exclude = new Set()) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const list = await (await fetch(smtp + '/api/v1/messages', { signal: AbortSignal.timeout(3000) })).json();
    for (const message of list.messages || []) {
      if (exclude.has(message.ID) || !message.To?.some(to => to.Address === email)) continue;
      const full = await (await fetch(smtp + '/api/v1/message/' + encodeURIComponent(message.ID), { signal: AbortSignal.timeout(3000) })).json();
      const source = `${full.HTML || ''} ${full.Text || ''}`.replaceAll('&amp;', '&');
      const links = source.match(/http:\/\/127\.0\.0\.1:9999\/verify\?[^\s"<>]+/g) || [];
      for (const link of links) {
        const url = new URL(link);
        if (url.searchParams.get('type') === type && url.searchParams.get('token')) return { id: message.ID, hash: url.searchParams.get('token') };
      }
    }
    await wait(250);
  }
  throw new Error('SMTP_EMAIL_NOT_DELIVERED_OR_LINK_INVALID');
}
try {
  let ready = false;
  for (let n = 0; n < 45; n++) {
    try { const r = await fetch(auth + '/health', { signal: AbortSignal.timeout(1000) }); if (r.ok) { ready = true; break; } } catch { /* disposable startup */ }
    await wait(1000);
  }
  assert.equal(ready, true, 'ISOLATED_AUTH_HEALTH_FAILED');
  const email = `fixture-${randomUUID()}@example.invalid`;
  const oldPassword = `Old!Aa19-${randomUUID()}`, newPassword = `New!Aa29-${randomUUID()}`;
  const signup = await call('/signup', { email, password: oldPassword });
  assert.equal(signup.status, 200);
  assert.ok(!signup.data?.access_token, 'EMAIL_VERIFICATION_MUST_PRECEDE_SESSION');
  const confirmation = await mailToken(email, 'signup');
  const verified = await call('/verify', { type: 'signup', token_hash: confirmation.hash });
  assert.equal(verified.status, 200); assert.ok(verified.data.access_token);
  await passed('registration and actual SMTP email verification before login');
  const login = await call('/token?grant_type=password', { email, password: oldPassword });
  assert.equal(login.status, 200); assert.ok(login.data.refresh_token);
  await passed('password login creates actual Auth session');
  const requested = await call('/recover', { email });
  const unknown = await call('/recover', { email: `absent-${randomUUID()}@example.invalid` });
  assert.equal(requested.status, 200); assert.equal(unknown.status, 200);
  assert.deepEqual(requested.data, unknown.data);
  await passed('recovery request nonenumeration status and response body');
  const recovery = await mailToken(email, 'recovery');
  const session = await call('/verify', { type: 'recovery', token_hash: recovery.hash });
  assert.equal(session.status, 200); assert.ok(session.data.access_token);
  const reuse = await call('/verify', { type: 'recovery', token_hash: recovery.hash });
  assert.ok(reuse.status >= 400 && reuse.status < 500);
  await passed('actual SMTP recovery link accepted exactly once; reuse rejected');
  const updated = await call('/user', { password: newPassword }, session.data.access_token, 'PUT');
  assert.equal(updated.status, 200);
  const oldLogin = await call('/token?grant_type=password', { email, password: oldPassword });
  assert.ok(oldLogin.status >= 400 && oldLogin.status < 500);
  const newLogin = await call('/token?grant_type=password', { email, password: newPassword });
  assert.equal(newLogin.status, 200);
  await passed('password replacement rejects old password and accepts new password');
  const playbackLogin=await call('/token?grant_type=password',{email,password:newPassword});
  assert.equal(playbackLogin.status,200);
  const nestResult=await promisify(execFile)(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-auth-nest.mjs')], {
    timeout: 600000, maxBuffer:16*1024*1024, env: { ...process.env, AUTH_FIXTURE_ACCESS_TOKEN: newLogin.data.access_token,
      AUTH_PLAYBACK_SESSION:JSON.stringify(playbackLogin.data),
      NODE_EXTRA_CA_CERTS: path.join(process.env.AUTH_FIXTURE_CERT_DIR, 'cert.pem') },
  }).catch(error=>{
    for(const line of String(error.stdout||'').split('\n').filter(line=>/^::error title=Protected playback stage::[a-z_]+(?:; expected \d{3} got \d{3})?$/.test(line)))console.log(line);
    for(const line of String(error.stdout||'').split('\n').filter(line=>line.startsWith('LOAD_FAILURE ')))console.log('::error title=Isolated load failure::'+line.slice('LOAD_FAILURE '.length));
    const safeLines=String(error.stdout||'').split('\n').filter(line=>/^PASS protected authenticated playback:/.test(line));
    for(const line of safeLines)console.log('::notice title=Protected playback completed stage::'+line);
    const details=String(error.stderr||'');
    const expected=details.match(/(NEXT_FIXTURE_EXITED|Next fixture ready|TimeoutError|AssertionError|SUPABASE_SESSION_REVOKED|AUTH_SESSION_CHECK_UNAVAILABLE|no external provider contact)/)?.[1]||'CHILD_INTEGRATION_FAILED';
    console.log('::error title=Protected playback isolated failure::'+expected);
    throw new Error('ISOLATED_NEST_PLAYBACK_FAILED');
  });
  const loadLine=nestResult.stdout.split('\n').find(line=>line.startsWith('::notice title=Progressive synthetic load::'));
  assert.ok(loadLine);console.log(loadLine);
  const capacityLine=nestResult.stdout.split('\n').find(line=>line.startsWith('PERFORMANCE_EVIDENCE '));
  assert.ok(capacityLine);const capacity=JSON.parse(capacityLine.slice('PERFORMANCE_EVIDENCE '.length));
  assert.equal(capacity.certifies_production_capacity,false);assert.equal(capacity.create.count,20);assert.equal(capacity.renew.count,20);assert.equal(capacity.segment.count,32);
  await writeFile('production-readiness-performance.json',JSON.stringify(capacity,null,2)+'\n');
  console.log('::notice title=Isolated playback capacity::'+JSON.stringify(capacity));
  for(const line of nestResult.stdout.split('\n').filter(line=>line.startsWith('PASS protected authenticated playback:')))await passed(line.slice(5));
  assert.equal(nestResult.stdout.split('\n').filter(line=>line.startsWith('PASS protected authenticated playback:')).length,13);
  await passed('actual Nest native Prisma and Web owner-ID ACL integrate with Supabase identity; tenant disabled and invalid-token checks pass');

  const row = (await pool.query('SELECT recovery_token FROM auth.users WHERE email=$1', [email])).rows[0];
  assert.ok(row && !row.recovery_token);
  await passed('used recovery token cleared from actual Auth database');
  const refresh = await call('/token?grant_type=refresh_token', { refresh_token: newLogin.data.refresh_token });
  assert.equal(refresh.status, 200);
  const logout = await call('/logout?scope=global', undefined, refresh.data.access_token);
  assert.equal(logout.status, 204);
  const revoked = await call('/token?grant_type=refresh_token', { refresh_token: refresh.data.refresh_token });
  assert.ok(revoked.status >= 400 && revoked.status < 500);
  const oldRevoked = await call('/token?grant_type=refresh_token', { refresh_token: login.data.refresh_token });
  assert.ok(oldRevoked.status >= 400 && oldRevoked.status < 500);
  await passed('actual refresh rotation and global logout revoke refresh sessions');
  assert.equal((await call('/recover', { email })).status, 200);
  const expired = await mailToken(email, 'recovery', new Set([recovery.id]));
  await wait(12000); // fixture MAILER_OTP_EXP=10 seconds, not production config
  const expiredResult = await call('/verify', { type: 'recovery', token_hash: expired.hash });
  assert.ok(expiredResult.status >= 400 && expiredResult.status < 500);
  const forged = await call('/verify', { type: 'recovery', token_hash: 'f'.repeat(64) });
  assert.ok(forged.status >= 400 && forged.status < 500);
  await passed('expired and forged recovery tokens rejected by actual Auth');
} catch {
  // Do not publish raw HTTP, JWTs, email links, bodies, passwords or DB errors.
  console.error('ISOLATED_AUTH_LIFECYCLE_FAILED: inspect fixed assertion checkpoint; no raw secret diagnostics published');
  process.exitCode = 1;
} finally { await pool.end(); }
