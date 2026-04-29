/**
 * Import Asana-export-style tasks CSV into Task table.
 * Source: prisma/data/lead-center-tasks.csv
 *
 * Behavior:
 *  - Tasks land under an umbrella Account "VENTAS - Lead Center" (created if missing).
 *  - status DONE if `Completed At` is set, otherwise TODO.
 *  - priority parsed from the "Prioridad y Acción requerida | LC" column or Tags.
 *  - assignees matched by email; missing emails are skipped silently.
 *  - tags merged from the Tags column + Section/Column.
 *  - description = Notes + selected SYSDE-specific columns when present.
 *  - Idempotent: re-running with the same row creates a new Task only if the
 *    row's external Task ID isn't already stored in `tags` (we encode the ID
 *    as a tag like `asana:1132909269174412`).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type CsvRow = {
  'Task ID': string;
  'Created At': string;
  'Completed At': string;
  'Last Modified': string;
  Name: string;
  'Section/Column': string;
  Assignee: string;
  'Assignee Email': string;
  'Start Date': string;
  'Due Date': string;
  Tags: string;
  Notes: string;
  Projects: string;
  'Parent task': string;
  'Calificación I.O.': string;
  'Solución Sysde': string;
  'Prospectacion directa': string;
  Sub: string;
  País: string;
  'Propuesta Económica ': string;
  'Segmento del mercado': string;
  'Prioridad y Acción requerida | LC': string;
  'Monto de la cartera | VOL - LC': string;
  'Usuarios/Equipo | VOL - LC': string;
  'Cantidad de operaciónes/contratos/facturas [ANUAL] | VOL - LC': string;
  'Clientes Actuales | VOL - LC': string;
  'Cantidad de Oficinas | VOL - LC': string;
};

function parsePriority(raw: string, tags: string[]): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  const r = (raw || '').toLowerCase();
  const t = tags.map((x) => x.toLowerCase());
  if (r.includes('urgente') || t.some((x) => x.includes('urgente'))) return 'URGENT';
  if (r.includes('alta') || t.some((x) => x.includes('alta'))) return 'HIGH';
  if (r.includes('baja') || t.some((x) => x.includes('baja'))) return 'LOW';
  return 'NORMAL';
}

function parseTags(tagsCol: string, section: string): string[] {
  const out = new Set<string>();
  if (tagsCol) {
    for (const t of tagsCol.split(/[,;|]/)) {
      const v = t.trim();
      if (v) out.add(v);
    }
  }
  if (section && section !== 'Untitled section') out.add(section);
  return Array.from(out);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

function buildDescription(row: CsvRow): string | null {
  const parts: string[] = [];
  if (row.Notes?.trim()) parts.push(row.Notes.trim());
  const enrichments: Array<[string, string]> = [
    ['País', row.País],
    ['Solución SYSDE', row['Solución Sysde']],
    ['Calificación I.O.', row['Calificación I.O.']],
    ['Segmento de mercado', row['Segmento del mercado']],
    ['Prospección directa', row['Prospectacion directa']],
    ['Sub', row.Sub],
    ['Propuesta económica', row['Propuesta Económica ']],
    ['Monto de cartera (VOL)', row['Monto de la cartera | VOL - LC']],
    ['Usuarios/Equipo (VOL)', row['Usuarios/Equipo | VOL - LC']],
    ['Operaciones anuales (VOL)', row['Cantidad de operaciónes/contratos/facturas [ANUAL] | VOL - LC']],
    ['Clientes actuales (VOL)', row['Clientes Actuales | VOL - LC']],
    ['Oficinas (VOL)', row['Cantidad de Oficinas | VOL - LC']],
  ];
  const meta = enrichments.filter(([, v]) => v?.trim()).map(([k, v]) => `**${k}:** ${v.trim()}`);
  if (meta.length) parts.push(meta.join('\n'));
  return parts.length > 0 ? parts.join('\n\n') : null;
}

async function main() {
  const csvPath = path.join(__dirname, 'data', 'lead-center-tasks.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  console.log('🌱 Reading CSV…');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const { data: rows, errors } = Papa.parse<CsvRow>(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (errors.length) {
    console.warn(`  ⚠️ ${errors.length} parse warnings (ignoring)`);
  }
  console.log(`  ${rows.length} rows`);

  // Umbrella account
  const account = await prisma.account.upsert({
    where: { domain: 'ventas-leadcenter.sysde.internal' },
    update: {},
    create: {
      name: 'VENTAS · Lead Center (importado)',
      domain: 'ventas-leadcenter.sysde.internal',
      legalName: 'SYSDE Internacional Inc — Pipeline comercial',
      country: 'Costa Rica',
      status: 'ACTIVE',
      priority: 'NORMAL',
      description: 'Cuenta contenedora de las tareas históricas migradas desde Asana.',
    },
    select: { id: true },
  });
  console.log(`  Account: ${account.id}`);

  const admin = await prisma.user.findFirst({ where: { email: 'alwheelock@sysde.com' } });
  if (!admin) throw new Error('Admin user missing — run pnpm db:seed first');

  // Build email → user map
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

  // Already-imported set (so re-runs skip rows whose Asana ID we've seen)
  const existingTagged = await prisma.task.findMany({
    where: { accountId: account.id, tags: { hasSome: rows.map((r) => `asana:${r['Task ID']}`).filter(Boolean) } },
    select: { tags: true },
  });
  const seenAsanaIds = new Set<string>();
  for (const t of existingTagged) {
    for (const tag of t.tags) {
      if (tag.startsWith('asana:')) seenAsanaIds.add(tag.slice('asana:'.length));
    }
  }
  console.log(`  Already imported: ${seenAsanaIds.size}`);

  let created = 0;
  let skipped = 0;
  const BATCH = 50;
  let position = await prisma.task.count({ where: { accountId: account.id } });

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (row) => {
        const asanaId = row['Task ID']?.trim();
        if (!asanaId || !row.Name?.trim()) {
          skipped++;
          return;
        }
        if (seenAsanaIds.has(asanaId)) {
          skipped++;
          return;
        }

        const tags = parseTags(row.Tags, row['Section/Column']);
        tags.push(`asana:${asanaId}`);

        const completedAt = parseDate(row['Completed At']);
        const status = completedAt ? 'DONE' : 'TODO';
        const priority = parsePriority(row['Prioridad y Acción requerida | LC'], tags);
        const dueDate = parseDate(row['Due Date']);
        const startDate = parseDate(row['Start Date']);
        const createdAt = parseDate(row['Created At']) ?? new Date();

        const assigneeEmail = row['Assignee Email']?.trim().toLowerCase();
        const assigneeId = assigneeEmail ? userByEmail.get(assigneeEmail) : undefined;

        const data: Prisma.TaskCreateInput = {
          title: row.Name.trim().slice(0, 200),
          description: buildDescription(row),
          status: status as 'DONE' | 'TODO',
          priority,
          dueDate,
          startDate,
          completedAt,
          createdAt,
          tags,
          position: position++,
          account: { connect: { id: account.id } },
          createdBy: { connect: { id: admin.id } },
          ...(assigneeId && {
            assignees: { create: [{ user: { connect: { id: assigneeId } } }] },
          }),
        };

        try {
          await prisma.task.create({ data });
          created++;
        } catch (e) {
          console.warn(`    ⚠️  Failed row ${asanaId}:`, (e as Error).message.slice(0, 100));
        }
      })
    );
    if ((i / BATCH) % 10 === 0 || i + BATCH >= rows.length) {
      console.log(`  … ${Math.min(i + BATCH, rows.length)}/${rows.length}  created=${created}  skipped=${skipped}`);
    }
  }

  console.log(`✅ Done. Created ${created}, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
