// Microbenchmark de queries calientes — corre cada query N veces y reporta
// p50/p95/p99 + bytes serializados. Apuntado contra Supabase prod en
// modo READ-ONLY (no escribe nada).
//
//   DATABASE_URL="..." bun run qa-performance/scripts/bench-db.ts
//
// Itera 5 veces para cada query (las primeras pueden estar en cold cache,
// las siguientes ya están en buffer). Reportamos p50/p95/p99 sobre las 5.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error'] });

interface Result {
  label: string;
  iterations: number;
  msAll: number[];
  bytesAll: number[];
}

async function bench(label: string, fn: () => Promise<unknown>, iterations = 5): Promise<Result> {
  const msAll: number[] = [];
  const bytesAll: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const result = await fn();
    const ms = Date.now() - start;
    msAll.push(ms);
    bytesAll.push(JSON.stringify(result, (_, v) => typeof v === 'bigint' ? v.toString() : v).length);
  }
  return { label, iterations, msAll, bytesAll };
}

function pctl(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

function fmt(r: Result): string {
  const p50 = pctl(r.msAll, 0.5);
  const p95 = pctl(r.msAll, 0.95);
  const p99 = pctl(r.msAll, 0.99);
  const min = Math.min(...r.msAll);
  const max = Math.max(...r.msAll);
  const avgKb = (r.bytesAll.reduce((a, b) => a + b, 0) / r.bytesAll.length / 1024).toFixed(1);
  return `${r.label.padEnd(60)} min=${String(min).padStart(5)}ms p50=${String(p50).padStart(5)}ms p95=${String(p95).padStart(5)}ms p99=${String(p99).padStart(5)}ms max=${String(max).padStart(5)}ms · ${avgKb}KB`;
}

async function main() {
  console.log('═══ Microbench DB queries calientes ═══');
  console.log(`Iterations por query: 5\n`);

  // Find data we'll use
  const topActiveAccount = (await prisma.activity.groupBy({
    by: ['accountId'], where: { accountId: { not: null } }, _count: true,
    orderBy: { _count: { id: 'desc' } }, take: 1,
  }))[0]?.accountId as string;

  const oppId = (await prisma.opportunity.findFirst({ select: { id: true } }))?.id as string;
  const contactId = (await prisma.contact.findFirst({ select: { id: true } }))?.id as string;
  const taskId = (await prisma.task.findFirst({ select: { id: true } }))?.id as string;
  const userId = (await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } }))?.id as string;

  console.log(`Test data: account=${topActiveAccount} opp=${oppId} contact=${contactId} task=${taskId}\n`);

  const results: Result[] = [];

  // ── ACCOUNT DETAIL ──
  results.push(await bench(
    '/accounts/[id] · getAccountByIdRaw',
    () => prisma.account.findUnique({
      where: { id: topActiveAccount.replace(/^cmos.*/, topActiveAccount) },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        parentAccount: { select: { id: true, name: true } },
        childAccounts: { select: { id: true, name: true, status: true } },
        contacts: {
          select: { id: true, fullName: true, email: true, jobTitle: true, avatarUrl: true, seniorityLevel: true, status: true, createdAt: true, owner: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' }, take: 50,
        },
        opportunities: {
          select: { id: true, name: true, code: true, stage: true, status: true, estimatedValue: true, currency: true, expectedCloseDate: true, product: true, ownerId: true, owner: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 30,
        },
        _count: { select: { contacts: true, opportunities: true } },
      },
    })
  ));

  // ── ACTIVITY TIMELINE — el hot spot principal ──
  results.push(await bench(
    'Activity timeline (cuenta más activa, 25 últimas)',
    () => prisma.activity.findMany({
      where: {
        OR: [
          { accountId: topActiveAccount },
          { opportunity: { accountId: topActiveAccount } },
          { contact: { accountId: topActiveAccount } },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        contact: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true, code: true } },
        participants: { include: { contact: { select: { id: true, fullName: true, avatarUrl: true } } }, take: 8 },
        mentions: { include: { mentionedUser: { select: { id: true, name: true, avatarUrl: true } } }, take: 5 },
        attachments: { select: { id: true, fileName: true, fileUrl: true, fileSize: true, mimeType: true }, take: 8 },
        nextActionAssignee: { select: { id: true, name: true, avatarUrl: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, take: 5 },
      },
      orderBy: { occurredAt: 'desc' },
      take: 25,
    })
  ));

  // ── ACTIVITY count (para el badge "X actividades") ──
  results.push(await bench(
    'Activity count (cuenta más activa)',
    () => prisma.activity.count({
      where: {
        OR: [
          { accountId: topActiveAccount },
          { opportunity: { accountId: topActiveAccount } },
          { contact: { accountId: topActiveAccount } },
        ],
      },
    })
  ));

  // ── /contacts list, default sort ──
  results.push(await bench(
    '/contacts list (status=ACTIVE, page 1, 50 rows)',
    () => prisma.contact.findMany({
      where: { status: 'ACTIVE' },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tags: { include: { tag: true }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  ));

  results.push(await bench(
    '/contacts count (status=ACTIVE)',
    () => prisma.contact.count({ where: { status: 'ACTIVE' } })
  ));

  // ── /accounts list ──
  results.push(await bench(
    '/accounts list (default, 50 rows)',
    () => prisma.account.findMany({
      select: {
        id: true, name: true, domain: true, country: true, segment: true,
        size: true, status: true, priority: true, updatedAt: true,
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { contacts: true, opportunities: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  ));

  // ── /pipeline ──
  results.push(await bench(
    '/pipeline (loadPipeline status=OPEN)',
    () => prisma.opportunity.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ stageChangedAt: 'desc' }],
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    })
  ));

  // ── /opportunities/[id] ──
  results.push(await bench(
    '/opportunities/[id] · getOpportunityById',
    () => prisma.opportunity.findUnique({
      where: { id: oppId },
      include: {
        account: { select: { id: true, name: true, country: true, segment: true } },
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        createdBy: { select: { id: true, name: true } },
        contactRoles: { include: { contact: { select: { id: true, fullName: true, email: true, jobTitle: true, avatarUrl: true } } } },
        stageHistory: { include: { changedBy: { select: { id: true, name: true } } }, orderBy: { changedAt: 'desc' } },
        checkpoints: { include: { assignee: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } }, completedBy: { select: { id: true, name: true } } } },
      },
    })
  ));

  // ── Tasks tab de cuenta ──
  results.push(await bench(
    'Tasks tab cuenta · getTasksForAccount',
    () => prisma.task.findMany({
      where: { accountId: topActiveAccount, parentTaskId: null },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { subtasks: true, comments: true, attachments: true } },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })
  ));

  // ── Sprint audit ──
  results.push(await bench(
    'Sprint audit (Activity by user, 14d)',
    () => prisma.$queryRawUnsafe(
      `SELECT a."createdById" AS user_id, u."name" AS user_name, u."email" AS user_email,
              date_trunc('day', a."occurredAt" AT TIME ZONE 'UTC')::date AS day,
              a."type"::text AS type, COUNT(*)::bigint AS count,
              SUM(COALESCE(a."durationMinutes", 0))::int AS duration_sum
         FROM "Activity" a
         INNER JOIN "User" u ON u."id" = a."createdById"
         WHERE a."occurredAt" >= NOW() - INTERVAL '14 days' AND u."isActive" = true
         GROUP BY a."createdById", u."name", u."email", day, a."type"
         ORDER BY user_name, day DESC`
    )
  ));

  // ── Heatmap ──
  results.push(await bench(
    '/heatmap · weekly aggregation 12w',
    () => prisma.$queryRawUnsafe(
      `SELECT a."accountId" AS account_id,
              date_trunc('week', a."occurredAt" AT TIME ZONE 'UTC')::date AS week_start,
              COUNT(*)::bigint AS total,
              COUNT(*) FILTER (WHERE a."type" IN ('EMAIL_SENT','EMAIL_RECEIVED'))::bigint AS emails,
              COUNT(*) FILTER (WHERE a."type" = 'CALL')::bigint AS calls,
              COUNT(*) FILTER (WHERE a."type" IN ('MEETING','DEMO'))::bigint AS meetings
         FROM "Activity" a
         INNER JOIN "Account" acc ON acc."id" = a."accountId"
         WHERE a."occurredAt" >= NOW() - INTERVAL '12 weeks'
           AND a."accountId" IS NOT NULL
         GROUP BY a."accountId", date_trunc('week', a."occurredAt" AT TIME ZONE 'UTC')`
    )
  ));

  // ── /api/tasks/[id] (drawer) ──
  results.push(await bench(
    '/api/tasks/[id] · getTaskById',
    () => prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } } },
        account: { select: { id: true, name: true } },
        opportunity: { select: { id: true, name: true, code: true } },
        contact: { select: { id: true, fullName: true } },
        subtasks: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          include: { assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } }, _count: { select: { subtasks: true, comments: true, attachments: true } } },
        },
        comments: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        attachments: { orderBy: { uploadedAt: 'desc' }, include: { uploadedBy: { select: { id: true, name: true } } } },
      },
    })
  ));

  // ── loadUserPermissions (login) ──
  results.push(await bench(
    'loadUserPermissions (login hot path)',
    () => prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    })
  ));

  console.log('\n═══ Results ═══\n');
  for (const r of results) console.log(fmt(r));

  // Summary stats
  const total = results.reduce((s, r) => s + pctl(r.msAll, 0.5), 0);
  console.log(`\nTotal p50 across all flows: ${total}ms`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
