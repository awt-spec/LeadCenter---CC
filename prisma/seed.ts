import { PrismaClient, type Prisma } from '@prisma/client';
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

  // Accounts
  console.log('Seeding accounts...');
  const ACCOUNTS = [
    { key: 'banco-horizonte', name: 'Banco Horizonte', domain: 'bancohorizonte.example', country: 'México', segment: 'BANK' as const, size: 'LARGE' as const, status: 'ACTIVE' as const, employeeCount: 850, city: 'Ciudad de México', region: 'LATAM' },
    { key: 'financiera-andina', name: 'Financiera Andina', domain: 'fandina.example', country: 'Perú', segment: 'FINANCE_COMPANY' as const, size: 'MEDIUM' as const, status: 'ACTIVE' as const, employeeCount: 180, city: 'Lima', region: 'LATAM' },
    { key: 'cooperahorro', name: 'CooperAhorro', domain: 'cooperahorro.example', country: 'Colombia', segment: 'COOPERATIVE' as const, size: 'MEDIUM' as const, status: 'PROSPECT' as const, employeeCount: 120, city: 'Bogotá', region: 'LATAM' },
    { key: 'microcredito-sur', name: 'MicroCrédito del Sur', domain: 'microsur.example', country: 'Guatemala', segment: 'MICROFINANCE' as const, size: 'SMALL' as const, status: 'ACTIVE' as const, employeeCount: 40, city: 'Ciudad de Guatemala', region: 'CENTRAL_AMERICA' },
    { key: 'fondo-pensiones-central', name: 'Fondo Pensiones Central', domain: 'fpc.example', country: 'Costa Rica', segment: 'PENSION_FUND' as const, size: 'LARGE' as const, status: 'PROSPECT' as const, employeeCount: 310, city: 'San José', region: 'CENTRAL_AMERICA' },
    { key: 'grupo-atlantico', name: 'Grupo Financiero Atlántico', domain: 'atlantico.example', country: 'República Dominicana', segment: 'BANK' as const, size: 'ENTERPRISE' as const, status: 'ACTIVE' as const, employeeCount: 2200, city: 'Santo Domingo', region: 'CARIBBEAN' },
    { key: 'seguros-tropical', name: 'Seguros Tropical', domain: 'strop.example', country: 'Panamá', segment: 'INSURANCE' as const, size: 'MEDIUM' as const, status: 'PROSPECT' as const, employeeCount: 240, city: 'Ciudad de Panamá', region: 'CENTRAL_AMERICA' },
    { key: 'retail-credit-plaza', name: 'Retail Credit Plaza', domain: 'rcplaza.example', country: 'El Salvador', segment: 'RETAIL' as const, size: 'MEDIUM' as const, status: 'ACTIVE' as const, employeeCount: 150, city: 'San Salvador', region: 'CENTRAL_AMERICA' },
  ];

  const accountMap = new Map<string, string>();
  for (const a of ACCOUNTS) {
    const { key, ...data } = a;
    const acc = await prisma.account.upsert({
      where: { domain: data.domain! },
      update: data,
      create: { ...data, ownerId: adminUser.id, createdById: adminUser.id },
    });
    accountMap.set(key, acc.id);
  }

  // Subsidiarias de Grupo Atlántico
  const parentId = accountMap.get('grupo-atlantico')!;
  const subs = [
    { key: 'atlantico-banca', name: 'Atlántico Banca Personal', domain: 'banca.atlantico.example' },
    { key: 'atlantico-empresas', name: 'Atlántico Empresas', domain: 'empresas.atlantico.example' },
  ];
  for (const s of subs) {
    const sub = await prisma.account.upsert({
      where: { domain: s.domain },
      update: { name: s.name, parentAccountId: parentId },
      create: {
        name: s.name,
        domain: s.domain,
        country: 'República Dominicana',
        segment: 'BANK',
        size: 'LARGE',
        status: 'ACTIVE',
        parentAccountId: parentId,
        ownerId: adminUser.id,
        createdById: adminUser.id,
      },
    });
    accountMap.set(s.key, sub.id);
  }
  console.log(`  ✓ ${ACCOUNTS.length + subs.length} accounts`);

  // Opportunities
  console.log('Seeding opportunities...');
  const existingOpps = await prisma.opportunity.count();
  if (existingOpps === 0) {
    const year = new Date().getFullYear();
    let seq = 0;
    const code = () => {
      seq += 1;
      return `OPP-${year}-${String(seq).padStart(4, '0')}`;
    };

    const OPPS = [
      { accountKey: 'banco-horizonte', name: 'SAF+ Full para banca retail', stage: 'LEAD' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_FULL' as const, rating: 'A_PLUS' as const, value: 750000 },
      { accountKey: 'financiera-andina', name: 'Upgrade SAF+ Crédito', stage: 'LEAD' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_CREDIT' as const, rating: 'B' as const, value: 180000 },
      { accountKey: 'cooperahorro', name: 'FileMaster BPM cooperativa', stage: 'DISCOVERY' as const, product: 'FILEMASTER' as const, subProduct: 'FM_BPM' as const, rating: 'A' as const, value: 220000 },
      { accountKey: 'microcredito-sur', name: 'SAF+ Leasing microfinanzas', stage: 'DISCOVERY' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_LEASING' as const, rating: 'B_PLUS' as const, value: 95000 },
      { accountKey: 'fondo-pensiones-central', name: 'SYSDE Pensión — recordkeeping', stage: 'SIZING' as const, product: 'SYSDE_PENSION' as const, subProduct: 'PENSION_RECORDKEEPING' as const, rating: 'A_PLUS' as const, value: 600000 },
      { accountKey: 'grupo-atlantico', name: 'Sentinel PLD corporativo', stage: 'DEMO' as const, product: 'SENTINEL_PLD' as const, subProduct: 'PLD_FULL' as const, rating: 'A' as const, value: 480000 },
      { accountKey: 'atlantico-empresas', name: 'Factoraje OnCloud empresarial', stage: 'DEMO' as const, product: 'FACTORAJE_ONCLOUD' as const, subProduct: 'FACTORAJE_REVERSE' as const, rating: 'B_PLUS' as const, value: 310000 },
      { accountKey: 'seguros-tropical', name: 'FileMaster Full aseguradora', stage: 'PROPOSAL' as const, product: 'FILEMASTER' as const, subProduct: 'FM_FULL' as const, rating: 'A' as const, value: 420000 },
      { accountKey: 'retail-credit-plaza', name: 'SAF+ Crédito retail', stage: 'PROPOSAL' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_CREDIT' as const, rating: 'B' as const, value: 160000 },
      { accountKey: 'banco-horizonte', name: 'PLD Monitoring fase 2', stage: 'NEGOTIATION' as const, product: 'SENTINEL_PLD' as const, subProduct: 'PLD_MONITORING' as const, rating: 'A_PLUS' as const, value: 290000 },
      { accountKey: 'financiera-andina', name: 'Factoraje directo PYMEs', stage: 'WON' as const, product: 'FACTORAJE_ONCLOUD' as const, subProduct: 'FACTORAJE_DIRECT' as const, rating: 'A' as const, value: 140000, status: 'WON' as const },
      { accountKey: 'cooperahorro', name: 'POC SAF+ Factoring', stage: 'LOST' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_FACTORING' as const, rating: 'C' as const, value: 85000, status: 'LOST' as const, lostReason: 'NO_BUDGET' as const },

      // Pipeline fill (10 adicionales)
      { accountKey: 'microcredito-sur', name: 'FileMaster Documentos microfinanzas', stage: 'DISCOVERY' as const, product: 'FILEMASTER' as const, subProduct: 'FM_DOCUMENTS' as const, rating: 'B' as const, value: 42000 },
      { accountKey: 'retail-credit-plaza', name: 'Sentinel PLD retail', stage: 'DISCOVERY' as const, product: 'SENTINEL_PLD' as const, subProduct: 'PLD_MONITORING' as const, rating: 'B_PLUS' as const, value: 135000 },
      { accountKey: 'atlantico-banca', name: 'SAF+ Full banca personal', stage: 'DISCOVERY' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_FULL' as const, rating: 'A' as const, value: 880000 },
      { accountKey: 'seguros-tropical', name: 'SYSDE Pensión — evaluación', stage: 'DEMO' as const, product: 'SYSDE_PENSION' as const, subProduct: 'PENSION_RECORDKEEPING' as const, rating: 'B_PLUS' as const, value: 230000 },
      { accountKey: 'fondo-pensiones-central', name: 'Sentinel PLD pensional', stage: 'DEMO' as const, product: 'SENTINEL_PLD' as const, subProduct: 'PLD_FULL' as const, rating: 'A' as const, value: 390000 },
      { accountKey: 'cooperahorro', name: 'Factoraje OnCloud cooperativa', stage: 'DEMO' as const, product: 'FACTORAJE_ONCLOUD' as const, subProduct: 'FACTORAJE_REVERSE' as const, rating: 'C' as const, value: 78000 },
      { accountKey: 'banco-horizonte', name: 'FileMaster BPM riesgo', stage: 'NEGOTIATION' as const, product: 'FILEMASTER' as const, subProduct: 'FM_BPM' as const, rating: 'A_PLUS' as const, value: 1_150_000 },
      { accountKey: 'financiera-andina', name: 'SAF+ Leasing automotriz', stage: 'NEGOTIATION' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_LEASING' as const, rating: 'B_PLUS' as const, value: 265000 },
      { accountKey: 'microcredito-sur', name: 'Factoraje OnCloud POC', stage: 'CLOSING' as const, product: 'FACTORAJE_ONCLOUD' as const, subProduct: 'FACTORAJE_DIRECT' as const, rating: 'A' as const, value: 52000 },
      { accountKey: 'retail-credit-plaza', name: 'SAF+ Factoring retail', stage: 'HANDOFF' as const, product: 'SAF_PLUS' as const, subProduct: 'SAF_FACTORING' as const, rating: 'A' as const, value: 310000 },
    ];

    const allContacts = await prisma.contact.findMany({ select: { id: true } });
    const contactIds = allContacts.map((c) => c.id);

    let oppIndex = 0;
    for (const o of OPPS) {
      oppIndex++;
      const accountId = accountMap.get(o.accountKey);
      if (!accountId) continue;
      const probability =
        { LEAD: 5, DISCOVERY: 15, SIZING: 25, DEMO: 40, PROPOSAL: 60, NEGOTIATION: 75, CLOSING: 90, HANDOFF: 95, WON: 100, LOST: 0, STAND_BY: 10, NURTURE: 5 }[o.stage];

      const expectedClose = new Date();
      expectedClose.setDate(expectedClose.getDate() + Math.floor(Math.random() * 120) + 30);

      // Variar próximas acciones: algunas vencidas, algunas hoy, algunas futuras
      let nextAction: Date | null = null;
      if (o.status !== 'WON' && o.status !== 'LOST') {
        const offset = (oppIndex % 5) - 2; // -2, -1, 0, 1, 2 días
        nextAction = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
      }

      const opp = await prisma.opportunity.create({
        data: {
          name: o.name,
          code: code(),
          accountId,
          product: o.product,
          subProduct: o.subProduct,
          stage: o.stage,
          status: o.status ?? 'OPEN',
          rating: o.rating,
          probability,
          estimatedValue: o.value,
          currency: 'USD',
          expectedCloseDate: expectedClose,
          closedAt: o.status === 'WON' || o.status === 'LOST' ? new Date() : null,
          lostReason: o.lostReason,
          lostReasonDetail: o.lostReason ? 'Ajuste presupuestal para 2026' : null,
          wonReason: o.status === 'WON' ? 'Mejor propuesta técnica y comercial' : null,
          source: 'REFERRAL',
          ownerId: adminUser.id,
          createdById: adminUser.id,
          commercialModel: 'SAAS',
          nextActionDate: nextAction,
          nextActionNote: nextAction ? 'Siguiente reunión con sponsor' : null,
        },
      });

      // Link 1-2 random contacts with varied roles
      const rolesByIdx: Array<'SPONSOR' | 'DECISION_MAKER' | 'CHAMPION' | 'INFLUENCER' | 'TECHNICAL_BUYER'> = [
        'DECISION_MAKER',
        'CHAMPION',
      ];
      const pick = contactIds.sort(() => 0.5 - Math.random()).slice(0, 2);
      for (let i = 0; i < pick.length; i++) {
        await prisma.opportunityContact.create({
          data: {
            opportunityId: opp.id,
            contactId: pick[i]!,
            role: rolesByIdx[i] ?? 'INFLUENCER',
            isPrimary: i === 0,
          },
        });
      }

      // Fake stage history
      await prisma.stageHistory.create({
        data: {
          opportunityId: opp.id,
          fromStage: null,
          toStage: 'LEAD',
          changedById: adminUser.id,
          changedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          notes: 'Oportunidad creada',
        },
      });
      if (o.stage !== 'LEAD') {
        await prisma.stageHistory.create({
          data: {
            opportunityId: opp.id,
            fromStage: 'LEAD',
            toStage: o.stage,
            changedById: adminUser.id,
            changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            daysInPreviousStage: 15,
            notes: 'Avance inicial tras calificación',
          },
        });
      }
    }
    console.log(`  ✓ ${OPPS.length} opportunities`);
  } else {
    console.log(`  ↩︎  Skipped (${existingOpps} already exist)`);
  }

  // Activities
  console.log('Seeding activities...');
  const existingActivities = await prisma.activity.count();
  if (existingActivities === 0) {
    const allOpps = await prisma.opportunity.findMany({
      select: { id: true, name: true, accountId: true },
    });
    const allCs = await prisma.contact.findMany({ select: { id: true, accountId: true } });
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });

    const dayMs = 24 * 60 * 60 * 1000;
    const daysAgo = (n: number) => new Date(Date.now() - n * dayMs);

    type Seed = {
      type: import('@prisma/client').ActivityType;
      subject: string;
      body: string;
      occurredAt: Date;
      tags?: import('@prisma/client').ActivityTag[];
      opp?: number;
      contact?: number;
      nextDays?: number | null;
      nextType?: import('@prisma/client').NextActionType;
      outcome?: import('@prisma/client').ActivityOutcome;
      template?: string;
      participantIdx?: number[];
    };

    const seeds: Seed[] = [
      { type: 'CALL', subject: 'Llamada inicial de calificación', body: 'Cliente interesado en SAF+ Crédito. Pidió enviar materiales.', occurredAt: daysAgo(58), tags: ['INFO'], opp: 0, nextDays: 3, nextType: 'EMAIL', outcome: 'POSITIVE', template: 'call_quick' },
      { type: 'MEETING', subject: 'Reunión de indagación · Banca digital', body: 'Reunión con CIO y equipo de TI. Levantamos requerimientos clave.', occurredAt: daysAgo(50), tags: ['INFO', 'WIN_SIGNAL'], opp: 0, nextDays: 7, nextType: 'DEMO', outcome: 'POSITIVE', template: 'discovery_meeting', participantIdx: [0, 1] },
      { type: 'DEMO', subject: 'Demo ejecutiva SAF+', body: 'Presentación a directorio. Buena recepción de los módulos de cobranza.', occurredAt: daysAgo(40), tags: ['WIN_SIGNAL'], opp: 0, nextDays: 5, nextType: 'SEND_PROPOSAL', outcome: 'POSITIVE', template: 'demo_executive', participantIdx: [0] },
      { type: 'EMAIL_SENT', subject: 'Envío de materiales técnicos', body: 'Whitepapers y casos de éxito enviados al cliente.', occurredAt: daysAgo(35), tags: ['INFO'], opp: 1, outcome: 'NEUTRAL', template: 'email_sent' },
      { type: 'CALL', subject: 'Seguimiento — propuesta', body: 'Cliente revisó la propuesta. Tiene preguntas sobre integraciones.', occurredAt: daysAgo(28), tags: ['CONSUL'], opp: 7, nextDays: 2, nextType: 'CALL', outcome: 'POSITIVE', template: 'call_quick' },
      { type: 'WHATSAPP', subject: 'Coordinación de demo', body: 'Coordinamos sala virtual y agenda con stakeholders.', occurredAt: daysAgo(22), tags: ['INFO'], opp: 5, nextDays: 4, nextType: 'MEETING', outcome: 'POSITIVE', template: 'whatsapp_exchange' },
      { type: 'INTERNAL_NOTE', subject: 'Consulta interna sobre pricing', body: '@Mafe necesitamos definir si aplicamos descuento por volumen para esta cuenta.', occurredAt: daysAgo(20), tags: ['CONSUL'], opp: 2, template: 'consul_internal' },
      { type: 'PROPOSAL_SENT', subject: 'Propuesta v1 enviada', body: 'Modelo SaaS, 3 años, descuento por volumen aplicado.', occurredAt: daysAgo(18), tags: ['INFO', 'FOLLOWUP'], opp: 7, nextDays: 7, nextType: 'CALL', outcome: 'POSITIVE', template: 'proposal_sent' },
      { type: 'EMAIL_RECEIVED', subject: 'Cliente solicita ajustes a propuesta', body: 'Pidieron desglose de servicios profesionales y opción de pago anual.', occurredAt: daysAgo(15), tags: ['SOLIC'], opp: 7, nextDays: 3, nextType: 'SEND_PROPOSAL', outcome: 'NEUTRAL' },
      { type: 'MEETING', subject: 'Indagación · cooperativa LATAM', body: 'Identificamos pain points en su sistema legacy.', occurredAt: daysAgo(14), tags: ['INFO'], opp: 2, nextDays: 5, nextType: 'DEMO', outcome: 'POSITIVE', template: 'discovery_meeting', participantIdx: [2, 3] },
      { type: 'CALL', subject: 'Llamada con sponsor', body: 'Sponsor confirma presupuesto para 2026 Q2.', occurredAt: daysAgo(12), tags: ['WIN_SIGNAL'], opp: 9, nextDays: 4, nextType: 'MEETING', outcome: 'POSITIVE' },
      { type: 'DEMO', subject: 'Demo técnica · módulos PLD', body: 'Mostramos integración con core bancario. Buen feedback técnico.', occurredAt: daysAgo(10), tags: ['INFO'], opp: 5, nextDays: 6, nextType: 'INTERNAL_TASK', outcome: 'POSITIVE', template: 'demo_technical', participantIdx: [4] },
      { type: 'MATERIAL_SENT', subject: 'Material adicional · cumplimiento normativo', body: 'Enviamos guía de cumplimiento PLD y matriz de controles.', occurredAt: daysAgo(9), tags: ['INFO'], opp: 5, template: 'material_sent' },
      { type: 'INTERNAL_NOTE', subject: 'Riesgo: cliente está hablando con competencia', body: '@Eduardo aviso porque mencionaron a Temenos en la última llamada.', occurredAt: daysAgo(8), tags: ['BL', 'RISK_SIGNAL'], opp: 9 },
      { type: 'CALL', subject: 'Llamada de cierre', body: 'Cliente lista para firmar. Coordinamos paso a legal.', occurredAt: daysAgo(7), tags: ['WIN_SIGNAL'], opp: 8, nextDays: 2, nextType: 'INTERNAL_TASK', outcome: 'POSITIVE' },
      { type: 'EMAIL_SENT', subject: 'Envío de contrato', body: 'Contrato firmado por SYSDE enviado para firma del cliente.', occurredAt: daysAgo(6), tags: ['INFO'], opp: 8, nextDays: 5, nextType: 'WAIT_FOR_CLIENT' },
      { type: 'WHATSAPP', subject: 'Confirmación de recepción', body: 'Cliente confirmó recepción del contrato.', occurredAt: daysAgo(5), tags: ['INFO'], opp: 8, outcome: 'POSITIVE' },
      { type: 'EVENT_ATTENDED', subject: 'FinTech Summit Lima', body: 'Encuentro con prospectos en la conferencia.', occurredAt: daysAgo(4), tags: ['INFO'], contact: 1, nextDays: 7, nextType: 'EMAIL' },
      { type: 'LINKEDIN_MESSAGE', subject: 'Conexión con CTO', body: 'Aceptó conexión y agenda llamada de 30 min.', occurredAt: daysAgo(3), tags: ['INFO'], contact: 0, nextDays: 5, nextType: 'CALL' },
      { type: 'CALL', subject: 'Discovery · pensiones LATAM', body: 'Levantamos necesidades de recordkeeping y compliance.', occurredAt: daysAgo(3), tags: ['INFO', 'WIN_SIGNAL'], opp: 4, nextDays: 7, nextType: 'DEMO', outcome: 'POSITIVE', template: 'call_quick' },
      { type: 'INTERNAL_NOTE', subject: 'Seguimiento bloqueado por procurement', body: 'Procurement del cliente exige RFP formal antes de avanzar.', occurredAt: daysAgo(2), tags: ['BL'], opp: 6, outcome: 'BLOCKER' },
      { type: 'EMAIL_SENT', subject: 'Respuesta a RFP — sección técnica', body: 'Equipo técnico envió respuesta a la sección 4 del RFP.', occurredAt: daysAgo(2), tags: ['INFO'], opp: 6, nextDays: 5, nextType: 'WAIT_FOR_CLIENT' },
      { type: 'MEETING', subject: 'Workshop con consultor funcional', body: 'Sesión de 2hs para mapear procesos del cliente.', occurredAt: daysAgo(2), tags: ['INFO'], opp: 11, nextDays: 4, nextType: 'INTERNAL_TASK', participantIdx: [2, 3, 4] },
      { type: 'CALL', subject: 'Check-in semanal con champion', body: 'Champion confirma avance interno y nos da heads-up de timeline.', occurredAt: daysAgo(1), tags: ['INFO', 'WIN_SIGNAL'], opp: 0, nextDays: 5, nextType: 'CALL', outcome: 'POSITIVE' },
      { type: 'WHATSAPP', subject: 'Pregunta rápida sobre soporte', body: 'Cliente preguntó por SLA. Confirmamos 24x7 para tier 1.', occurredAt: daysAgo(1), tags: ['SOLIC'], opp: 9, outcome: 'POSITIVE' },
      { type: 'EMAIL_RECEIVED', subject: 'Confirmación de fecha de demo', body: 'Cliente confirmó fecha y asistentes.', occurredAt: daysAgo(0), tags: ['INFO'], opp: 5, outcome: 'POSITIVE' },
      { type: 'INTERNAL_NOTE', subject: 'Update equipo · pipeline Q2', body: '@Alberto resumen: 3 deals en cierre, 2 con riesgo, 1 stand-by.', occurredAt: daysAgo(0), tags: ['INFO'] },
      { type: 'CALL', subject: 'Llamada con partner regional', body: 'Coordinamos ejecución conjunta para cuenta clave.', occurredAt: daysAgo(0), tags: ['INFO'], opp: 10, outcome: 'POSITIVE' },
      { type: 'TASK', subject: 'Preparar pricing especial Q2', body: 'Preparar simulación con descuento progresivo por volumen.', occurredAt: daysAgo(0), tags: ['FOLLOWUP'], opp: 7, nextDays: 2, nextType: 'INTERNAL_TASK' },
      { type: 'EMAIL_SENT', subject: 'Resumen post-demo + propuesta inicial', body: 'Enviamos resumen de la demo con foco en los puntos que más resonaron.', occurredAt: daysAgo(0), tags: ['INFO'], opp: 5, nextDays: 7, nextType: 'CALL' },
    ];

    let activitiesCreated = 0;
    for (const s of seeds) {
      const oppRef = s.opp !== undefined && s.opp < allOpps.length ? allOpps[s.opp] : null;
      const contactRef = s.contact !== undefined && s.contact < allCs.length ? allCs[s.contact] : null;
      const accountId = oppRef?.accountId ?? contactRef?.accountId ?? null;

      const a = await prisma.activity.create({
        data: {
          type: s.type,
          subject: s.subject,
          bodyText: s.body,
          tags: s.tags ?? [],
          occurredAt: s.occurredAt,
          contactId: contactRef?.id ?? null,
          accountId,
          opportunityId: oppRef?.id ?? null,
          outcome: s.outcome ?? null,
          templateKey: s.template ?? null,
          nextActionType: s.nextType ?? null,
          nextActionDate: s.nextDays !== undefined && s.nextDays !== null
            ? new Date(Date.now() + s.nextDays * dayMs)
            : null,
          nextActionAssigneeId: adminUser.id,
          nextActionNote: s.nextDays !== undefined ? 'Seguimiento programado' : null,
          createdById: adminUser.id,
        },
      });

      if (s.participantIdx?.length) {
        for (const idx of s.participantIdx) {
          if (idx < allCs.length) {
            await prisma.activityParticipant.create({
              data: { activityId: a.id, contactId: allCs[idx]!.id },
            });
          }
        }
      }
      activitiesCreated++;
    }

    // System-generated activities (stage_change examples on first 3 opps)
    for (let i = 0; i < Math.min(3, allOpps.length); i++) {
      const opp = allOpps[i]!;
      await prisma.activity.create({
        data: {
          type: 'STAGE_CHANGE',
          subject: 'movió la oportunidad de LEAD a DISCOVERY',
          opportunityId: opp.id,
          accountId: opp.accountId,
          isSystemGenerated: true,
          systemEventType: 'stage_change',
          systemMetadata: { from: 'LEAD', to: 'DISCOVERY' } as Prisma.InputJsonValue,
          occurredAt: daysAgo(35 - i * 5),
          createdById: adminUser.id,
        },
      });
      activitiesCreated++;
    }

    // Sync opportunity nextActionDate from latest pending activity
    for (const opp of allOpps) {
      const next = await prisma.activity.findFirst({
        where: {
          opportunityId: opp.id,
          nextActionCompleted: false,
          nextActionDate: { not: null },
        },
        orderBy: { nextActionDate: 'asc' },
        select: { nextActionDate: true, nextActionNote: true },
      });
      if (next) {
        await prisma.opportunity.update({
          where: { id: opp.id },
          data: {
            nextActionDate: next.nextActionDate,
            nextActionNote: next.nextActionNote,
          },
        });
      }
    }

    // Insert a couple of mentions for admin
    if (allUsers.length > 1) {
      const otherUserId = allUsers.find((u) => u.id !== adminUser.id)?.id;
      if (otherUserId) {
        const sample = await prisma.activity.findMany({
          where: { type: 'INTERNAL_NOTE', createdById: adminUser.id },
          take: 3,
          orderBy: { createdAt: 'desc' },
        });
        for (const a of sample) {
          await prisma.activityMention.create({
            data: { activityId: a.id, mentionedUserId: otherUserId },
          });
        }
      }
    }

    console.log(`  ✓ ${activitiesCreated} activities`);
  } else {
    console.log(`  ↩︎  Skipped (${existingActivities} already exist)`);
  }

  // Notifications for admin
  console.log('Seeding notifications...');
  const existingNotifs = await prisma.notification.count({ where: { userId: adminUser.id } });
  if (existingNotifs === 0) {
    const dayMs = 24 * 60 * 60 * 1000;
    const recent = (n: number) => new Date(Date.now() - n * dayMs);
    await prisma.notification.createMany({
      data: [
        { userId: adminUser.id, type: 'MENTION', title: 'Eduardo te mencionó en una nota', body: 'Riesgo: cliente está hablando con competencia', link: '/activities', isRead: false, createdAt: recent(0) },
        { userId: adminUser.id, type: 'MENTION', title: 'Mafe te mencionó', body: 'Consulta sobre pricing especial', link: '/activities', isRead: false, createdAt: recent(1) },
        { userId: adminUser.id, type: 'MENTION', title: 'Sebastiana te mencionó en revisión', body: 'Revisión de propuesta v2', link: '/activities', isRead: false, createdAt: recent(2) },
        { userId: adminUser.id, type: 'ASSIGNED_NEXT_ACTION', title: 'Te asignaron una próxima acción', body: 'Llamada con champion · vence en 3 días', link: '/inbox', isRead: false, createdAt: recent(0) },
        { userId: adminUser.id, type: 'ASSIGNED_NEXT_ACTION', title: 'Acción asignada', body: 'Enviar propuesta ajustada', link: '/inbox', isRead: false, createdAt: recent(1) },
        { userId: adminUser.id, type: 'NEXT_ACTION_DUE', title: 'Acción vencida', body: 'Llamada de cierre con sponsor venció ayer', link: '/inbox', isRead: false, createdAt: recent(0) },
        { userId: adminUser.id, type: 'NEXT_ACTION_DUE', title: 'Acción vencida', body: 'Enviar propuesta venció hace 2 días', link: '/inbox', isRead: false, createdAt: recent(1) },
        { userId: adminUser.id, type: 'STAGE_CHANGED', title: 'Cambio de fase: DISCOVERY → DEMO', body: 'CooperAhorro · FileMaster BPM', link: '/pipeline', isRead: true, readAt: recent(2), createdAt: recent(2) },
        { userId: adminUser.id, type: 'STAGE_CHANGED', title: 'Cambio de fase: DEMO → PROPOSAL', body: 'Banco Horizonte · SAF+ Full', link: '/pipeline', isRead: true, readAt: recent(3), createdAt: recent(3) },
        { userId: adminUser.id, type: 'STAGE_CHANGED', title: 'Cambio de fase: PROPOSAL → NEGOTIATION', body: 'Seguros Tropical · FileMaster Full', link: '/pipeline', isRead: false, createdAt: recent(1) },
      ],
    });
    console.log('  ✓ 10 notifications');
  } else {
    console.log(`  ↩︎  Skipped (${existingNotifs} already exist)`);
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
