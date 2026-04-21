import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type RoleKey =
  | 'admin'
  | 'senior_commercial'
  | 'sdr'
  | 'reviewer'
  | 'functional_consultant'
  | 'external_partner';

const ROLES: { key: RoleKey; name: string; description: string }[] = [
  { key: 'admin', name: 'Administrador', description: 'Administrador del sistema con acceso total' },
  { key: 'senior_commercial', name: 'Comercial Senior', description: 'Comercial senior con cartera de cuentas' },
  { key: 'sdr', name: 'SDR / Outbound', description: 'Representante de desarrollo de ventas y prospección' },
  { key: 'reviewer', name: 'Revisor', description: 'Revisor de pipeline con acceso de solo lectura' },
  { key: 'functional_consultant', name: 'Consultor Funcional', description: 'Consultor funcional con acceso a oportunidades asignadas' },
  { key: 'external_partner', name: 'Partner Externo', description: 'Partner externo con acceso restringido' },
];

const PERMISSIONS: { key: string; resource: string; action: string; description: string }[] = [
  // Contacts
  { key: 'contacts:read:all', resource: 'contacts', action: 'read:all', description: 'Leer todos los contactos' },
  { key: 'contacts:read:own', resource: 'contacts', action: 'read:own', description: 'Leer solo los contactos propios' },
  { key: 'contacts:create', resource: 'contacts', action: 'create', description: 'Crear contactos' },
  { key: 'contacts:update:all', resource: 'contacts', action: 'update:all', description: 'Editar cualquier contacto' },
  { key: 'contacts:update:own', resource: 'contacts', action: 'update:own', description: 'Editar solo contactos propios' },
  { key: 'contacts:delete', resource: 'contacts', action: 'delete', description: 'Eliminar contactos' },
  { key: 'contacts:import_csv', resource: 'contacts', action: 'import_csv', description: 'Importar contactos desde CSV' },
  { key: 'contacts:export_csv', resource: 'contacts', action: 'export_csv', description: 'Exportar contactos a CSV' },

  // Accounts
  { key: 'accounts:read:all', resource: 'accounts', action: 'read:all', description: 'Leer todas las cuentas' },
  { key: 'accounts:read:own', resource: 'accounts', action: 'read:own', description: 'Leer solo cuentas propias' },
  { key: 'accounts:create', resource: 'accounts', action: 'create', description: 'Crear cuentas' },
  { key: 'accounts:update:all', resource: 'accounts', action: 'update:all', description: 'Editar cualquier cuenta' },
  { key: 'accounts:update:own', resource: 'accounts', action: 'update:own', description: 'Editar solo cuentas propias' },
  { key: 'accounts:delete', resource: 'accounts', action: 'delete', description: 'Eliminar cuentas' },

  // Opportunities
  { key: 'opportunities:read:all', resource: 'opportunities', action: 'read:all', description: 'Leer todas las oportunidades' },
  { key: 'opportunities:read:own', resource: 'opportunities', action: 'read:own', description: 'Leer solo oportunidades propias' },
  { key: 'opportunities:create', resource: 'opportunities', action: 'create', description: 'Crear oportunidades' },
  { key: 'opportunities:update:all', resource: 'opportunities', action: 'update:all', description: 'Editar cualquier oportunidad' },
  { key: 'opportunities:update:own', resource: 'opportunities', action: 'update:own', description: 'Editar solo oportunidades propias' },
  { key: 'opportunities:delete', resource: 'opportunities', action: 'delete', description: 'Eliminar oportunidades' },
  { key: 'opportunities:change_stage', resource: 'opportunities', action: 'change_stage', description: 'Cambiar stage de oportunidades' },

  // Activities
  { key: 'activities:read', resource: 'activities', action: 'read', description: 'Leer actividades' },
  { key: 'activities:create', resource: 'activities', action: 'create', description: 'Crear actividades' },
  { key: 'activities:update:own', resource: 'activities', action: 'update:own', description: 'Editar actividades propias' },
  { key: 'activities:delete:own', resource: 'activities', action: 'delete:own', description: 'Eliminar actividades propias' },

  // Reports
  { key: 'reports:read:all', resource: 'reports', action: 'read:all', description: 'Ver todos los reportes' },
  { key: 'reports:read:own', resource: 'reports', action: 'read:own', description: 'Ver solo reportes propios' },
  { key: 'reports:create', resource: 'reports', action: 'create', description: 'Crear reportes' },
  { key: 'reports:export', resource: 'reports', action: 'export', description: 'Exportar reportes' },

  // Users
  { key: 'users:read', resource: 'users', action: 'read', description: 'Ver usuarios' },
  { key: 'users:invite', resource: 'users', action: 'invite', description: 'Invitar usuarios' },
  { key: 'users:update', resource: 'users', action: 'update', description: 'Editar usuarios' },
  { key: 'users:deactivate', resource: 'users', action: 'deactivate', description: 'Desactivar usuarios' },

  // Settings
  { key: 'settings:read', resource: 'settings', action: 'read', description: 'Ver configuración' },
  { key: 'settings:update', resource: 'settings', action: 'update', description: 'Modificar configuración' },

  // Audit
  { key: 'audit:read', resource: 'audit', action: 'read', description: 'Ver log de auditoría' },
];

