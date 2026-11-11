// Run only against the package's private Compose database; never a cloud URL.
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const argon2 = require('argon2');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (url.hostname !== 'postgres' || process.env.SELFHOST_LOCAL_ONLY !== 'true') throw new Error('LOCAL_COMPOSE_DATABASE_REQUIRED');
  const action = process.argv[2];
  if (action === 'prepare-roles' || action === 'migrate') {
    const p = new PrismaClient();try { await p.$executeRawUnsafe(require('./roles.cjs')); } finally { await p.$disconnect(); }
    if(action === 'prepare-roles') return;
  }
  if (action === 'migrate') {
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('MIGRATIONS_FAILED');
    const p = new PrismaClient(); try { await p.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS auth'); } finally { await p.$disconnect(); }
    return;
  }
  if (action === 'demo-import') { const p=new PrismaClient();try{await require('./demo.cjs')(p);}finally{await p.$disconnect();}return; }
  if (action === 'organization-license') {
    const tiers = { Starter: {maxUsers:20,maxStaff:2,maxServers:1,maxTitles:100}, Professional: {maxUsers:100,maxStaff:5,maxServers:5,maxTitles:1000}, Business: {maxUsers:1000,maxStaff:20,maxServers:20,maxTitles:10000} };
    const tenantId = process.env.ORGANIZATION_TENANT_ID;
    const status = process.env.ORGANIZATION_STATUS;
    const tier = process.env.ORGANIZATION_TIER;
    const expiry = new Date(process.env.ORGANIZATION_EXPIRES_AT || '');
    if (!/^[a-f0-9-]{36}$/i.test(tenantId || '') || !['active','suspended','revoked'].includes(status) || !Object.hasOwn(tiers,tier) || !Number.isFinite(expiry.getTime()) || (status==='active' && (expiry <= new Date() || expiry.getTime()>Date.now()+366*86400000))) throw new Error('INVALID_ORGANIZATION_LICENSE');
    const p = new PrismaClient();
    try { await p.$transaction(async tx=> {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId},837201630))`;
      await tx.tenant.update({where:{id:tenantId},data:{licenseEnforced:true,licenseTier:tier,licenseStatus:status,licenseExpiresAt:expiry,...tiers[tier]}});
      await tx.auditLog.create({data:{tenantId,actorId:tenantId,action:'organization.license.'+status,entity:'Tenant',entityId:tenantId,diff:{operator:'local-tools',tier,expiresAt:expiry.toISOString(),financial:false}}});
    }); console.log('PASS organization license updated; non-financial, no invoice created'); } finally { await p.$disconnect(); }
    return;
  }
  if (action !== 'bootstrap') throw new Error('UNKNOWN_DATABASE_ACTION');
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL, password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 16) throw new Error('UNIQUE_ADMIN_CREDENTIALS_REQUIRED');
  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!/^[a-f0-9-]{36}$/i.test(tenantId || '')) throw new Error('TENANT_UUID_REQUIRED');
  const p = new PrismaClient();
  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await p.$transaction(async tx => {
      // Single-use bootstrap, cannot elevate or reset an existing installation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(892341997::bigint)`;
      if (await tx.staffUser.count() || await tx.appUser.count() || await tx.tenant.count()) throw new Error('BOOTSTRAP_REQUIRES_EMPTY_INSTALLATION');
      await tx.tenant.create({ data: { id: tenantId, branding: { create: {} } } });
      const permissions = ['titles:create','titles:edit','titles:delete','users:manage','devices:manage','staff:manage','rights:manage','home:manage','xtream:manage','settings:manage','licenses:manage'];
      const role = await tx.role.create({ data: { tenantId, name: 'Administrator', permissions: JSON.stringify(permissions) } });
      const staff = await tx.staffUser.create({ data: { tenantId, email, passwordHash: hash, roleId: role.id } });
      await tx.auditLog.create({ data: { tenantId, actorId: staff.id, action: 'installation.bootstrapped', entity: 'Tenant', entityId: tenantId, diff: { local: true } } });
    });
    console.log('PASS local installation bootstrap; credentials not displayed');
  } finally { await p.$disconnect(); }
}
main().catch(() => { console.error('Local database action failed; no credentials printed. Check configuration and empty-install requirement.'); process.exitCode = 1; });
