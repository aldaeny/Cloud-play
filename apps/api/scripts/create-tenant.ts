import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000000';

  // Check if tenant exists
  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (existing) {
    console.log('Tenant already exists');
    return;
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: tenantId,
      branding: {
        create: {
          displayName: 'Cloud Play',
          brandDark: '#0a0a0c',
          brandCard: '#121217',
          cyanGlow: '#00e5ff',
          magentaGlow: '#ff2085',
          violetGlow: '#7b30ff',
          amberGlow: '#ffb000',
        }
      },
      featureFlags: {
        create: [
          { key: 'FREE_ACCESS', enabled: true },
          { key: 'XTREAM_CATALOG', enabled: false },
          { key: 'SERIES', enabled: true },
        ]
      }
    }
  });

  console.log('Tenant created:', tenant.id);

  // Create a default plan
  const plan = await prisma.plan.create({
    data: {
      tenantId: tenant.id,
      code: 'free',
      interval: 'month',
      priceCents: 0,
      currency: 'USD',
      trialDays: 0,
      maxStreams: 2,
      maxDevices: 5,
      active: true,
    }
  });

  console.log('Plan created:', plan.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });