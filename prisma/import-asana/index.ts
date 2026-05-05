// Asana → LeadCenter migration entry point.
//
// Usage:
//   ASANA_PAT=2/... ASANA_PROJECT_GID=1137892509978739 \
//     bun run prisma/import-asana/index.ts [--dry-run] [--skip-fetch] [--skip-confirm]
//
// What it does (in order):
//   1. Pull all top-level tasks of the project (paginated).
//   2. For each task: pull subtasks (parallel, bounded), each subtask's
//      stories and attachments, and the parent task's stories + attachments.
//      Saves the raw dump to ./prisma/import-asana/cache/dump.json.
//   3. Build a de-duplication plan against existing LC accounts.
//   4. Print a summary and wait for the user to type GO (skip with --skip-confirm).
//   5. Run the importer:
//        Account (reuse if matched, create otherwise)
//        Opportunity per Asana task
//        Task per Asana subtask
//        Activity per real comment + selected system events
//        TaskAttachment + Vercel Blob upload per attachment ≤25MB and supported MIME
//        SharedContextLink for big proposals + every Lovable URL found in comments
//      Each Asana GID is recorded in IntegrationMapping for idempotency.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import { AsanaClient, parallelMap as bulkParallel, type AsanaTask } from './modules/asana-client';
import { loadCandidateAccounts, buildPlan, type DedupPlan, type PlanSummary } from './modules/dedup';
import { newStats, importAsanaTask, type ImportContext, type ImportStats } from './modules/importer';

const PROJECT_GID = process.env.ASANA_PROJECT_GID || '1137892509978739';
const PAT = process.env.ASANA_PAT;
const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(HERE, 'cache');
const DUMP_PATH = join(CACHE_DIR, 'dump.json');
const PLAN_PATH = join(CACHE_DIR, 'plan.json');
const ARGS = new Set(process.argv.slice(2));
const DRY_RUN = ARGS.has('--dry-run');
const SKIP_FETCH = ARGS.has('--skip-fetch');
const SKIP_CONFIRM = ARGS.has('--skip-confirm');

interface Dump {
  fetchedAt: string;
  projectGid: string;
  tasks: AsanaTask[];
  /// Asana user GID → display name + email for the dedup screen.
  users: Record<string, { name: string; email: string | null; count: number }>;
}

