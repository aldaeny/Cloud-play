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
    await check('external monitor: confirmed technical check of SSRF target denied; no publication and append-only history', async () => {
      await assert.rejects(service.check(tenant.id, actor, server.id, {}), { status: 403 });
      const result = await service.check(tenant.id, actor, server.id, { technicalAccessConfirmed: true });
      assert.equal(result.result, 'unreachable'); assert.equal(result.details.reason, 'TRANSPORT_FAILED_OR_POLICY_DENIED');
      assert.ok(!JSON.stringify(result).includes('secret-fixture'));
      assert.equal((await service.history(tenant.id, server.id)).length, 1);
      await assert.rejects(service.check(tenant.id, actor, server.id, { technicalAccessConfirmed: true }), { status: 400 });
      assert.equal((await service.eligibility(tenant.id, server.id, 'web', 'IQ')).productionEnabled, false);
    });
    await check('external rights: review scope, revocation, tenant-FK isolation and provider change demotion', async () => {
      license = await service.createLicense(tenant.id, actor, { provider: input.providerName, contentOwner: 'Fixture Rights Holder', authorizedContact: 'fixture@example.invalid', authorizationType: 'fixture-contract', allowedPlatforms: ['web'], allowedCountries: ['IQ'], commercialUse: true, redistributionPermission: true, territoryRestrictions: 'IQ only', startDate: '2020-01-01', expiryDate: '2099-01-01' });
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
    await client.serverHealthCheck.deleteMany({ where: { tenantId: tenant.id } });
    await client.externalServer.deleteMany({ where: { tenantId: tenant.id } });
    await client.licenseReview.deleteMany({ where: { tenantId: tenant.id } });
    await client.contentLicense.deleteMany({ where: { tenantId: tenant.id } });
    await client.serverAuditLog.deleteMany({ where: { tenantId: tenant.id } });
    if (previous === undefined) delete process.env.XTREAM_ENCRYPTION_KEY; else process.env.XTREAM_ENCRYPTION_KEY = previous;
  }
}