const ROLE_PERMISSIONS: Record<RoleKey, string[] | 'ALL'> = {
  admin: 'ALL',

  senior_commercial: [
    'contacts:read:all',
    'contacts:create',
    'contacts:update:own',
    'contacts:export_csv',
    'accounts:read:all',
    'accounts:create',
    'accounts:update:own',
    'opportunities:read:all',
    'opportunities:create',
    'opportunities:update:own',
    'opportunities:change_stage',
    'activities:read',
    'activities:create',
    'activities:update:own',
    'activities:delete:own',
    'reports:read:all',
    'reports:export',
  ],

  sdr: [
    'contacts:read:all',
    'contacts:read:own',
    'contacts:create',
    'contacts:update:all',
    'contacts:update:own',
    'contacts:delete',
    'contacts:import_csv',
    'contacts:export_csv',
    'accounts:read:all',
    'accounts:create',
    'opportunities:read:own',
    'opportunities:create',
    'activities:read',
    'activities:create',
    'activities:update:own',
    'activities:delete:own',
    'reports:read:own',
  ],

  reviewer: [
    'contacts:read:all',
    'accounts:read:all',
    'opportunities:read:all',
    'reports:read:all',
    'activities:read',
    'activities:create',
    'audit:read',
  ],

  functional_consultant: [
    'contacts:read:own',
    'opportunities:read:own',
    'activities:read',
    'activities:create',
    'activities:update:own',
    'activities:delete:own',
  ],

  external_partner: [
    'contacts:read:own',
    'opportunities:read:own',
    'activities:read',
  ],
};