async function ensureCache(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

function logStep(label: string): void {
  console.log(`\n\x1b[1;38;5;160m▌\x1b[0m ${label}`);
}

async function pullData(): Promise<Dump> {
  if (!PAT) throw new Error('ASANA_PAT no está set. Generá un Personal Access Token en https://app.asana.com/0/my-apps');
  const client = new AsanaClient(PAT);

  logStep(`Pulling top-level tasks for project ${PROJECT_GID}…`);
  const top = await client.listProjectTasks(PROJECT_GID);
  console.log(`  · ${top.length} top-level tasks`);

  logStep(`Fetching subtasks (parallel ×8)…`);
  await bulkParallel(top, 8, async (t) => {
    t.subtasks = t.num_subtasks > 0 ? await client.getSubtasks(t.gid) : [];
  }, (done, total) => console.log(`  · subtasks ${done}/${total}`));
  const subCount = top.reduce((acc, t) => acc + (t.subtasks?.length ?? 0), 0);
  console.log(`  · ${subCount} subtasks across all tasks`);

  // Flatten — we need stories+attachments for every task and every subtask.
  const all: AsanaTask[] = [];
  for (const t of top) { all.push(t); for (const s of t.subtasks ?? []) all.push(s); }

  logStep(`Fetching stories (comments + system events) parallel ×10…`);
  await bulkParallel(all, 10, async (t) => {
    t.stories = await client.getStories(t.gid);
  }, (done, total) => done % 100 === 0 && console.log(`  · stories ${done}/${total}`));
  const storyCount = all.reduce((acc, t) => acc + (t.stories?.length ?? 0), 0);
  const commentCount = all.reduce((acc, t) => acc + (t.stories?.filter(s => s.type === 'comment').length ?? 0), 0);
  console.log(`  · ${storyCount} total stories (${commentCount} real comments + ${storyCount - commentCount} system events)`);

  logStep(`Fetching attachments parallel ×10…`);
  await bulkParallel(all, 10, async (t) => {
    t.attachments = await client.getAttachments(t.gid);
  }, (done, total) => done % 100 === 0 && console.log(`  · attachments ${done}/${total}`));
  const attachCount = all.reduce((acc, t) => acc + (t.attachments?.length ?? 0), 0);
  console.log(`  · ${attachCount} attachments across all tasks`);

  // Aggregate user info
  const users: Dump['users'] = {};
  for (const t of all) {
    for (const u of [t.assignee, ...(t.followers ?? []), ...((t.stories ?? []).map((s) => s.created_by))].filter(Boolean) as Array<{ gid: string; name: string; email?: string }>) {
      const key = u.gid;
      const cur = users[key] ?? { name: u.name, email: u.email ?? null, count: 0 };
      cur.count++;
      if (u.email) cur.email = u.email;
      users[key] = cur;
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    projectGid: PROJECT_GID,
    tasks: top,
    users,
  };
}

async function loadDump(): Promise<Dump> {
  const buf = await readFile(DUMP_PATH, 'utf8');
  return JSON.parse(buf) as Dump;
}

function printPlanSummary(summary: PlanSummary): void {
  console.log('');
  console.log(`  Total Asana tasks                : ${summary.totalTasks}`);
  console.log(`  Reuso match EXACTO               : ${summary.reuseExact}`);
  console.log(`  Reuso match por tokens (≥2)      : ${summary.reuseTokens}`);
  console.log(`  Reuso match por dominio (notes)  : ${summary.reuseDomain}`);
  console.log(`  Reuso match por email-domain     : ${summary.reuseEmailDomain}`);
  console.log(`  Bucket "Tareas internas"         : ${summary.bucketedGeneric}`);
  console.log(`  SKIPPED (sin match en LC)        : ${summary.skipped}`);
  const total = summary.reuseExact + summary.reuseTokens + summary.reuseDomain + summary.reuseEmailDomain;
  console.log(`  → A importar                     : ${total + summary.bucketedGeneric}  (${Math.round(((total + summary.bucketedGeneric) / summary.totalTasks) * 100)}% de cobertura)`);
  console.log('');
  if (summary.companiesWithMultipleOpps.length > 0) {
    console.log(`  Cuentas con múltiples opps    : ${summary.companiesWithMultipleOpps.length}`);
    for (const m of summary.companiesWithMultipleOpps.slice(0, 15)) {
      const tag = m.accountName ? ` → ${m.accountName}` : '';
      console.log(`    · ${m.companyName.padEnd(40)} ${m.count} tasks${tag}`);
    }
    if (summary.companiesWithMultipleOpps.length > 15) {
      console.log(`    … y ${summary.companiesWithMultipleOpps.length - 15} más`);
    }
  }
  if (summary.skippedSample.length > 0) {
    console.log(`\n  Muestra de SKIPPED (no match en LC):`);
    for (const s of summary.skippedSample.slice(0, 12)) {
      console.log(`    · ${s.companyName.padEnd(45)} ← "${s.asanaName.slice(0, 50)}"`);
    }
  }
  console.log('');
}

async function buildUserMap(prisma: PrismaClient, dump: Dump, autoCreate: boolean): Promise<Map<string, string>> {
  const lcUsers = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const byEmail = new Map(lcUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const byNameLower = new Map(lcUsers.map((u) => [u.name.toLowerCase().trim(), u.id]));
  const out = new Map<string, string>();
  let matched = 0;
  let createdCount = 0;
  const unmatched: Array<{ gid: string; name: string; email: string | null }> = [];

  for (const [gid, info] of Object.entries(dump.users)) {
    let id: string | undefined;
    if (info.email) id = byEmail.get(info.email.toLowerCase());
    if (!id) id = byNameLower.get(info.name.toLowerCase().trim());
    if (id) {
      out.set(gid, id);
      if (info.email) out.set(info.email.toLowerCase(), id);
      matched++;
    } else {
      unmatched.push({ gid, name: info.name, email: info.email });
    }
  }
  console.log(`  Asana users con match en LC : ${matched} / ${Object.keys(dump.users).length}`);

  // Auto-create LC users for the active Asana contributors that we DON'T have.
  // Without this, attribution collapses on the importer user.
  if (autoCreate) {
    for (const u of unmatched) {
      if (!u.email) continue; // can't create without email — falls back to importer
      try {
        const created = await prisma.user.upsert({
          where: { email: u.email.toLowerCase() },
          create: {
            email: u.email.toLowerCase(),
            name: u.name,
            isActive: true,
          },
          update: {},
          select: { id: true },
        });
        out.set(u.gid, created.id);
        out.set(u.email.toLowerCase(), created.id);
        createdCount++;
      } catch (e) {
        console.log(`    !! no pude crear ${u.email}: ${(e as Error).message}`);
      }
    }
    console.log(`  Asana users creados en LC   : ${createdCount}`);
    const stillNoMatch = unmatched.filter((u) => !u.email);
    if (stillNoMatch.length > 0) {
      console.log(`  Sin email (caen al importer): ${stillNoMatch.length}`);
      for (const u of stillNoMatch.slice(0, 5)) console.log(`    · ${u.name}`);
    }
  } else if (unmatched.length > 0) {
    console.log(`  Sin match (no creo en --dry-run): ${unmatched.length}`);
    for (const u of unmatched.slice(0, 8)) console.log(`    · ${u.name}${u.email ? ' <' + u.email + '>' : ''}`);
    if (unmatched.length > 8) console.log(`    … y ${unmatched.length - 8} más`);
  }
  return out;
}

async function getOrCreateAsanaIntegration(prisma: PrismaClient, importerUserId: string): Promise<string> {
  const existing = await prisma.integration.findFirst({ where: { provider: 'asana' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.integration.create({
    data: {
      provider: 'asana',
      status: 'CONNECTED',
      ownerEmail: 'alwheelock@sysde.com',
      connectedById: importerUserId,
      lastSyncedAt: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

async function confirm(prompt: string): Promise<boolean> {
  if (SKIP_CONFIRM) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ans = (await rl.question(prompt + ' (escribí GO para continuar) > ')).trim();
    return ans === 'GO';
  } finally {
    rl.close();
  }
}

async function main() {
  console.log('\x1b[1;38;5;160m═══ Asana → LeadCenter import ═══\x1b[0m');
  await ensureCache();

  // 1. Pull or load dump
  let dump: Dump;
  if (SKIP_FETCH && existsSync(DUMP_PATH)) {
    console.log(`\nUsando dump existente: ${DUMP_PATH}`);
    dump = await loadDump();
    const s = await stat(DUMP_PATH);
    console.log(`  fetched: ${dump.fetchedAt} · size: ${(s.size / 1024 / 1024).toFixed(1)} MB · tasks: ${dump.tasks.length}`);
  } else {
    dump = await pullData();
    await writeFile(DUMP_PATH, JSON.stringify(dump, null, 2));
    console.log(`\nDump guardado: ${DUMP_PATH}`);
  }

  // 2. Build dedup plan
  const prisma = new PrismaClient();
  try {
    logStep('Construyendo plan de deduplicación contra accounts existentes…');
    const candidates = await loadCandidateAccounts(prisma);
    console.log(`  Accounts existentes en LC : ${candidates.length}`);
    const { plan, summary } = buildPlan(dump.tasks, candidates);
    await writeFile(PLAN_PATH, JSON.stringify({ summary, plan }, null, 2));
    printPlanSummary(summary);

    // 3. User mapping (auto-create when not dry-run)
    logStep('Mapeo de usuarios Asana → LeadCenter');
    const userMap = await buildUserMap(prisma, dump, !DRY_RUN);

    if (DRY_RUN) {
      console.log('\n--dry-run activo — saliendo sin escribir.');
      return;
    }

    // 4. Confirm
    const ok = await confirm('\n¿Procedo con el import?');
    if (!ok) {
      console.log('Cancelado por el usuario.');
      return;
    }

    // 5. Import
    logStep('Ejecutando import idempotente…');
    const importer = await prisma.user.findFirst({
      where: { email: 'alwheelock@sysde.com' },
      select: { id: true },
    });
    if (!importer) throw new Error('No encuentro al user alwheelock@sysde.com en LC.');

    const integrationId = await getOrCreateAsanaIntegration(prisma, importer.id);
    const asana = new AsanaClient(PAT!);

    const ctx: ImportContext = {
      prisma,
      asana,
      integrationId,
      importerUserId: importer.id,
      userMap,
      companyToAccount: new Map(),
      stats: newStats(),
    };

    // Parallelism × 8 — significant speedup vs sequential. Each top-level
    // task processes its subtasks/stories/attachments serially within itself,
    // but multiple tasks run concurrently. Idempotent IntegrationMappings +
    // per-attachment unique keys make races safe.
    const planByGid = new Map(plan.map((p) => [p.taskGid, p] as const));
    const startTime = Date.now();
    let processed = 0;
    await bulkParallel(dump.tasks, 8, async (task) => {
      const planEntry = planByGid.get(task.gid);
      if (!planEntry) return;
      await importAsanaTask(ctx, task, planEntry);
      processed++;
      if (processed % 25 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const eta = ((dump.tasks.length - processed) / rate / 60).toFixed(0);
        console.log(`  · ${processed}/${dump.tasks.length} tasks · acts=${ctx.stats.activitiesCreated} · atts=${ctx.stats.attachmentsUploaded} · ${rate.toFixed(1)} t/s · ETA ${eta} min`);
      }
    });

    printStats(ctx.stats, dump);
  } finally {
    await prisma.$disconnect();
  }
}

function printStats(s: ImportStats, dump: Dump): void {
  console.log('\n\x1b[1;38;5;160m═══ Reporte ═══\x1b[0m');
  console.log(`  Asana tasks procesados   : ${dump.tasks.length}`);
  console.log(`  Accounts reusadas        : ${s.accountsReused}`);
  console.log(`  Accounts creadas         : ${s.accountsCreated}`);
  console.log(`  Opportunities creadas    : ${s.opportunitiesCreated}  (saltadas: ${s.opportunitiesSkipped})`);
  console.log(`  Tasks (subtareas) creadas: ${s.tasksCreated}  (saltadas: ${s.tasksSkipped})`);
  console.log(`  Activities creadas       : ${s.activitiesCreated}  (saltadas: ${s.activitiesSkipped})`);
  console.log(`  Attachments subidos      : ${s.attachmentsUploaded}  (saltados: ${s.attachmentsSkipped}, fallidos: ${s.attachmentsFailed})`);
  console.log(`  C.O.C. links creados     : ${s.cocLinksCreated}`);
  if (s.errors.length > 0) {
    console.log(`\n  Errores no fatales (${s.errors.length}):`);
    for (const e of s.errors.slice(0, 20)) console.log(`    · ${e}`);
    if (s.errors.length > 20) console.log(`    … y ${s.errors.length - 20} más`);
  }
}

main().catch((e) => {
  console.error('\nFAIL:', e);
  process.exit(1);
});
