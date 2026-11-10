// Real, disposable PostgreSQL integration. Never reads DATABASE_URL.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { testRls } from './test-rls.mjs';
import { PrismaPg } from '@prisma/adapter-pg';

const require = createRequire(import.meta.url);
const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(api, '../..');
const temp = await mkdtemp(path.join(tmpdir(), 'cloudplay-pg-'));
const output = await mkdtemp(path.join(root, 'node_modules/.cloudplay-pg-client-'));
const schemaPath = path.join(api, 'prisma/schema.prisma');
const native = process.argv.includes('--native');
const productionSchema = await readFile(schemaPath, 'utf8');
const datamodel = productionSchema.replace(
  'provider = "prisma-client-js"', 'provider = "prisma-client-js"\n  previewFeatures = ["driverAdapters"]',
);
const { getDMMF } = require('@prisma/internals');
const { GeneratorProcess } = require('@prisma/generator-helper');
const dmmf = await getDMMF({ datamodel });
const generator = new GeneratorProcess(require.resolve('@prisma/client/generator-build/index.js'), { isNode: true });
// This separate test client uses the real npm-shipped WASM query engine and pg
// adapter. Production client/schema/PrismaService are deliberately unchanged.
const reservation = createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
const password = randomUUID();
let database, pool, client;
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
try {
  if (native) {
    const nativeSchema = path.join(output, 'native.prisma');
    await writeFile(nativeSchema, productionSchema.replace('provider = "prisma-client-js"',
      `provider = "prisma-client-js"\n  output = "${output.replaceAll('\\', '/')}"`));
    // No fallback, no adapter, no WASM. Native generation must actually succeed.
    execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'),
      'generate', '--schema', nativeSchema], { timeout: 30000, stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: 'postgresql://isolated:isolated@127.0.0.1:1/isolated',
        PRISMA_CLIENT_ENGINE_TYPE: 'library' } });
  } else {
  await generator.init();
  await generator.generate({
    generator: { name: 'client', provider: { value: 'prisma-client-js' },
      output: { value: output }, config: { engineType: 'library' }, binaryTargets: [],
      previewFeatures: ['driverAdapters'], isCustomOutput: true },
    otherGenerators: [], schemaPath, datamodel, dmmf,
    datasources: [{ name: 'db', provider: 'postgresql', activeProvider: 'postgresql',
      url: { fromEnvVar: 'DATABASE_URL', value: null }, sourceFilePath: schemaPath }],
    version: '5.22.0', clientVersion: '5.22.0',
    engineVersion: require('@prisma/engines-version').enginesVersion,
    binaryPaths: { libqueryEngine: {} }, envPaths: { rootEnvPath: null, schemaEnvPath: null },
    activeProvider: 'postgresql', postinstall: false, noEngine: false,
    noHints: true, allowNoModels: false, copyEngine: false,
  });
  generator.stop();
  }
  database = new EmbeddedPostgres({ databaseDir: path.join(temp, 'data'),
    port, user: 'cloudplay_test', password, persistent: true,
    postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: message => console.error('[isolated postgres]', message) });
  await database.initialise();
  await database.start();
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'cloudplay_test',
    password, database: 'postgres', connectionTimeoutMillis: 2000 });
  pool.on('error', () => {}); // Expected idle-connection errors during outage test.
  // Embedded cluster is fresh and local; no external connection string accepted.
  for (const dir of (await readdir(path.join(api, 'prisma/migrations'))).sort()) {
    if (dir === 'migration_lock.toml') continue;
    await pool.query(await readFile(path.join(api, 'prisma/migrations', dir, 'migration.sql'), 'utf8'));
  }
  if (!native) {
  const wasmPath = path.join(output, 'wasm.js');
  // Prisma 5's bundler WASM loader assumes a default module export. Node 22
  // imports instantiated WASM instead; compile the unchanged engine bytes here.
  const wasmSource = await readFile(wasmPath, 'utf8');
  const loaderStart = wasmSource.indexOf("    const loader = (await import('#wasm-engine-loader')).default");
  assert.ok(loaderStart >= 0, 'expected Prisma 5 WASM loader');
  const loaderEnd = wasmSource.indexOf('    return engine', loaderStart) + '    return engine'.length;
  await writeFile(wasmPath, wasmSource.slice(0, loaderStart) +
    "    return WebAssembly.compile(require('node:fs').readFileSync(require('node:path').join(__dirname, 'query_engine_bg.wasm')))" +
    wasmSource.slice(loaderEnd));
  const { PrismaClient } = require(wasmPath);
  client = new PrismaClient({ adapter: new PrismaPg(pool) });
  } else {
    const { PrismaClient } = require(path.join(output, 'index.js'));
    client = new PrismaClient({ datasources: { db: { url: `postgresql://cloudplay_test:${password}@127.0.0.1:${port}/postgres` } } });
  }
  await client.$connect();
  await check('PostgreSQL 17 and real Prisma query', async () => {
    const [row] = await client.$queryRaw`SELECT current_setting('server_version') AS version`;
    assert.match(row.version, /^17\./);
  });
  await check('all 33 model delegates query migrated tables', async () => {
    assert.equal(dmmf.datamodel.models.length, 33);
    for (const model of dmmf.datamodel.models) {
      const delegate = model.name[0].toLowerCase() + model.name.slice(1);
      assert.equal(await client[delegate].count(), 0, model.name);
    }
  });
  await check('all model columns and nullability match migrated schema', async () => {
    const { rows } = await pool.query(`SELECT table_name, column_name, is_nullable
      FROM information_schema.columns WHERE table_schema = 'public'`);
    for (const model of dmmf.datamodel.models) {
      for (const field of model.fields.filter(f => f.kind !== 'object')) {
        const column = rows.find(r => r.table_name === (model.dbName || model.name) && r.column_name === (field.dbName || field.name));
        assert.ok(column, `${model.name}.${field.name} missing`);
        // Prisma 5 emits PostgreSQL array columns nullable even for required lists.
        if (field.isList) continue;
        assert.equal(column.is_nullable, field.isRequired ? 'NO' : 'YES', `${model.name}.${field.name} nullability`);
      }
    }
  });
  await check('declared foreign keys and explicit indexes exist', async () => {
    const { rows: fks } = await pool.query(`SELECT conrelid::regclass::text AS name FROM pg_constraint WHERE contype = 'f'`);
    const { rows: indexes } = await pool.query(`SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`);
    for (const model of dmmf.datamodel.models) {
      const relations = model.fields.filter(f => f.kind === 'object' && f.relationFromFields?.length);
      assert.equal(fks.filter(f => f.name.replaceAll('"', '') === model.name).length, relations.length, model.name);
      for (const field of model.fields.filter(f => f.isId || f.isUnique)) {
        assert.ok(indexes.some(i => i.tablename === model.name && i.indexdef.includes('UNIQUE') && i.indexdef.replaceAll('"', '').includes(`(${field.name})`)), `${model.name}.${field.name} unique index`);
      }
      for (const fields of model.uniqueFields) {
        assert.ok(indexes.some(i => i.tablename === model.name && i.indexdef.includes('UNIQUE') && fields.every(f => i.indexdef.replaceAll('"', '').includes(f))), `${model.name} composite unique`);
      }
    }
    assert.ok(indexes.some(i => i.tablename === 'XtreamServer' && i.indexdef.includes('WHERE ("isDefault" = true)')));
  });
  await testRls(pool, root, check);
  const tenant = await client.tenant.create({ data: {} });
  const user = await client.appUser.create({ data: { tenantId: tenant.id, email: 'isolated@example.invalid',
    profiles: { create: { name: 'Disposable profile' } } }, include: { profiles: true } });
  await check('nested create, relationship loading and defaults', async () => {
    assert.equal(user.status, 'active'); assert.equal(user.profiles.length, 1);
    assert.equal(user.profiles[0].maturityMax, 'PG-13');
  });
  await check('real Nest profiles HTTP guard/service against real PostgreSQL (auth fixture only)', async () => {
    require('reflect-metadata');
    const { Test } = require('@nestjs/testing');
    const { AppModule } = require(path.join(api, 'dist/app.module.js'));
    const { PrismaService } = require(path.join(api, 'dist/prisma.service.js'));
    const { SupabaseAuthService } = require(path.join(api, 'dist/common/supabase-auth.service.js'));
    const request = require('supertest');
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(client)
      .overrideProvider(SupabaseAuthService).useValue({
        verifyAccessToken: async () => ({ id: user.id, email: user.email, emailConfirmed: false }),
      }).compile();
    const app = mod.createNestApplication({ logger: false });
    try {
      await app.init();
      await request(app.getHttpServer()).get('/hybrid/profiles').expect(401);
      const response = await request(app.getHttpServer()).get('/hybrid/profiles')
        .query({ userId: randomUUID() }).set('Authorization', 'Bearer fixture.session.token').expect(200);
      assert.equal(response.body.data.length, 1);
      assert.equal(response.body.data[0].id, user.profiles[0].id);
      assert.equal(response.body.data[0].userId, user.id);
      assert.ok(!('pinHash' in response.body.data[0]));
    } finally { await app.close(); }
  });
  await check('update/read', async () => {
    await client.profile.update({ where: { id: user.profiles[0].id }, data: { name: 'Updated' } });
    assert.equal((await client.profile.findUnique({ where: { id: user.profiles[0].id } })).name, 'Updated');
  });
  await check('unique constraint', async () => {
    await assert.rejects(client.appUser.create({ data: { tenantId: tenant.id, email: user.email } }), { code: 'P2002' });
  });
  await check('foreign key constraint', async () => {
    await assert.rejects(client.profile.create({ data: { userId: randomUUID(), name: 'Orphan' } }), { code: 'P2003' });
  });
  await check('transaction rollback', async () => {
    await assert.rejects(client.$transaction(async tx => { await tx.tenant.create({ data: {} }); throw new Error('rollback'); }), /rollback/);
    assert.equal(await client.tenant.count(), 1);
  });
  const { XtreamCatalogSyncService } = require(path.join(api, 'dist/modules/admin/xtream-catalog-sync.service.js'));
  const sync = new XtreamCatalogSyncService(client);
  const makeServer = name => client.xtreamServer.create({ data: { tenantId: tenant.id, name,
    baseUrl: 'https://fixture.invalid', username: 'fixture-only', passwordEncrypted: 'unused-test-ciphertext' } });
  const first = await makeServer('Fixture A'), second = await makeServer('Fixture B');
  const emptyCatalog = () => ({ live: [], movie: [], series: [], liveCategory: [], movieCategory: [], seriesCategory: [] });
  await check('real catalog imports persist provider-isolated ids and metadata diffs', async () => {
    await sync.importExport(tenant.id, first.id, { ...emptyCatalog(), live: [{ id: 1, name: 'Fixture A' }, { id: 2, name: 'Removed' }] }, true);
    await sync.importExport(tenant.id, second.id, { ...emptyCatalog(), live: [{ id: 1, name: 'Fixture B' }] }, true);
    const result = await sync.importExport(tenant.id, first.id, { ...emptyCatalog(), live: [{ id: 1, name: 'Changed' }, { id: 3, name: 'Added' }] }, true);
    assert.deepEqual({ added: result.added, changed: result.changed, removed: result.removed }, { added: 1, changed: 1, removed: 1 });
    assert.equal((await client.xtreamCatalogSnapshot.findUnique({ where: { serverId: second.id } })).catalog[0].name, 'Fixture B');
  });
  await check('real catalog failure history preserves successful snapshot; tenant escape denied', async () => {
    const before = await client.xtreamCatalogSnapshot.findUnique({ where: { serverId: first.id } });
    await assert.rejects(sync.importExport(tenant.id, first.id, { live: [] }, true), /INVALID_CATALOG/);
    const after = await client.xtreamCatalogSnapshot.findUnique({ where: { serverId: first.id } });
    assert.deepEqual(after.catalog, before.catalog);
    assert.equal(after.lastSuccessAt.getTime(), before.lastSuccessAt.getTime());
    assert.equal(after.history[0].status, 'FAILED');
    assert.ok(after.lastFailureAt);
    await assert.rejects(sync.status(randomUUID(), first.id), /not found/);
  });
  await check('real catalog advisory lock rejects concurrent import across connections', async () => {
    const locker = await pool.connect();
    try {
      await locker.query('BEGIN');
      await locker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [first.id]);
      await assert.rejects(sync.importExport(tenant.id, first.id, emptyCatalog(), true), /SYNC_IN_PROGRESS/);
    } finally { await locker.query('ROLLBACK'); locker.release(); }
    assert.equal((await sync.importExport(tenant.id, first.id, emptyCatalog(), true)).status, 'SUCCEEDED');
  });
  await check('real catalog HTTP authorization uses live DB roles and rejects tenant escape', async () => {
    const { Test } = require('@nestjs/testing');
    const { JwtService } = require('@nestjs/jwt');
    const { AppModule } = require(path.join(api, 'dist/app.module.js'));
    const { PrismaService } = require(path.join(api, 'dist/prisma.service.js'));
    const request = require('supertest');
    const previousSecret = process.env.ADMIN_JWT_SECRET;
    const secret = randomUUID(); process.env.ADMIN_JWT_SECRET = secret;
    const other = await client.tenant.create({ data: {} });
    const role = await client.role.create({ data: { tenantId: tenant.id, name: 'Fixture', permissions: '[]' } });
    const roleOther = await client.role.create({ data: { tenantId: other.id, name: 'Other', permissions: '["xtream:manage"]' } });
    const staff = await client.staffUser.create({ data: { tenantId: tenant.id, roleId: role.id, email: 'staff@fixture.invalid', passwordHash: 'unused' } });
    const staffOther = await client.staffUser.create({ data: { tenantId: other.id, roleId: roleOther.id, email: 'other@fixture.invalid', passwordHash: 'unused' } });
    const sign = id => new JwtService().sign({ sub: id, tokenType: 'admin', permissions: ['xtream:manage'] }, { secret, expiresIn: 60 });
    let app;
    try {
      const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(client).compile();
      app = mod.createNestApplication({ logger: false }); await app.init();
      const url = `/admin/xtream-servers/${first.id}/catalog-sync`;
      await request(app.getHttpServer()).get(url).expect(401);
      await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${sign(staff.id)}`).expect(403);
      await client.role.update({ where: { id: role.id }, data: { permissions: '["xtream:manage"]' } });
      await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${sign(staffOther.id)}`).expect(404);
      await request(app.getHttpServer()).post(url).set('Authorization', `Bearer ${sign(staff.id)}`)
        .send({ catalog: emptyCatalog(), authorizationConfirmed: true }).expect(201);
      const response = await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${sign(staff.id)}`).expect(200);
      assert.equal(response.body.history[0].status, 'SUCCEEDED');
      assert.ok(!JSON.stringify(response.body).includes('unused-test-ciphertext'));
    } finally {
      await app?.close();
      if (previousSecret === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = previousSecret;
      await client.staffUser.deleteMany({ where: { id: { in: [staff.id, staffOther.id] } } });
      await client.role.deleteMany({ where: { id: { in: [role.id, roleOther.id] } } });
      await client.tenant.delete({ where: { id: other.id } });
    }
  });
  await check('snapshot migration rollback/reapply preserves provider rows', async () => {
    const dir = path.join(api, 'prisma/migrations/20261108010000_xtream_catalog_snapshot');
    await pool.query(await readFile(path.join(dir, 'rollback.sql'), 'utf8'));
    assert.equal(await client.xtreamServer.count(), 2);
    await pool.query(await readFile(path.join(dir, 'migration.sql'), 'utf8'));
    assert.equal(await client.xtreamCatalogSnapshot.count(), 0);
    await client.xtreamServer.deleteMany({ where: { tenantId: tenant.id } });
  });
  await check('delete disposable records', async () => {
    await client.profile.deleteMany({ where: { userId: user.id } });
    await client.appUser.delete({ where: { id: user.id } });
    await client.tenant.delete({ where: { id: tenant.id } });
    assert.equal(await client.tenant.count(), 0);
  });
  await check('connection outage and recovery against the same cluster', async () => {
    await database.stop();
    await assert.rejects(client.tenant.count());
    await database.start();
    assert.equal(await client.tenant.count(), 0);
  });
  console.log(`${native ? 'NATIVE' : 'WASM'} REAL POSTGRESQL: ${passed} checks passed. No production connection used.`);
} finally {
  generator.stop();
  await client?.$disconnect();
  await pool?.end();
  await database?.stop();
  await rm(temp, { recursive: true, force: true });
  await rm(output, { recursive: true, force: true });
}