async function main() {
  console.log('🌱 Starting seed...');

  // Roles
  console.log('Seeding roles...');
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { key: role.key, name: role.name, description: role.description, isSystem: true },
    });
  }

  // Permissions
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { resource: perm.resource, action: perm.action, description: perm.description },
      create: perm,
    });
  }

  // Role -> Permission assignments
  console.log('Assigning permissions to roles...');
  const allPermissions = await prisma.permission.findMany();
  const permissionMap = new Map(allPermissions.map((p) => [p.key, p.id]));

  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permKeys = perms === 'ALL' ? allPermissions.map((p) => p.key) : perms;

    for (const permKey of permKeys) {
      const permId = permissionMap.get(permKey);
      if (!permId) {
        console.warn(`  ⚠️  Permission not found: ${permKey}`);
        continue;
      }
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permId },
      });
    }
    console.log(`  ✓ ${roleKey}: ${permKeys.length} permissions`);
  }

  // Admin seed user
  console.log('Seeding admin user...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.warn('  ⚠️  SEED_ADMIN_PASSWORD not set — admin user will not have a password.');
  }

  const passwordHash = adminPassword ? await bcrypt.hash(adminPassword, 12) : null;

  const adminUser = await prisma.user.upsert({
    where: { email: 'alwheelock@sysde.com' },
    update: {
      name: 'Alberto Wheelock',
      isActive: true,
      ...(passwordHash && { passwordHash }),
    },
    create: {
      email: 'alwheelock@sysde.com',
      name: 'Alberto Wheelock',
      isActive: true,
      passwordHash,
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { key: 'admin' } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: adminRole.id },
    });
  }

  console.log(`  ✓ Admin user: ${adminUser.email}`);

  // Tags
  console.log('Seeding tags...');
  const TAGS = [
    { name: 'High Priority', color: '#EF4444' },
    { name: 'Decision Maker', color: '#C8200F' },
    { name: 'Technical Buyer', color: '#3B82F6' },
    { name: 'Champion', color: '#10B981' },
    { name: 'Cold Lead', color: '#64748B' },
    { name: 'Referred', color: '#F59E0B' },
    { name: 'Event Lead', color: '#8B5CF6' },
    { name: 'RFP Active', color: '#EC4899' },
    { name: 'Competitor Client', color: '#0EA5E9' },
    { name: 'Partner Contact', color: '#14B8A6' },
  ];
  for (const tag of TAGS) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: { color: tag.color },
      create: tag,
    });
  }
  console.log(`  ✓ ${TAGS.length} tags`);

  // Test contacts
  console.log('Seeding test contacts...');
  const tagMap = new Map(
    (await prisma.tag.findMany()).map((t) => [t.name, t.id])
  );

  const TEST_CONTACTS = [
    {
      email: 'lourdes.ramirez@bancatest-mx.example',
      firstName: 'Lourdes',
      lastName: 'Ramírez',
      jobTitle: 'Directora de TI',
      companyName: 'Banca Test México',
      country: 'México',
      city: 'Ciudad de México',
      phone: '+52 55 1234 5678',
      source: 'LINKEDIN_INBOUND' as const,
      status: 'ACTIVE' as const,
      seniorityLevel: 'DIRECTOR' as const,
      marketSegment: 'BANK' as const,
      ownerEmail: 'alwheelock@sysde.com',
      tags: ['High Priority', 'Decision Maker'],
    },
    {
      email: 'carlos.mendoza@cooptest-pe.example',
      firstName: 'Carlos',
      lastName: 'Mendoza',
      jobTitle: 'CIO',
      companyName: 'Cooperativa Test Perú',
      country: 'Perú',
      city: 'Lima',
      phone: '+51 1 234 5678',
      source: 'REFERRAL' as const,
      status: 'NURTURE' as const,
      seniorityLevel: 'C_LEVEL' as const,
      marketSegment: 'COOPERATIVE' as const,
      ownerEmail: 'alwheelock@sysde.com',
      tags: ['Champion', 'Referred'],
    },
    {
      email: 'andrea.torres@microfin-co.example',
      firstName: 'Andrea',
      lastName: 'Torres',
      jobTitle: 'Gerente de Operaciones',
      companyName: 'Microfinanzas Test Colombia',
      country: 'Colombia',
      city: 'Bogotá',
      source: 'EVENT' as const,
      status: 'ACTIVE' as const,
      seniorityLevel: 'MANAGER' as const,
      marketSegment: 'MICROFINANCE' as const,
      tags: ['Event Lead'],
    },
    {
      email: 'juan.solano@financrtest-cr.example',
      firstName: 'Juan',
      lastName: 'Solano',
      jobTitle: 'Subgerente Financiero',
      companyName: 'Financiera Test Costa Rica',
      country: 'Costa Rica',
      city: 'San José',
      source: 'WEBSITE_FORM' as const,
      status: 'COLD' as const,
      seniorityLevel: 'MANAGER' as const,
      marketSegment: 'FINANCE_COMPANY' as const,
      tags: ['Cold Lead'],
    },
    {
      email: 'maria.jimenez@banktest-do.example',
      firstName: 'María',
      lastName: 'Jiménez',
      jobTitle: 'VP Tecnología',
      companyName: 'Banco Test República Dominicana',
      country: 'República Dominicana',
      city: 'Santo Domingo',
      source: 'OUTBOUND_CAMPAIGN' as const,
      status: 'ACTIVE' as const,
      seniorityLevel: 'VP' as const,
      marketSegment: 'BANK' as const,
      tags: ['RFP Active', 'Decision Maker'],
    },
  ];

  for (const c of TEST_CONTACTS) {
    const { tags, ownerEmail, ...data } = c;
    const owner = ownerEmail
      ? await prisma.user.findUnique({ where: { email: ownerEmail } })
      : null;

    const contact = await prisma.contact.upsert({
      where: { email: data.email },
      update: {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`,
        ownerId: owner?.id,
      },
      create: {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`,
        ownerId: owner?.id,
        createdById: owner?.id,
      },
    });

    await prisma.contactTag.deleteMany({ where: { contactId: contact.id } });
    for (const tagName of tags) {
      const tagId = tagMap.get(tagName);
      if (!tagId) continue;
      await prisma.contactTag.create({
        data: { contactId: contact.id, tagId },
      });
    }
  }
  console.log(`  ✓ ${TEST_CONTACTS.length} test contacts`);

  // Fake import batches for history
  console.log('Seeding fake import batches...');
  const existingBatches = await prisma.importBatch.count();
  if (existingBatches === 0) {
    const batches = [
      {
        fileName: 'leads-q1-mexico.csv',
        fileSize: 45_230,
        totalRows: 120,
        createdCount: 98,
        updatedCount: 12,
        skippedCount: 8,
        failedCount: 2,
        status: 'COMPLETED_WITH_ERRORS' as const,
        completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        fileName: 'eventos-fintech-2025.csv',
        fileSize: 12_800,
        totalRows: 45,
        createdCount: 45,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        status: 'COMPLETED' as const,
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        fileName: 'cooperativas-peru.csv',
        fileSize: 28_900,
        totalRows: 67,
        createdCount: 60,
        updatedCount: 4,
        skippedCount: 3,
        failedCount: 0,
        status: 'COMPLETED' as const,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];
    for (const b of batches) {
      await prisma.importBatch.create({
        data: {
          ...b,
          columnMapping: { email: 'email', first_name: 'firstName', last_name: 'lastName' },
          dedupeStrategy: 'SKIP',
          createdById: adminUser.id,
          startedAt: b.completedAt,
        },
      });
    }
    console.log(`  ✓ ${batches.length} import batches`);
  } else {
    console.log(`  ↩︎  Skipped (${existingBatches} already exist)`);
  }

  console.log('✅ Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
