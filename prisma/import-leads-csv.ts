// Re-import del CSV "VENTAS · Lead Center" como Cuentas + Tareas (con jerarquía).
// Reemplaza al import previo que mapeaba cada fila a una Opportunity.
//
// Reglas:
//   * Filas raíz (sin "Parent task") → Account.
//   * Filas hijas → Task ligado a la cuenta raíz; si su padre es otra subtarea,
//     se anida vía parentTaskId.
//   * Idempotente: borra Accounts con domain "lc-csv-*.imported" + Opps "CSV-*"
//     antes de reimportar, así se puede correr de nuevo sin duplicar.
//   * Custom fields: las columnas SYSDE-específicas se guardan como
//     CustomFieldValue contra el Account (no contra la Opp).
//
// Uso:
//   pnpm tsx prisma/import-leads-csv.ts /Users/awt/Downloads/VENTAS_-_Lead_Center_\ \(1\).csv

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

type Row = Record<string, string>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function parseCsv(text: string): Row[] {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          buf += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        buf += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        cur.push(buf);
        buf = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        cur.push(buf);
        buf = '';
        rows.push(cur);
        cur = [];
      } else {
        buf += ch;
      }
    }
  }
  if (buf || cur.length) {
    cur.push(buf);
    rows.push(cur);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((r) => r.length > 1 && r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h.trim(), (r[i] ?? '').trim()])) as Row);
}

function pickStatus(section: string): 'PROSPECT' | 'CUSTOMER' | 'LOST' | 'INACTIVE' {
  const s = (section || '').toLowerCase();
  if (s.includes('win')) return 'CUSTOMER';
  if (s.includes('loss') || s.includes('lost')) return 'LOST';
  if (s.includes('baja prioridad') || s.includes('lost in space')) return 'INACTIVE';
  return 'PROSPECT';
}

function pickPriority(raw: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  const s = (raw || '').toLowerCase();
  if (s.includes('alta') || s.includes('vip') || s.includes('urgente')) return 'URGENT';
  if (s.includes('media-alta') || s.includes('seguimiento')) return 'HIGH';
  if (s.includes('baja')) return 'LOW';
  return 'NORMAL';
}

function pickSegment(raw: string): Prisma.AccountCreateInput['segment'] {
  const s = (raw || '').toUpperCase();
  if (s.includes('BANCO')) return 'BANK';
  if (s.includes('FIN') && s.includes('COMP')) return 'FINANCE_COMPANY';
  if (s.includes('MICRO')) return 'MICROFINANCE';
  if (s.includes('COOPER')) return 'COOPERATIVE';
  if (s.includes('AFP') || s.includes('PENSION')) return 'PENSION_FUND';
  if (s.includes('SEGUR') || s.includes('INSURANCE')) return 'INSURANCE';
  if (s.includes('FINTECH')) return 'FINTECH';
  if (s.includes('RETAIL')) return 'RETAIL';
  return null;
}

function pickTaskStatus(row: Row, defaultFromSection: string): 'TODO' | 'IN_PROGRESS' | 'DONE' | 'BACKLOG' | 'CANCELLED' | 'BLOCKED' {
  if ((row['Completed At'] || '').trim()) return 'DONE';
  const s = (defaultFromSection || row['Section/Column'] || '').toLowerCase();
  if (s.includes('win')) return 'DONE';
  if (s.includes('loss') || s.includes('lost')) return 'CANCELLED';
  if (s.includes('madurac')) return 'IN_PROGRESS';
  if (s.includes('telemark')) return 'IN_PROGRESS';
  if (s.includes('seguimiento')) return 'IN_PROGRESS';
  if (s.includes('baja prioridad')) return 'BACKLOG';
  return 'TODO';
}

function pickTaskPriority(section: string, parent?: string): 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' {
  const s = `${section} ${parent ?? ''}`.toLowerCase();
  if (s.includes('vip')) return 'URGENT';
  if (s.includes('seguimiento')) return 'HIGH';
  if (s.includes('baja prioridad')) return 'LOW';
  return 'NORMAL';
}

function num(s: string): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CFD_DEFS = [
  { key: 'calificacion_io', label: 'Calificación I.O.', type: 'TEXT', position: 1 },
  { key: 'solucion_sysde', label: 'Solución SYSDE', type: 'TEXT', position: 2 },
  { key: 'prospectacion_directa', label: 'Prospección directa', type: 'BOOLEAN', position: 3 },
  { key: 'sub_solucion', label: 'Sub-solución', type: 'TEXT', position: 4 },
  { key: 'propuesta_economica', label: 'Propuesta económica', type: 'LONG_TEXT', position: 5 },
  { key: 'cartera_monto', label: 'Monto de la cartera', type: 'NUMBER', position: 6 },
  { key: 'usuarios', label: 'Usuarios / equipo', type: 'NUMBER', position: 7 },
  { key: 'operaciones_anuales', label: 'Operaciones anuales', type: 'NUMBER', position: 8 },
  { key: 'clientes_actuales', label: 'Clientes actuales', type: 'NUMBER', position: 9 },
  { key: 'oficinas', label: 'Cantidad de oficinas', type: 'NUMBER', position: 10 },
] as const;

