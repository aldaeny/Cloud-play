// Disposable PostgreSQL + real Nest HTTP/admin guard. No hosted credentials.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
const require = createRequire(import.meta.url);
export async function testTenantSettings(client, api, check) {
  const { Test } = require('@nestjs/testing');
  const { JwtService } = require('@nestjs/jwt');
  const { AppModule } = require(path.join(api, 'dist/app.module.js'));
  const { PrismaService } = require(path.join(api, 'dist/prisma.service.js'));
  const request = require('supertest');
  const secret = randomUUID(), previous = process.env.ADMIN_JWT_SECRET;
  process.env.ADMIN_JWT_SECRET = secret;
  const tenants = [], roles = [], staff = [], users = [];
  let app;
  try {
    for (let i = 0; i < 2; i++) {
      const tenant = await client.tenant.create({ data: {} }); tenants.push(tenant);
      roles.push(await client.role.create({ data: { tenantId: tenant.id, name: 'Settings fixture', permissions: '["settings:manage","licenses:manage"]' } }));
      staff.push(await client.staffUser.create({ data: { tenantId: tenant.id, roleId: roles[i].id, email: `settings-${i}@fixture.invalid`, passwordHash: 'not-a-login' } }));
      users.push(await client.appUser.create({ data: { tenantId: tenant.id, email: `license-${i}@fixture.invalid` } }));
    }
    const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(client).compile();
    app = mod.createNestApplication({ logger: false }); await app.init();
    const token = i => `Bearer ${new JwtService().sign({ sub: staff[i].id, tokenType: 'admin', tenantId: tenants[1-i].id }, { secret, expiresIn: 60 })}`;
    const call = (method, route, i = 0) => request(app.getHttpServer())[method]('/admin/tenant-settings/' + route).set('Authorization', token(i));
    let planA, planB, license;
    await check('tenant branding real HTTP rejects anonymous, injected tenant, unsafe CSS/logo; persists isolated names', async () => {
      await request(app.getHttpServer()).get('/admin/tenant-settings/branding').expect(401);
      await call('put', 'branding').send({ tenantId: tenants[1].id, displayName: 'escape' }).expect(400);
      await call('put', 'branding').send({ cyanGlow: 'red;display:none' }).expect(400);
      await call('put', 'branding').send({ logoUrl: 'https://example.invalid/tracker.svg' }).expect(400);
      await call('put', 'branding').send({ displayName: 'Tenant A', cyanGlow: '#123456' }).expect(200);
      await call('put', 'branding', 1).send({ displayName: 'Tenant B' }).expect(200);
      assert.equal((await call('get', 'branding').expect(200)).body.displayName, 'Tenant A');
      assert.equal((await call('get', 'branding', 1).expect(200)).body.displayName, 'Tenant B');
    });
    await check('internal tiers are nonfinancial, tenant-scoped and idempotent in PostgreSQL', async () => {
      const first = await call('post', 'internal-plans').send({}).expect(201);
      const second = await call('post', 'internal-plans').send({}).expect(201);
      assert.equal(first.body.financial, false);
      assert.deepEqual(first.body.plans.map(p => p.id), second.body.plans.map(p => p.id));
      assert.deepEqual(first.body.plans.map(p => p.maxStreams), [1, 3, 5]);
      assert.ok(first.body.plans.every(p => p.priceCents === 0 && p.tenantId === tenants[0].id));
      planA = first.body.plans[0];
      planB = (await call('post', 'internal-plans', 1).send({}).expect(201)).body.plans[0];
    });
    await check('internal licensing denies cross-tenant users/plans, invalid expiry and cross-tenant revoke', async () => {
      const expiresAt = new Date(Date.now() + 86400000).toISOString();
      await call('post', 'licenses').send({ userId: users[1].id, planId: planA.id, expiresAt }).expect(404);
      await call('post', 'licenses').send({ userId: users[0].id, planId: planB.id, expiresAt }).expect(404);
      await call('post', 'licenses').send({ userId: users[0].id, planId: planA.id, expiresAt: '2000-01-01' }).expect(400);
      license = (await call('post', 'licenses').send({ userId: users[0].id, planId: planA.id, expiresAt }).expect(201)).body.license;
      assert.equal(license.provider, 'internal-manual');
      assert.equal((await call('get', 'licenses', 1).expect(200)).body.length, 0);
      await call('post', `licenses/${license.id}/revoke`, 1).send({}).expect(404);
      assert.equal((await client.subscription.findUnique({ where: { id: license.id } })).status, 'ACTIVE');
      await call('post', `licenses/${license.id}/revoke`).send({}).expect(201);
      assert.equal((await client.subscription.findUnique({ where: { id: license.id } })).status, 'CANCELED');
      assert.equal(await client.invoice.count({ where: { subscriptionId: license.id } }), 0);
    });
    await check('live permission removal denies settings despite valid admin JWT', async () => {
      await client.role.update({ where: { id: roles[0].id }, data: { permissions: '[]' } });
      await call('put', 'branding').send({ displayName: 'Denied' }).expect(403);
      await call('post', 'internal-plans').send({}).expect(403);
    });
  } finally {
    await app?.close();
    if (previous === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = previous;
    const ids = tenants.map(t => t.id);
    await client.auditLog.deleteMany({ where: { tenantId: { in: ids } } });
    await client.subscription.deleteMany({ where: { userId: { in: users.map(u => u.id) } } });
    await client.plan.deleteMany({ where: { tenantId: { in: ids } } });
    await client.appUser.deleteMany({ where: { tenantId: { in: ids } } });
    await client.staffUser.deleteMany({ where: { tenantId: { in: ids } } });
    await client.role.deleteMany({ where: { tenantId: { in: ids } } });
    await client.tenantBranding.deleteMany({ where: { tenantId: { in: ids } } });
    await client.tenant.deleteMany({ where: { id: { in: ids } } });
  }
}
