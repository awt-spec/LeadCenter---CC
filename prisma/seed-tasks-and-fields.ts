import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTasks() {
  const existing = await prisma.task.count();
  if (existing > 0) {
    console.log(`  ↩︎ Tasks: ya hay ${existing} en DB, salto.`);
    return;
  }

  const admin = await prisma.user.findUnique({ where: { email: 'alwheelock@sysde.com' } });
  if (!admin) throw new Error('Run pnpm db:seed first');

  const accounts = await prisma.account.findMany({ take: 5, select: { id: true, name: true } });
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const userIds = allUsers.map((u) => u.id);

  const samples = [
    {
      title: 'Confirmar fecha de demo con sponsor',
      description: 'Coordinar con el sponsor la fecha definitiva de la demo. Bloquear sala virtual + invitar a stakeholders técnicos.',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      tags: ['discovery', 'demo'],
    },
    {
      title: 'Preparar deck ejecutivo SAF+',
      description: 'Versión ejecutiva del deck — máximo 12 slides, foco en ROI y casos de éxito.',
      status: 'TODO' as const,
      priority: 'NORMAL' as const,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      tags: ['proposal'],
    },
    {
      title: 'Revisar respuesta de procurement',
      description: 'Equipo de procurement del cliente envió observaciones a la propuesta v2.',
      status: 'REVIEW' as const,
      priority: 'URGENT' as const,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      tags: ['procurement', 'urgente'],
    },
    {
      title: 'Setup de ambiente sandbox',
      description: 'Aprovisionar instancia sandbox en AWS. Configurar accesos para el equipo del cliente.',
      status: 'BLOCKED' as const,
      priority: 'HIGH' as const,
      tags: ['técnico'],
    },
    {
      title: 'Levantamiento técnico de integraciones',
      description: 'Sesión con el equipo de TI para mapear las integraciones requeridas con el core actual.',
      status: 'DONE' as const,
      priority: 'NORMAL' as const,
      tags: ['discovery', 'técnico'],
    },
    {
      title: 'Background check del cliente',
      description: 'Verificar referencias comerciales y rating crediticio.',
      status: 'BACKLOG' as const,
      priority: 'LOW' as const,
      tags: ['compliance'],
    },
    {
      title: 'Llamada con champion para alineación',
      description: 'Sync semanal con el champion para revisar avances y bloqueos.',
      status: 'TODO' as const,
      priority: 'NORMAL' as const,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      tags: ['follow-up'],
    },
    {
      title: 'Negociar términos de licencia',
      description: 'Revisar con legal los términos de SLA, indemnizaciones y propiedad intelectual.',
      status: 'IN_PROGRESS' as const,
      priority: 'URGENT' as const,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      tags: ['legal', 'negotiation'],
    },
  ];

  let created = 0;
  for (const acc of accounts) {
    // Distribuir 2 tasks por cuenta
    const slice = samples.slice(created, created + 2);
    for (const s of slice) {
      const assignees = userIds.slice(0, 1 + Math.floor(Math.random() * Math.min(2, userIds.length)));
      await prisma.task.create({
        data: {
          ...s,
          accountId: acc.id,
          createdById: admin.id,
          position: created,
          assignees: { create: assignees.map((userId) => ({ userId })) },
          comments:
            s.status === 'IN_PROGRESS' || s.status === 'REVIEW'
              ? {
                  create: [
                    {
                      userId: admin.id,
                      body: 'Avance reportado al cliente. Esperando feedback antes de Friday.',
                    },
                  ],
                }
              : undefined,
        },
      });
      created++;
    }
    if (created >= samples.length) break;
  }
  console.log(`  ✓ Tasks: ${created} sembradas`);
}

async function seedCustomFields() {
  const existing = await prisma.customFieldDefinition.count();
  if (existing > 0) {
    console.log(`  ↩︎ Custom fields: ya hay ${existing}, salto.`);
    return;
  }

  const fields = [
    // Contact
    {
      entity: 'CONTACT' as const,
      key: 'estructura_de_contacto',
      label: 'Estructura de Contacto',
      type: 'SELECT' as const,
      options: ['Rojo', 'Amarillo', 'Verde'],
      description: 'Calidad del contacto (heredado del CSV de Notion)',
    },
    {
      entity: 'CONTACT' as const,
      key: 'fuente_lista',
      label: 'Lista de origen',
      type: 'TEXT' as const,
      description: 'Nombre de la lista o evento de donde vino el contacto',
    },
    {
      entity: 'CONTACT' as const,
      key: 'fecha_ultimo_evento',
      label: 'Último evento asistido',
      type: 'DATE' as const,
    },
    {
      entity: 'CONTACT' as const,
      key: 'whatsapp',
      label: 'WhatsApp',
      type: 'PHONE' as const,
    },
    // Account
    {
      entity: 'ACCOUNT' as const,
      key: 'tier',
      label: 'Tier de cuenta',
      type: 'SELECT' as const,
      options: ['Tier 1', 'Tier 2', 'Tier 3'],
      description: 'Prioridad estratégica de la cuenta',
    },
    {
      entity: 'ACCOUNT' as const,
      key: 'fecha_renovacion',
      label: 'Próxima renovación',
      type: 'DATE' as const,
    },
    {
      entity: 'ACCOUNT' as const,
      key: 'cuentas_padre_grupo',
      label: 'Pertenece a grupo financiero',
      type: 'BOOLEAN' as const,
    },
    // Opportunity
    {
      entity: 'OPPORTUNITY' as const,
      key: 'requiere_rfp',
      label: 'Requiere RFP formal',
      type: 'BOOLEAN' as const,
    },
    {
      entity: 'OPPORTUNITY' as const,
      key: 'competidores',
      label: 'Competidores en juego',
      type: 'MULTI_SELECT' as const,
      options: ['Mambu', 'Temenos', 'Oracle FLEXCUBE', 'Lanvine', 'In-house'],
    },
    {
      entity: 'OPPORTUNITY' as const,
      key: 'link_drive',
      label: 'Carpeta de drive',
      type: 'URL' as const,
    },
  ];

  let pos = 0;
  for (const f of fields) {
    await prisma.customFieldDefinition.create({
      data: {
        entity: f.entity,
        key: f.key,
        label: f.label,
        type: f.type,
        options: 'options' in f && f.options ? (f.options as object) : undefined,
        description: 'description' in f ? f.description ?? null : null,
        position: pos,
      },
    });
    pos++;
  }
  console.log(`  ✓ Custom fields: ${fields.length} sembrados`);
}

async function main() {
  console.log('🌱 Seeding tasks + custom fields...');
  await seedTasks();
  await seedCustomFields();
  console.log('✅ Seed completado');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