async function ensureAccountCustomFieldDefs(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const d of CFD_DEFS) {
    const cf = await prisma.customFieldDefinition.upsert({
      where: { entity_key: { entity: 'ACCOUNT', key: d.key } },
      create: {
        entity: 'ACCOUNT',
        key: d.key,
        label: d.label,
        type: d.type as Prisma.CustomFieldDefinitionCreateInput['type'],
        position: d.position,
      },
      update: { label: d.label, position: d.position },
      select: { id: true, key: true },
    });
    map.set(cf.key, cf.id);
  }
  return map;
}

async function wipePreviousImport() {
  // Borrar Opps con code CSV-* (las que mal importé antes)
  const oppDel = await prisma.opportunity.deleteMany({ where: { code: { startsWith: 'CSV-' } } });
  // Borrar Accounts marcadas como CSV (de futuras corridas)
  const acctDel = await prisma.account.deleteMany({ where: { domain: { endsWith: '.lc-imported' } } });
  // Borrar la account paraguas legacy si existe
  await prisma.account.deleteMany({ where: { domain: 'ventas-leadcenter.sysde.internal' } });
  // Limpiar CustomFieldDefinitions huérfanas en OPPORTUNITY (las creé por error)
  const orphanedOppCFDs = await prisma.customFieldDefinition.findMany({
    where: { entity: 'OPPORTUNITY', key: { in: CFD_DEFS.map((d) => d.key) } },
    select: { id: true },
  });
  if (orphanedOppCFDs.length) {
    await prisma.customFieldDefinition.deleteMany({
      where: { id: { in: orphanedOppCFDs.map((c) => c.id) } },
    });
  }
  console.log(
    `   wiped: ${oppDel.count} opps · ${acctDel.count} accts · ${orphanedOppCFDs.length} cfd-opp`
  );
}

async function importAccounts(roots: Row[], cfdMap: Map<string, string>, importerUserId: string) {
  const created: Map<string, string> = new Map();
  let i = 0;
  for (const r of roots) {
    i++;
    const name = r['Name'].trim();
    if (!name) continue;
    const slug = slugify(name) || `row-${i}`;
    const domain = `${slug}-${i.toString(36)}.lc-imported`;

    const acct = await prisma.account.create({
      data: {
        name,
        domain,
        country: r['País']?.trim() || null,
        segment: pickSegment(r['Segmento del mercado']),
        status: pickStatus(r['Section/Column']),
        priority: pickPriority(r['Prioridad y Acción requerida | LC']),
        description: r['Notes'] || null,
        internalNotes: r['Solución Sysde'] || r['Sub'] || null,
        createdById: importerUserId,
      },
      select: { id: true },
    });
    created.set(name, acct.id);

    // Custom fields
    const cfvData: Prisma.CustomFieldValueCreateManyInput[] = [];
    const setCf = (key: string, value: unknown) => {
      const fieldId = cfdMap.get(key);
      if (!fieldId) return;
      if (value === null || value === undefined || value === '') return;
      cfvData.push({ fieldId, accountId: acct.id, value: value as Prisma.InputJsonValue });
    };
    setCf('calificacion_io', r['Calificación I.O.']);
    setCf('solucion_sysde', r['Solución Sysde']);
    setCf('prospectacion_directa', /^s[ií]$/i.test(r['Prospectacion directa']?.trim() || '') || null);
    setCf('sub_solucion', r['Sub']);
    setCf('propuesta_economica', r['Propuesta Económica '] || r['Propuesta Económica']);
    setCf('cartera_monto', num(r['Monto de la cartera | VOL - LC']));
    setCf('usuarios', num(r['Usuarios/Equipo | VOL - LC']));
    setCf('operaciones_anuales', num(r['Cantidad de operaciónes/contratos/facturas [ANUAL] | VOL - LC']));
    setCf('clientes_actuales', num(r['Clientes Actuales | VOL - LC']));
    setCf('oficinas', num(r['Cantidad de Oficinas | VOL - LC']));
    if (cfvData.length) {
      await prisma.customFieldValue.createMany({ data: cfvData, skipDuplicates: true });
    }
    if (i % 100 === 0) console.log(`   accounts ${i}/${roots.length}`);
  }
  return created;
}

