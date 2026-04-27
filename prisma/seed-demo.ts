import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@sysde.com';
const DEMO_PASSWORD = 'demo1234';
const DEMO_ROLE_KEY = 'reviewer';

async function main() {
  console.log('🎭 Seeding demo user...');

  const role = await prisma.role.findUnique({ where: { key: DEMO_ROLE_KEY } });
  if (!role) {
    throw new Error(`Role "${DEMO_ROLE_KEY}" not found. Run \`pnpm db:seed\` first to seed roles.`);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: 'Demo (Solo lectura)', isActive: true, passwordHash },
    create: {
      email: DEMO_EMAIL,
      name: 'Demo (Solo lectura)',
      isActive: true,
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(`✓ Demo user listo: ${DEMO_EMAIL} / ${DEMO_PASSWORD} (rol: ${DEMO_ROLE_KEY})`);
}

main()
  .catch((e) => {
    console.error('❌ Seed demo failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
