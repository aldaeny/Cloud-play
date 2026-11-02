/**
 * Seed script — creates initial tenant, plans, roles, and sample data
 * Run: npx prisma db seed (or npm run prisma:seed)
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || '00000000-0000-0000-0000-000000000000';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is forbidden in production');
  console.log('🌱 Seeding database...');

  // Create tenant
  console.log('  Creating tenant...');
  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      branding: {
        create: {},
      },
    },
  });

  // Create plans
  console.log('  Creating plans...');
  const plans = [
    { code: 'basic', interval: 'month', priceCents: 499, currency: 'USD', trialDays: 7, maxStreams: 2, maxDevices: 2 },
    { code: 'standard', interval: 'month', priceCents: 999, currency: 'USD', trialDays: 7, maxStreams: 3, maxDevices: 5 },
    { code: 'premium', interval: 'month', priceCents: 1499, currency: 'USD', trialDays: 14, maxStreams: 5, maxDevices: 10 },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: plan.code } },
      update: {},
      create: { ...plan, tenantId: DEFAULT_TENANT_ID },
    });
  }

  // Create admin role
  console.log('  Creating admin role...');
  await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Administrator',
      permissions: JSON.stringify([
        'titles:create', 'titles:edit', 'titles:delete',
        'users:manage', 'devices:manage', 'staff:manage',
        'rights:manage', 'home:manage', 'xtream:manage',
      ]),
    },
  });

  // Create editor role
  await prisma.role.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: DEFAULT_TENANT_ID,
      name: 'Editor',
      permissions: JSON.stringify([
        'titles:create', 'titles:edit', 'rights:manage', 'home:manage',
      ]),
    },
  });

  // Create admin staff user
  console.log('  Creating admin staff user...');
  const adminPassword = await argon2.hash('admin123456', {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
  await prisma.staffUser.upsert({
    where: { email: 'admin@aether.local' },
    update: {},
    create: {
      email: 'admin@aether.local',
      passwordHash: adminPassword,
      tenantId: DEFAULT_TENANT_ID,
      roleId: '00000000-0000-0000-0000-000000000001',
    },
  });

  // Create sample published title
  console.log('  Creating sample title...');
  await prisma.title.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: DEFAULT_TENANT_ID,
      kind: 'MOVIE',
      state: 'PUBLISHED',
      titleAr: 'فيلم تجريبي',
      titleEn: 'Aether Demo Movie',
      synopsisEn: 'A demonstration title for the Aether streaming platform.',
      maturityRating: 'PG-13',
      releaseYear: 2024,
      runtimeSec: 10800,
      originalLanguage: 'en',
      genres: ['action', 'drama'],
    },
  });

  // Create rights window for sample title
  await prisma.rightsWindow.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      titleId: '00000000-0000-0000-0000-000000000010',
      contractRef: 'CONTRACT-001',
      territories: JSON.stringify(['IQ', 'SA', 'AE', 'EG']),
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      approvedAt: new Date(),
    },
  });

  // Create home row
  await prisma.homeRow.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      tenantId: DEFAULT_TENANT_ID,
      name: 'الأعمال الجديدة',
      order: 0,
    },
  });

  await prisma.homeRowItem.upsert({
    where: { homeRowId_order: { homeRowId: '00000000-0000-0000-0000-000000000030', order: 0 } },
    update: {},
    create: {
      homeRowId: '00000000-0000-0000-0000-000000000030',
      titleId: '00000000-0000-0000-0000-000000000010',
      order: 0,
    },
  });

  console.log('✅ Seeding complete!');
  console.log('   Admin email: admin@aether.local');
  console.log('   Admin password: admin123456');
  console.log('   Tenant ID:', DEFAULT_TENANT_ID);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
