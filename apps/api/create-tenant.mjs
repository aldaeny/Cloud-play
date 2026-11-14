import { config } from 'dotenv';
config({ path: '.env' });
console.log('DATABASE_URL:', process.env.DATABASE_URL);

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000000' }
  });
  console.log('Default tenant created!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
