import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎯 Seeding sample campaigns...');

  const admin = await prisma.user.findUnique({ where: { email: 'alwheelock@sysde.com' } });
  if (!admin) throw new Error('Admin user not found. Run `pnpm db:seed` first.');

  const existing = await prisma.campaign.count();
  if (existing > 0) {
    console.log(`  ↩︎  Skipped (${existing} campaigns already exist).`);
    return;
  }

  const allContacts = await prisma.contact.findMany({ select: { id: true } });
  const allOpps = await prisma.opportunity.findMany({ select: { id: true, accountId: true } });

  const campaigns = [
    {
      name: 'Outbound Q2 banca digital LATAM',
      code: 'OB-Q2-LATAM',
      description: 'Secuencia de 6 toques a CIOs y directores de TI de bancos en LATAM con SAF+.',
      type: 'COLD_OUTBOUND' as const,
      status: 'ACTIVE' as const,
      goal: 'LEAD_GEN' as const,
      targetSegment: 'BANK' as const,
      targetCountry: 'LATAM',
      startDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      budget: 12000,
      spent: 7800,
      currency: 'USD',
      steps: [
        { type: 'EMAIL' as const, name: 'Email 1 — Apertura', delayDays: 0, emailSubject: 'Modernización del core para {{companyName}}', emailBody: 'Hola {{firstName}},\n\nVi que {{companyName}} está creciendo rápido en banca digital. Quería compartirte cómo SAF+ ayudó a Banco Horizonte a reducir 40% el time-to-market de productos.\n\n¿Te interesa ver una demo de 20min?' },
        { type: 'WAIT' as const, name: 'Esperar 4 días', delayDays: 4 },
        { type: 'EMAIL' as const, name: 'Email 2 — Caso de éxito', delayDays: 0, emailSubject: 'Caso: 40% reducción de time-to-market en Banco Horizonte' },
        { type: 'LINKEDIN' as const, name: 'Conexión LinkedIn', delayDays: 3 },
        { type: 'WAIT' as const, name: 'Esperar 5 días', delayDays: 5 },
        { type: 'CALL' as const, name: 'Llamada de calificación', delayDays: 0, callScript: 'Pain points clave: time-to-market, integración con core, cumplimiento regulatorio. Pregunta abierta: ¿qué proyectos críticos de tecnología tienen para 2026?' },
        { type: 'EMAIL' as const, name: 'Email 3 — Propuesta de demo', delayDays: 7, emailSubject: 'Última: ¿agendamos esa demo?' },
      ],
      enrolledContacts: allContacts.slice(0, 4).map((c) => c.id),
      attachOpps: allOpps.slice(0, 3).map((o) => o.id),
    },
    {
      name: 'Webinar: Sentinel PLD para cooperativas',
      code: 'WBN-PLD-COOP',
      description: 'Webinar de 45 min sobre PLD/AML para cooperativas de ahorro y crédito en CR y Guatemala.',
      type: 'WEBINAR' as const,
      status: 'COMPLETED' as const,
      goal: 'CONVERSION' as const,
      targetSegment: 'COOPERATIVE' as const,
      targetCountry: 'Costa Rica, Guatemala',
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
      budget: 3500,
      spent: 3200,
      currency: 'USD',
      steps: [
        { type: 'EMAIL' as const, name: 'Invitación al webinar', delayDays: 0, emailSubject: '¿Cómo cumplir PLD sin contratar 3 oficiales más?' },
        { type: 'EMAIL' as const, name: 'Recordatorio 24h', delayDays: 6 },
        { type: 'EMAIL' as const, name: 'Recordatorio 1h', delayDays: 0 },
        { type: 'EVENT_INVITE' as const, name: 'Webinar en vivo', delayDays: 0 },
        { type: 'EMAIL' as const, name: 'Follow-up post webinar', delayDays: 1, emailSubject: 'Gracias por venir + grabación + propuesta' },
        { type: 'CALL' as const, name: 'Llamada con asistentes hot', delayDays: 3 },
      ],
      enrolledContacts: allContacts.slice(1, 4).map((c) => c.id),
      attachOpps: allOpps.slice(2, 4).map((o) => o.id),
    },
    {
      name: 'Nurture mensual SAF+ existing customers',
      code: 'NUR-SAFC',
      description: 'Newsletter mensual para clientes actuales con tips, casos y cross-sell de módulos.',
      type: 'EMAIL_DRIP' as const,
      status: 'ACTIVE' as const,
      goal: 'RETENTION' as const,
      targetCountry: 'LATAM',
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      budget: 1500,
      spent: 600,
      currency: 'USD',
      steps: [
        { type: 'EMAIL' as const, name: 'Newsletter mes 1 — Cobranza inteligente', delayDays: 0 },
        { type: 'WAIT' as const, name: 'Mes', delayDays: 30 },
        { type: 'EMAIL' as const, name: 'Newsletter mes 2 — Reportería avanzada', delayDays: 0 },
        { type: 'WAIT' as const, name: 'Mes', delayDays: 30 },
        { type: 'EMAIL' as const, name: 'Newsletter mes 3 — SAF+ Leasing teaser', delayDays: 0 },
      ],
      enrolledContacts: allContacts.map((c) => c.id),
      attachOpps: [],
    },
    {
      name: 'Referral program 2026',
      code: 'REF-2026',
      description: 'Programa formal: 10% de descuento al referente y al referido en su primer año.',
      type: 'REFERRAL' as const,
      status: 'DRAFT' as const,
      goal: 'REFERRAL' as const,
      targetCountry: 'Global',
      budget: 5000,
      currency: 'USD',
      steps: [],
      enrolledContacts: [],
      attachOpps: [],
    },
    {
      name: 'FinTech Summit Lima 2026',
      code: 'EVT-FTS-LIMA',
      description: 'Stand + speaker en FinTech Summit Lima. Captación pre y post-evento.',
      type: 'EVENT' as const,
      status: 'ACTIVE' as const,
      goal: 'AWARENESS' as const,
      targetSegment: 'FINTECH' as const,
      targetCountry: 'Perú',
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      budget: 18000,
      spent: 11500,
      currency: 'USD',
      steps: [
        { type: 'EMAIL' as const, name: 'Invitación pre-evento', delayDays: 0 },
        { type: 'EVENT_INVITE' as const, name: 'Asistencia en stand', delayDays: 7 },
        { type: 'TASK' as const, name: 'Captura de leads en evento', delayDays: 1, taskTitle: 'Escanear 30+ tarjetas y registrar en CRM' },
        { type: 'EMAIL' as const, name: 'Follow-up post-evento', delayDays: 1 },
      ],
      enrolledContacts: allContacts.slice(0, 2).map((c) => c.id),
      attachOpps: allOpps.slice(4, 5).map((o) => o.id),
    },
  ];

  for (const c of campaigns) {
    const { steps, enrolledContacts, attachOpps, ...data } = c;
    const created = await prisma.campaign.create({
      data: {
        ...data,
        ownerId: admin.id,
        createdById: admin.id,
        steps: {
          create: steps.map((s, i) => ({
            order: i,
            type: s.type,
            name: s.name,
            delayDays: s.delayDays ?? 0,
            emailSubject: 'emailSubject' in s ? s.emailSubject ?? null : null,
            emailBody: 'emailBody' in s ? s.emailBody ?? null : null,
            callScript: 'callScript' in s ? s.callScript ?? null : null,
            taskTitle: 'taskTitle' in s ? s.taskTitle ?? null : null,
          })),
        },
      },
    });

    if (enrolledContacts.length) {
      const statuses: Array<'ACTIVE' | 'REPLIED' | 'COMPLETED' | 'UNSUBSCRIBED' | 'CONVERTED'> =
        ['ACTIVE', 'REPLIED', 'COMPLETED', 'UNSUBSCRIBED', 'CONVERTED'];
      await prisma.campaignContact.createMany({
        data: enrolledContacts.map((contactId, i) => ({
          campaignId: created.id,
          contactId,
          status: statuses[i % statuses.length],
        })),
        skipDuplicates: true,
      });
    }

    if (attachOpps.length) {
      await prisma.opportunity.updateMany({
        where: { id: { in: attachOpps } },
        data: { campaignId: created.id },
      });
    }

    console.log(`  ✓ ${created.name} (${steps.length} steps, ${enrolledContacts.length} contacts)`);
  }

  console.log('✅ Campaigns seed completed.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
