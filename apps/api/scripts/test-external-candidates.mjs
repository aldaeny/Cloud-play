import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export async function testExternalCandidates(client, tenant, check) {
  const { ExternalServersService } = require('../dist/modules/admin/external-servers.service.js');
  const { XtreamServersService } = require('../dist/modules/admin/xtream-servers.service.js');
  const previous = process.env.XTREAM_ENCRYPTION_KEY;
  process.env.XTREAM_ENCRYPTION_KEY = 'b'.repeat(64); // disposable test key only
  const vault = new XtreamServersService(client, {});
  const service = new ExternalServersService(client, vault);
  const actor = randomUUID();
  const input = { name: 'Candidate', providerName: 'Authorized Fixture', url: 'https://127.0.0.1/private?token=secret-fixture', protocol: 'hls', country: 'IQ', category: 'fixture' };
  let server, license;
  try {
    await check('external candidates: encrypted intake without paper license; bounded list and cross-tenant denial', async () => {
      server = await service.save(tenant.id, actor, input);
      assert.equal(server.status, 'candidate'); assert.equal(server.enabled, false);
      assert.ok(!JSON.stringify(server).includes('secret-fixture'));
      const db = await client.externalServer.findUnique({ where: { id: server.id } });
      assert.ok(!db.endpointEncrypted.includes('secret-fixture'));
      assert.equal(vault.decryptSecret(db.endpointEncrypted), input.url);
      assert.equal((await service.list(tenant.id)).items.length, 1);
      await assert.rejects(service.remove(randomUUID(), actor, server.id), { status: 404 });
    });
    await check('external HTTP RBAC: missing/forged privilege denied, authorized list, foreign tenant mutation denied', async () => {
      const { Test } = require('@nestjs/testing');
      const { JwtService } = require('@nestjs/jwt');
      const { AppModule } = require('../dist/app.module.js');
      const { PrismaService } = require('../dist/prisma.service.js');
      const request = require('supertest');
      const previousSecret = process.env.ADMIN_JWT_SECRET;
      const secret = randomUUID(); process.env.ADMIN_JWT_SECRET = secret;
      const role = await client.role.create({ data: { tenantId: tenant.id, name: 'External fixture', permissions: '[]' } });
      const staff = await client.staffUser.create({ data: { tenantId: tenant.id, roleId: role.id, email: `${randomUUID()}@fixture.invalid`, passwordHash: 'unused' } });
      const other = await client.tenant.create({ data: {} });
      const otherRole = await client.role.create({ data: { tenantId: other.id, name: 'Other external fixture', permissions: '["xtream:manage"]' } });
      const stranger = await client.staffUser.create({ data: { tenantId: other.id, roleId: otherRole.id, email: `${randomUUID()}@fixture.invalid`, passwordHash: 'unused' } });
      const sign = id => new JwtService().sign({ sub: id, tokenType: 'admin', permissions: ['xtream:manage', 'rights:manage'] }, { secret, expiresIn: 60 });
      let app;
      try {
        const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(client).compile();
        app = mod.createNestApplication({ logger: false }); await app.init();
        const url = '/admin/external-servers';
        await request(app.getHttpServer()).get(url).expect(401);
        await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${sign(staff.id)}`).expect(403);
        await client.role.update({ where: { id: role.id }, data: { permissions: '["xtream:manage"]' } });
        const response = await request(app.getHttpServer()).get(url).set('Authorization', `Bearer ${sign(staff.id)}`).expect(200);
        assert.equal(response.body.items[0].id, server.id);
        assert.ok(!JSON.stringify(response.body).includes('secret-fixture'));
        await request(app.getHttpServer()).delete(`${url}/${server.id}`).set('Authorization', `Bearer ${sign(stranger.id)}`).expect(404);
        await request(app.getHttpServer()).post(`${url}/licenses/${randomUUID()}/review`).set('Authorization', `Bearer ${sign(staff.id)}`).send({ status: 'verified_authorized', notes: 'forged permission' }).expect(403);
      } finally {
        await app?.close();
        if (previousSecret === undefined) delete process.env.ADMIN_JWT_SECRET; else process.env.ADMIN_JWT_SECRET = previousSecret;
        await client.staffUser.deleteMany({ where: { id: { in: [staff.id, stranger.id] } } });
        await client.role.deleteMany({ where: { id: { in: [role.id, otherRole.id] } } });
        await client.tenant.delete({ where: { id: other.id } });
      }
    });
    await check('external monitor: confirmed technical check of SSRF target denied; no publication and append-only history', async () => {
      await assert.rejects(service.check(tenant.id, actor, server.id, {}), { status: 403 });
      const result = await service.check(tenant.id, actor, server.id, { technicalAccessConfirmed: true });
      assert.equal(result.result, 'unreachable'); assert.equal(result.details.reason, 'TRANSPORT_FAILED_OR_POLICY_DENIED');
      assert.ok(!JSON.stringify(result).includes('secret-fixture'));
      assert.equal((await service.history(tenant.id, server.id)).length, 1);
      await assert.rejects(service.check(tenant.id, actor, server.id, { technicalAccessConfirmed: true }), { status: 400 });
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'IQ')).productionEnabled, false);
    });
    await check('external scheduling: replica-safe lease, crashed lease recovery, disabled schedule and empty weekly report', async () => {
      const { ExternalMonitorService } = require('../dist/modules/admin/external-monitor.service.js');
      const a = new ExternalMonitorService(client, service), b = new ExternalMonitorService(client, service);
      await assert.rejects(a.configure(tenant.id, actor, server.id, { frequency: 'hourly', enabled: true }), { status: 400 });
      await a.configure(tenant.id, actor, server.id, { frequency: 'quarter_hour', enabled: true, technicalAccessConfirmed: true });
      await client.externalServer.update({ where: { id: server.id }, data: { lastCheckedAt: null } });
      const before = await client.serverHealthCheck.count({ where: { serverId: server.id } });
      await Promise.all([a.tick(), b.tick()]);
      assert.equal(await client.serverHealthCheck.count({ where: { serverId: server.id } }), before + 1);
      await client.serverSchedule.update({ where: { serverId: server.id }, data: { leaseUntil: new Date(0), nextRunAt: new Date(0) } });
      await client.externalServer.update({ where: { id: server.id }, data: { lastCheckedAt: null } });
      await b.tick();
      assert.equal(await client.serverHealthCheck.count({ where: { serverId: server.id } }), before + 2);
      await a.configure(tenant.id, actor, server.id, { frequency: 'weekly', enabled: false });
      await a.tick();
      assert.equal(await client.serverHealthCheck.count({ where: { serverId: server.id } }), before + 2);
      const empty = await a.report(randomUUID(), 'weekly');
      assert.deepEqual(empty.checks, []); assert.equal(empty.deliveryStatus, 'on_demand_only');
      await a.onModuleDestroy(); await b.onModuleDestroy();
    });
    await check('external rights: review scope, revocation, tenant-FK isolation and provider change demotion', async () => {
      license = await service.createLicense(tenant.id, actor, { provider: input.providerName, contentOwner: 'Fixture Rights Holder', authorizedContact: 'fixture@example.invalid', authorizationType: 'fixture-contract', allowedPlatforms: ['web'], allowedCountries: ['IQ'], commercialUse: true, redistributionPermission: true, territoryRestrictions: 'IQ only', startDate: '2020-01-01', expiryDate: '2099-01-01' });
      const evidence = Buffer.from('%PDF-1.4\nIsolated synthetic rights document, not a real authorization.').toString('base64');
      const document = await service.uploadDocument(tenant.id, actor, license.id, { mimeType: 'application/pdf', contentBase64: evidence });
      assert.ok(!JSON.stringify(document).includes(evidence));
      assert.equal((await service.documents(tenant.id, license.id)).length, 1);
      assert.equal((await service.readDocument(tenant.id, actor, document.id)).contentBase64, evidence);
      await assert.rejects(service.readDocument(randomUUID(), actor, document.id), { status: 404 });
      await assert.rejects(service.uploadDocument(tenant.id, actor, license.id, { mimeType: 'application/pdf', contentBase64: Buffer.from('not pdf').toString('base64') }), { status: 400 });
      assert.equal((await client.contentLicense.findUnique({ where: { id: license.id } })).status, 'licensing_unverified');
      await service.assignLicense(tenant.id, actor, server.id, license.id);
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'IQ')).rightsEligible, false);
      await assert.rejects(service.reviewLicense(tenant.id, actor, license.id, { status: 'verified_authorized', notes: 'Fixture' }), { status: 400 });
      await service.reviewLicense(tenant.id, actor, license.id, { status: 'verified_authorized', notes: 'Issuer and scope reviewed in isolated fixture', scopeReviewed: true, issuerVerified: true });
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'IQ')).rightsEligible, true);
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'US')).rightsEligible, false);
      await assert.rejects(client.externalServer.create({ data: { tenantId: tenant.id, name: 'Foreign License', providerName: 'Fixture', protocol: 'hls', endpointEncrypted: 'fixture', country: 'IQ', category: 'fixture', licenseId: randomUUID() } }), { code: 'P2003' });
      await service.reviewLicense(tenant.id, actor, license.id, { status: 'revoked', notes: 'Fixture revocation' });
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'IQ')).rightsEligible, false);
      await service.save(tenant.id, actor, { ...input, providerName: 'Changed Provider' }, server.id);
      const edited = await client.externalServer.findUnique({ where: { id: server.id } });
      assert.equal(edited.licenseId, null); assert.equal(edited.status, 'candidate');
      await service.remove(tenant.id, actor, server.id);
      assert.equal((await service.list(tenant.id)).items.length, 0);
      assert.ok((await service.audits(tenant.id)).length >= 7);
      assert.equal(await client.licenseReview.count({ where: { licenseId: license.id } }), 2);
    });
  } finally {
    await client.serverSchedule.deleteMany({ where: { tenantId: tenant.id } });
    await client.serverHealthCheck.deleteMany({ where: { tenantId: tenant.id } });
    await client.externalServer.deleteMany({ where: { tenantId: tenant.id } });
    await client.licenseReview.deleteMany({ where: { tenantId: tenant.id } });
    await client.licenseDocument.deleteMany({ where: { tenantId: tenant.id } });
    await client.contentLicense.deleteMany({ where: { tenantId: tenant.id } });
    await client.serverAuditLog.deleteMany({ where: { tenantId: tenant.id } });
    if (previous === undefined) delete process.env.XTREAM_ENCRYPTION_KEY; else process.env.XTREAM_ENCRYPTION_KEY = previous;
  }
}