async function importTasks(subRows: Row[], accountByName: Map<string, string>, importerUserId: string) {
  // Multi-pass BFS: each iteration creates tasks whose parent is already in the DB
  // (either an Account-rooted task created in a prior pass, or a fresh root-level
  // Task on an Account when parent matches a root account name).
  const taskByName = new Map<string, { id: string; accountId: string }>();
  const remaining = [...subRows];
  let pass = 0;
  let lastRemaining = -1;
  while (remaining.length && remaining.length !== lastRemaining && pass < 8) {
    lastRemaining = remaining.length;
    pass++;
    const stillUnresolved: Row[] = [];
    let createdInPass = 0;
    for (const r of remaining) {
      const name = r['Name'].trim();
      if (!name) continue;
      const parentName = (r['Parent task'] || '').trim();
      if (!parentName) {
        stillUnresolved.push(r);
        continue;
      }
      const parentTask = taskByName.get(parentName);
      const parentAccountId = accountByName.get(parentName);

      if (parentTask) {
        // Sub-task of an existing task
        const t = await prisma.task.create({
          data: {
            title: name.slice(0, 200),
            description: r['Notes'] || null,
            status: pickTaskStatus(r, ''),
            priority: pickTaskPriority(r['Tags'] || '', ''),
            dueDate: dateOrNull(r['Due Date']),
            startDate: dateOrNull(r['Start Date']),
            completedAt: dateOrNull(r['Completed At']),
            tags: (r['Tags'] || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
            accountId: parentTask.accountId,
            parentTaskId: parentTask.id,
            createdById: importerUserId,
          },
          select: { id: true, accountId: true },
        });
        taskByName.set(name, { id: t.id, accountId: t.accountId! });
        createdInPass++;
      } else if (parentAccountId) {
        // Top-level task under an Account
        const t = await prisma.task.create({
          data: {
            title: name.slice(0, 200),
            description: r['Notes'] || null,
            status: pickTaskStatus(r, r['Section/Column']),
            priority: pickTaskPriority(r['Section/Column'] || '', parentName),
            dueDate: dateOrNull(r['Due Date']),
            startDate: dateOrNull(r['Start Date']),
            completedAt: dateOrNull(r['Completed At']),
            tags: (r['Tags'] || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6),
            accountId: parentAccountId,
            createdById: importerUserId,
          },
          select: { id: true, accountId: true },
        });
        taskByName.set(name, { id: t.id, accountId: t.accountId! });
        createdInPass++;
      } else {
        stillUnresolved.push(r);
      }
    }
    console.log(`   pass ${pass}: created ${createdInPass}, remaining ${stillUnresolved.length}`);
    remaining.splice(0, remaining.length, ...stillUnresolved);
  }

  return { created: taskByName.size, orphaned: remaining.length };
}

async function main() {
  const path = process.argv[2];
  if (!path) {
    console.error('Usage: bun prisma/import-leads-csv.ts <csv-path>');
    process.exit(1);
  }
  const text = readFileSync(path, 'utf-8');
  const rows = parseCsv(text);
  console.log(`Parsed ${rows.length} rows`);

  const roots = rows.filter((r) => !(r['Parent task'] || '').trim() && r['Name']?.trim());
  const subs = rows.filter((r) => (r['Parent task'] || '').trim() && r['Name']?.trim());
  console.log(`   roots: ${roots.length} · subtasks: ${subs.length}`);

  console.log('\n[1/4] Wiping previous import...');
  await wipePreviousImport();

  console.log('\n[2/4] Ensuring Account custom field definitions...');
  const cfdMap = await ensureAccountCustomFieldDefs();
  console.log(`   ${cfdMap.size} CFDs ready`);

  // Use the demo user as importer (any real user works; demo always exists).
  const importer =
    (await prisma.user.findUnique({
      where: { email: 'demo@sysde.com' },
      select: { id: true, name: true },
    })) ??
    (await prisma.user.findFirst({
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    }));
  if (!importer) throw new Error('No user found to attribute imported records to');
  console.log(`   importer: ${importer.name} (${importer.id})`);

  console.log('\n[3/4] Importing accounts...');
  const accountByName = await importAccounts(roots, cfdMap, importer.id);
  console.log(`   created ${accountByName.size} accounts`);

  console.log('\n[4/4] Importing tasks (multi-pass)...');
  const taskRes = await importTasks(subs, accountByName, importer.id);
  console.log(`   created ${taskRes.created} tasks · orphaned ${taskRes.orphaned}`);

  console.log('\nDone.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
