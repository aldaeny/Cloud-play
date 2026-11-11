// Native Nest/Prisma against disposable GoTrue via fixture TLS bridge.
// Executed only by test-auth-recovery.mjs; no mocked identity/DB/guards.
import { createServer } from 'node:https';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHmac, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
const require = createRequire(import.meta.url);
const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = process.env.AUTH_TEST_DATABASE_URL;
if (!db || new URL(db).hostname !== '127.0.0.1' || new URL(db).port !== '5439') throw new Error('ISOLATED_AUTH_DB_REQUIRED');
const access = process.env.AUTH_FIXTURE_ACCESS_TOKEN;
if (!access) throw new Error('ISOLATED_AUTH_TOKEN_REQUIRED');
const pool = new pg.Pool({ connectionString: db });
const tls = createServer({ key: await readFile(path.join(process.env.AUTH_FIXTURE_CERT_DIR, 'key.pem')),
  cert: await readFile(path.join(process.env.AUTH_FIXTURE_CERT_DIR, 'cert.pem')) }, async (req, res) => {
  if (req.method !== 'GET' || req.url !== '/auth/v1/user') { res.writeHead(404); res.end(); return; }
  try {
    const upstream = await fetch('http://127.0.0.1:9999/user', {
      headers: { authorization: req.headers.authorization || '' }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    res.writeHead(upstream.status, { 'content-type': 'application/json' }); res.end(await upstream.text());
  } catch { res.writeHead(503); res.end('{}'); }
});
let app;
try {
  await new Promise(resolve => tls.listen(9443, '127.0.0.1', resolve));
  process.env.DATABASE_URL = db; process.env.SUPABASE_URL = 'https://127.0.0.1:9443';
  process.env.SUPABASE_ANON_KEY = 'isolated-gateway-fixture'; process.env.API_END_USER_AUTHORITY = 'supabase';
  const { readdir } = await import('node:fs/promises');
  for (const dir of (await readdir(path.join(api, 'prisma/migrations'))).sort()) {
    if (dir === 'migration_lock.toml') continue;
    await pool.query(await readFile(path.join(api, 'prisma/migrations', dir, 'migration.sql'), 'utf8'));
  }
  const user = (await (await fetch('http://127.0.0.1:9999/user', { headers: { authorization: `Bearer ${access}` } })).json());
  assert.ok(user.id);
  const tenant = randomUUID(), otherTenant = randomUUID(), otherUser = randomUUID(), otherProfile = randomUUID();
  await pool.query('INSERT INTO "Tenant" (id) VALUES ($1),($2)', [tenant, otherTenant]);
  await pool.query('INSERT INTO "AppUser" (id,"tenantId",email,status) VALUES ($1,$2,$3,\'active\'),($4,$5,$6,\'active\')',
    [user.id, tenant, user.email, otherUser, otherTenant, 'foreign@example.invalid']);
  await pool.query('INSERT INTO "Profile" (id,"userId",name) VALUES ($1,$2,$3)', [otherProfile, otherUser, 'Foreign']);
  require('reflect-metadata');
  const { Test } = require('@nestjs/testing'); const { ValidationPipe } = require('@nestjs/common');
  const { AppModule } = require(path.join(api, 'dist/app.module.js'));
  const request = require('supertest');
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ logger: false }); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  const server = app.getHttpServer(), bearer = `Bearer ${access}`;
  for(const [path,body] of [['login',{email:'fixture@example.invalid',password:'FixtureAa1!'}],['register',{email:'fixture@example.invalid',password:'FixtureAa1!',name:'Fixture',phone:'+12025550123'}],['refresh',{refresh_token:'fixture'}]]){
    const denied=await request(server).post('/auth/'+path).send(body).expect(503);assert.equal(denied.body.message,'END_USER_AUTH_MANAGED_BY_SUPABASE');
  }
  await request(server).get('/profiles').expect(401);
  await request(server).get(`/external-playback/${randomUUID()}/manifest`).expect(401);
  await request(server).get(`/external-playback/${randomUUID()}/manifest`).set('Authorization', bearer).expect(403);
  await request(server).get(`/external-playback/${randomUUID()}/resource?ticket=invalid`).set('Authorization', bearer).expect(403);
  const own = await request(server).post('/profiles').set('Authorization', bearer)
    .send({ name: 'Actual Auth Fixture', userId: otherUser, tenantId: otherTenant, roles: ['admin'] }).expect(201);
  assert.equal(own.body.userId, user.id);
  const profiles = await request(server).get('/profiles').set('Authorization', bearer).expect(200);
  assert.equal(profiles.body.length, 1); assert.equal(profiles.body[0].id, own.body.id);
  await request(server).put(`/profiles/${otherProfile}`).set('Authorization', bearer).send({ name: 'stolen' }).expect(404);
  await request(server).delete(`/profiles/${otherProfile}`).set('Authorization', bearer).expect(404);
  await pool.query('UPDATE "AppUser" SET status=\'disabled\' WHERE id=$1', [user.id]);
  await request(server).get('/profiles').set('Authorization', bearer).expect(403);
  await pool.query('UPDATE "AppUser" SET status=\'active\' WHERE id=$1', [user.id]);
  const payload = JSON.parse(Buffer.from(access.split('.')[1], 'base64url').toString());
  const sign = (claims, key) => {
    const data = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
    return data + '.' + createHmac('sha256', key).update(data).digest('base64url');
  };
  const expired = sign({ ...payload, exp: 1 }, 'isolated-fixture-signing-key-not-for-any-production-use');
  const forged = sign({ ...payload, sub: otherUser }, 'wrong-isolated-signing-key');
  for (const token of [expired, forged, 'malformed.token.fixture']) {
    await request(server).get('/profiles').set('Authorization', `Bearer ${token}`).expect(401);
  }
  assert.equal((await pool.query('SELECT name FROM "Profile" WHERE id=$1', [otherProfile])).rows[0].name, 'Foreign');
  const ts = require('typescript');
  const ownerSource = path.resolve(api, '../web/src/server/xtream-access.ts');
  const compiledOwner = path.join(process.env.AUTH_FIXTURE_CERT_DIR, 'owner.cjs');
  await writeFile(compiledOwner, ts.transpileModule(await readFile(ownerSource, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  const owner = require(compiledOwner);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://127.0.0.1:9443';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'isolated-gateway-fixture';
  process.env.XTREAM_OWNER_EMAILS = user.email;
  delete process.env.XTREAM_OWNER_USER_IDS;
  await assert.rejects(owner.requireOwner({ headers: { authorization: bearer } }), error => error.code === 'OWNER_NOT_SET');
  process.env.XTREAM_OWNER_USER_IDS = user.id;
  assert.equal((await owner.requireOwner({ headers: { authorization: bearer } })).userId, user.id);
  process.env.XTREAM_OWNER_USER_IDS = otherUser;
  await assert.rejects(owner.requireOwner({ headers: { authorization: bearer } }), error => error.code === 'NOT_AUTHORIZED');
  const {testProtectedAuthPlayback}=await import('./test-protected-auth-playback.mjs');
  const playbackSession=JSON.parse(process.env.AUTH_PLAYBACK_SESSION);
  const prisma=app.get(require(path.join(api,'dist/prisma.service.js')).PrismaService);
  assert.equal(await testProtectedAuthPlayback({app,prisma,tenant,userId:user.id,session:playbackSession,certDir:process.env.AUTH_FIXTURE_CERT_DIR,refreshToken:playbackSession.refresh_token,otherSessionToken:access}),9);
  console.log('PASS actual Nest native Prisma Supabase identity: own create/read, forged body ignored, cross-user/cross-tenant update/delete denied, disabled/expired/forged/malformed rejected');
} finally {
  await app?.close(); tls.closeAllConnections(); await new Promise(resolve => tls.close(resolve)); await pool.end();
}
