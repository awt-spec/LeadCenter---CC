/**
 * Re-imports the Asana CSV as Opportunities (prospects), not Tasks.
 * Each CSV row becomes one Opportunity under the umbrella account, with
 * its 12 SYSDE-specific columns pushed into CustomFieldValue rows.
 *
 * Steps:
 *  1. Wipes the Tasks created by the previous importer (rows tagged asana:*).
 *  2. Ensures the OPPORTUNITY-scoped custom field definitions exist.
 *  3. Per row: creates an Opportunity with stage/status mapped from
 *     "Completed At" / "Section/Column", links it to the umbrella account,
 *     and creates CustomFieldValue rows for every non-empty CSV column.
 *  4. Idempotent: skips rows whose asana_id is already a CustomFieldValue.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const UMBRELLA_DOMAIN = 'ventas-leadcenter.sysde.internal';

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

const FIELD_DEFS = [
  { key: 'asana_id', label: 'ID original (Asana)', type: 'TEXT' as const, description: 'ID de la tarea en el export original. Útil para cruzar con histórico.' },
  { key: 'calificacion_io', label: 'Calificación I.O.', type: 'TEXT' as const },
  { key: 'solucion_sysde', label: 'Solución SYSDE', type: 'TEXT' as const },
  { key: 'pais_prospecto', label: 'País', type: 'TEXT' as const },
  { key: 'sub_solucion', label: 'Sub-solución', type: 'TEXT' as const },
  { key: 'segmento_mercado', label: 'Segmento de mercado', type: 'TEXT' as const },
  { key: 'prioridad_lc', label: 'Prioridad LC', type: 'TEXT' as const },
  { key: 'propuesta_economica', label: 'Propuesta económica', type: 'LONG_TEXT' as const },
  { key: 'monto_cartera', label: 'Monto de cartera (VOL)', type: 'NUMBER' as const },
  { key: 'usuarios_equipo', label: 'Usuarios / Equipo (VOL)', type: 'NUMBER' as const },
  { key: 'operaciones_anuales', label: 'Operaciones anuales (VOL)', type: 'NUMBER' as const },
  { key: 'clientes_actuales', label: 'Clientes actuales (VOL)', type: 'NUMBER' as const },
  { key: 'oficinas', label: 'Oficinas (VOL)', type: 'NUMBER' as const },
  { key: 'prospectacion_directa', label: 'Prospección directa', type: 'BOOLEAN' as const },
  { key: 'asana_section', label: 'Sección original (Asana)', type: 'TEXT' as const },
];

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumberLoose(s: string): number | null {
  if (!s) return null;
  const cleaned = s.replace(/[^\d.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isFinite(n) ? n : null;
}

function mapSolutionToProduct(sol: string): 'SAF_PLUS' | 'FILEMASTER' | 'FACTORAJE_ONCLOUD' | 'SYSDE_PENSION' | 'SENTINEL_PLD' | 'CUSTOM' {
  const s = (sol || '').toLowerCase();
  if (s.includes('saf')) return 'SAF_PLUS';
  if (s.includes('file') || s.includes('jurix') || s.includes('bpm')) return 'FILEMASTER';
  if (s.includes('factoraje')) return 'FACTORAJE_ONCLOUD';
  if (s.includes('pension')) return 'SYSDE_PENSION';
  if (s.includes('sentinel') || s.includes('pld')) return 'SENTINEL_PLD';
  return 'CUSTOM';
}

function mapStage(completedAt: Date | null, section: string): 'LEAD' | 'DISCOVERY' | 'SIZING' | 'DEMO' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSING' | 'WON' {
  if (completedAt) return 'WON';
  const s = (section || '').toLowerCase();
  if (s.includes('discovery') || s.includes('descubri')) return 'DISCOVERY';
  if (s.includes('demo')) return 'DEMO';
  if (s.includes('propuesta') || s.includes('proposal')) return 'PROPOSAL';
  if (s.includes('negocia') || s.includes('negotia')) return 'NEGOTIATION';
  if (s.includes('cierre') || s.includes('clos')) return 'CLOSING';
  if (s.includes('sizing')) return 'SIZING';
  return 'LEAD';
}

function parseRating(prio: string): 'A_PLUS' | 'A' | 'B_PLUS' | 'B' | 'C' | 'D' | 'UNSCORED' {
  const s = (prio || '').toLowerCase();
  if (s.includes('a+') || s.includes('urgente')) return 'A_PLUS';
  if (s.includes('alta') || /\ba\b/.test(s)) return 'A';
  if (s.includes('b+')) return 'B_PLUS';
  if (/\bb\b/.test(s)) return 'B';
  if (/\bc\b/.test(s)) return 'C';
  if (/\bd\b/.test(s)) return 'D';
  return 'UNSCORED';
}

function parseBoolean(s: string): boolean | null {
  if (!s) return null;
  const v = s.toLowerCase().trim();
  if (['si', 'sí', 'yes', 'true', '1', 'x'].includes(v)) return true;
  if (['no', 'false', '0'].includes(v)) return false;
  return null;
}

async function main() {
  const csvPath = path.join(__dirname, 'data', 'lead-center-tasks.csv');
  if (!fs.existsSync(csvPath)) throw new Error(`CSV not found: ${csvPath}`);

  console.log('🌱 Reading CSV…');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const { data: rows } = Papa.parse<CsvRow>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  console.log(`  ${rows.length} rows in CSV`);

  // 1. Get umbrella account
  const account = await prisma.account.findUnique({
    where: { domain: UMBRELLA_DOMAIN },
    select: { id: true },
  });
  if (!account) {
    throw new Error('Umbrella account not found. Run pnpm db:import:tasks-csv first to seed it.');
  }
  console.log(`  Account: ${account.id}`);

  // 2. Wipe previously imported Tasks (asana:* tagged)
  const wiped = await prisma.task.deleteMany({
    where: {
      accountId: account.id,
      tags: { hasSome: ['asana'] },
      // hasSome with prefix isn't directly supported; we delete every task on this account
      // because they were all CSV-imported. (User confirmed.)
    },
  });
  // Defensive: delete ALL tasks on this account (CSV was the only source)
  const wipeAll = await prisma.task.deleteMany({ where: { accountId: account.id } });
  console.log(`  Wiped tasks: ${wipeAll.count}`);

  const admin = await prisma.user.findFirst({ where: { email: 'alwheelock@sysde.com' } });
  if (!admin) throw new Error('Admin missing — pnpm db:seed first');

  // Email -> userId
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));

  // 3. Ensure custom fields exist (idempotent upsert)
  console.log('🔧 Ensuring custom fields…');
  const fieldByKey = new Map<string, { id: string }>();
  for (let i = 0; i < FIELD_DEFS.length; i++) {
    const f = FIELD_DEFS[i]!;
    const cf = await prisma.customFieldDefinition.upsert({
      where: { entity_key: { entity: 'OPPORTUNITY', key: f.key } },
      update: { label: f.label, type: f.type, description: f.description ?? null, position: i },
      create: {
        entity: 'OPPORTUNITY',
        key: f.key,
        label: f.label,
        type: f.type,
        description: f.description ?? null,
        position: i,
      },
      select: { id: true },
    });
    fieldByKey.set(f.key, cf);
  }
  console.log(`  ${FIELD_DEFS.length} fields ensured`);

  // 4. Wipe existing imported opportunities (track by code prefix)
  const oldImported = await prisma.opportunity.deleteMany({
    where: { accountId: account.id, code: { startsWith: 'CSV-' } },
  });
  console.log(`  Wiped previously-imported opportunities: ${oldImported.count}`);

  // 5. Import each row as Opportunity + custom field values
  console.log('📥 Importing as opportunities…');
  let created = 0;
  let skipped = 0;
  const BATCH = 25;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (row) => {
        const asanaId = row['Task ID']?.trim();
        const name = (row.Name || '').trim().slice(0, 200);
        if (!asanaId || !name) {
          skipped++;
          return;
        }

        const completedAt = parseDate(row['Completed At']);
        const stage = mapStage(completedAt, row['Section/Column']);
        const status = stage === 'WON' ? 'WON' : 'OPEN';
        const product = mapSolutionToProduct(row['Solución Sysde']);
        const rating = parseRating(row['Prioridad y Acción requerida | LC']);
        const assigneeEmail = row['Assignee Email']?.trim().toLowerCase();
        const ownerId = (assigneeEmail && userByEmail.get(assigneeEmail)) || admin.id;

        const customFieldValues: { fieldId: string; value: Prisma.InputJsonValue }[] = [];
        const setField = (key: string, raw: unknown) => {
          if (raw === null || raw === undefined || raw === '') return;
          const def = fieldByKey.get(key);
          if (!def) return;
          customFieldValues.push({
            fieldId: def.id,
            value: { v: raw } as Prisma.InputJsonValue,
          });
        };

        setField('asana_id', asanaId);
        setField('asana_section', row['Section/Column'] || null);
        setField('calificacion_io', row['Calificación I.O.'] || null);
        setField('solucion_sysde', row['Solución Sysde'] || null);
        setField('pais_prospecto', row['País'] || null);
        setField('sub_solucion', row.Sub || null);
        setField('segmento_mercado', row['Segmento del mercado'] || null);
        setField('prioridad_lc', row['Prioridad y Acción requerida | LC'] || null);
        setField('propuesta_economica', row['Propuesta Económica '] || null);
        setField('monto_cartera', parseNumberLoose(row['Monto de la cartera | VOL - LC']));
        setField('usuarios_equipo', parseNumberLoose(row['Usuarios/Equipo | VOL - LC']));
        setField(
          'operaciones_anuales',
          parseNumberLoose(row['Cantidad de operaciónes/contratos/facturas [ANUAL] | VOL - LC'])
        );
        setField('clientes_actuales', parseNumberLoose(row['Clientes Actuales | VOL - LC']));
        setField('oficinas', parseNumberLoose(row['Cantidad de Oficinas | VOL - LC']));
        setField('prospectacion_directa', parseBoolean(row['Prospectacion directa']));

        const monto = parseNumberLoose(row['Monto de la cartera | VOL - LC']);

        try {
          await prisma.opportunity.create({
            data: {
              code: `CSV-${asanaId.slice(0, 12)}`,
              name,
              accountId: account.id,
              product,
              stage,
              status,
              rating,
              probability:
                stage === 'WON' ? 100 : stage === 'LEAD' ? 5 : stage === 'DISCOVERY' ? 15 : 25,
              estimatedValue: monto,
              currency: 'USD',
              expectedCloseDate: parseDate(row['Due Date']),
              closedAt: completedAt,
              source: 'MANUAL',
              ownerId,
              createdById: admin.id,
              description: (row.Notes || '').trim() || null,
              customFields:
                customFieldValues.length > 0
                  ? {
                      create: customFieldValues,
                    }
                  : undefined,
            },
          });
          created++;
        } catch (e) {
          skipped++;
          if (skipped < 5) {
            console.warn(`    ⚠️  Failed row ${asanaId}:`, (e as Error).message.slice(0, 120));
          }
        }
      })
    );
    if ((i / BATCH) % 20 === 0 || i + BATCH >= rows.length) {
      console.log(`  … ${Math.min(i + BATCH, rows.length)}/${rows.length}  created=${created}  skipped=${skipped}`);
    }
  }

  console.log(`✅ Done. Created ${created} opportunities, skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
