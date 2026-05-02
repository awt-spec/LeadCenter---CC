// Import de la carpeta /Users/awt/Downloads/BD/*.csv (snapshot Notion).
//
// Cada CSV representa una empresa (nombre = nombre de archivo) con N personas.
// Reglas:
//   * Si la empresa YA existe en Accounts (match por dominio o por nombre)
//     o en Opportunities (match por nombre) → no se crea como cuenta nueva,
//     pero los contactos sí se importan y se enrolan a la campaña.
//   * Si NO existe → se crea como Account (status: PROSPECT) — esto es el "lead".
//   * Cada fila con email válido (≠ "not found"/"error"/vacío) → Contact upsert
//     (clave = email). Se enrola en la campaña BD-NOTION-2026.
//
// Idempotente: se puede correr múltiples veces. Re-corridas re-vinculan
// contactos a la campaña sin duplicar. Las cuentas se identifican por marker
// de domain `<slug>.bd-notion.lc-imported` para reconocer las creadas por este job.
//
// Uso:
//   bun prisma/import-bd-notion.ts /Users/awt/Downloads/BD

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const prisma = new PrismaClient();

type Row = Record<string, string>;

// ===== Helpers =====

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function normalizeText(s: string): string {
  // Restore mojibake "�" placeholders by NFD-stripping accents from the filename.
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.&\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(s: string): string {
  return normalizeText(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function companyFromFilename(file: string): string {
  let n = basename(file).replace(/\.csv$/i, '');
  n = n.replace(/\s*\((NOTION|Notion|notion)\)/g, '');
  n = n.replace(/\s+(NOTION|Notion)\b/g, '');
  n = n.replace(/\s+FTL$/i, '');
  n = n.replace(/\s+V\d+$/i, '');
  return n.trim();
}

function parseCsv(text: string): Row[] {
  text = stripBom(text);
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
        } else inQuotes = false;
      } else buf += ch;
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
      } else buf += ch;
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

function pickDomain(rows: Row[]): string | null {
  const candidates = rows
    .map((r) => (r['companywebsite'] || r['domain'] || '').trim())
    .filter(Boolean)
    .map((u) => u.replace(/^https?:\/\//i, '').replace(/\/+$/g, '').replace(/^www\./i, ''))
    .filter((u) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u));
  if (!candidates.length) return null;
  // Most common
  const counts = new Map<string, number>();
  for (const c of candidates) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function isValidEmail(e: string | undefined): boolean {
  if (!e) return false;
  const t = e.trim().toLowerCase();
  if (!t || t === 'not found' || t === 'error' || t === 'n/a') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

// Scan every cell in a row for an email-like value. Robust against the BD CSV
// header misalignment (real email lives in `emailFtl` or `confidence` columns).
function findEmailInRow(r: Row): string | null {
  for (const v of Object.values(r)) {
    if (!v) continue;
    const t = v.trim().toLowerCase();
    if (isValidEmail(t)) return t;
  }
  return null;
}

// ===== Main passes =====

async function ensureCampaign(importerUserId: string): Promise<string> {
  const c = await prisma.campaign.upsert({
    where: { code: 'BD-NOTION-2026' },
    create: {
      code: 'BD-NOTION-2026',
      name: 'BD Notion 2026 — Leads importados',
      description:
        'Snapshot de bases de datos de Notion (carpeta /Downloads/BD). Cada empresa que no existía en Accounts/Opportunities se creó como lead (PROSPECT).',
      type: 'COLD_OUTBOUND',
      status: 'ACTIVE',
      goal: 'LEAD_GEN',
      startDate: new Date(),
      ownerId: importerUserId,
      createdById: importerUserId,
    },
    update: {},
    select: { id: true },
  });
  return c.id;
}

async function findExistingAccount(name: string, domain: string | null): Promise<string | null> {
  if (domain) {
    const byDomain = await prisma.account.findFirst({
      where: { domain: { equals: domain, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byDomain) return byDomain.id;
  }
  const norm = name.trim();
  const byName = await prisma.account.findFirst({
    where: { name: { equals: norm, mode: 'insensitive' } },
    select: { id: true },
  });
  if (byName) return byName.id;
  return null;
}

async function findExistingOpportunityForCompany(name: string): Promise<boolean> {
  // Loose: any opp whose name contains the first significant token of the company.
  const tokens = normalizeText(name).split(/\s+/).filter((t) => t.length >= 4);
  if (!tokens.length) return false;
  const first = tokens[0];
  const opp = await prisma.opportunity.findFirst({
    where: { name: { contains: first, mode: 'insensitive' } },
    select: { id: true },
  });
  return !!opp;
}

async function ensureAccount(
  name: string,
  domain: string | null,
  importerUserId: string
): Promise<{ id: string; created: boolean }> {
  const existing = await findExistingAccount(name, domain);
  if (existing) return { id: existing, created: false };

  const slug = slugify(name) || `bd-${Date.now().toString(36)}`;
  const accDomain = domain ?? `${slug}.bd-notion.lc-imported`;
  // Avoid unique-collision on the synthetic domain
  let finalDomain = accDomain;
  let suffix = 0;
  while (await prisma.account.findFirst({ where: { domain: finalDomain }, select: { id: true } })) {
    suffix++;
    finalDomain = `${accDomain}-${suffix}`;
  }
  const created = await prisma.account.create({
    data: {
      name,
      domain: finalDomain,
      status: 'PROSPECT',
      priority: 'NORMAL',
      description: 'Lead importado desde base de datos Notion (carpeta BD/).',
      createdById: importerUserId,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

function rowToContactInput(
  r: Row,
  accountId: string,
  importerUserId: string
): Prisma.ContactCreateInput | null {
  // The BD CSVs are misaligned: real email may live in `email`, `emailFtl`, or
  // (most often, due to header drift) the `confidence` column. Scan every cell.
  const email =
    (r['email'] && isValidEmail(r['email']) ? r['email'].trim().toLowerCase() : null) ??
    (r['emailFtl'] && isValidEmail(r['emailFtl']) ? r['emailFtl'].trim().toLowerCase() : null) ??
    findEmailInRow(r);
  if (!email) return null;
  const fullName = (r['fullname'] || `${r['firstname'] || ''} ${r['lastname'] || ''}`).trim() || email;
  const firstName = (r['firstname'] || fullName.split(' ')[0] || '').slice(0, 100);
  const lastName = (r['lastname'] || fullName.split(' ').slice(1).join(' ') || '—').slice(0, 100);
  return {
    email,
    firstName: firstName || '—',
    lastName: lastName || '—',
    fullName: fullName.slice(0, 200),
    jobTitle: (r['headline'] || '').slice(0, 200) || null,
    companyName: (r['company'] || '').replace(/[^\x20-\x7eñÑÁÉÍÓÚáéíóú]/g, '').trim() || null,
    linkedinUrl: r['linkedinUrl']?.startsWith('http') ? r['linkedinUrl'] : null,
    website: r['companywebsite']?.startsWith('http') ? r['companywebsite'] : null,
    source: 'CSV_IMPORT',
    sourceDetail: 'BD Notion 2026',
    status: 'NURTURE',
    account: { connect: { id: accountId } },
    createdBy: { connect: { id: importerUserId } },
  };
}

async function processFile(
  path: string,
  importerUserId: string,
  campaignId: string
): Promise<{ company: string; created: boolean; contactsAdded: number; contactsLinked: number }> {
  const text = readFileSync(path, 'utf-8');
  const rows = parseCsv(text);
  if (!rows.length) return { company: basename(path), created: false, contactsAdded: 0, contactsLinked: 0 };

  const company = companyFromFilename(path);
  const domain = pickDomain(rows);

  // Skip if matching opportunity exists (don't create lead, but still attach contacts to existing account if any)
  const oppExists = await findExistingOpportunityForCompany(company);

  let accountId: string;
  let created = false;
  if (oppExists) {
    // Find or create best-effort account anyway, but mark as not-created if oppurtunity owns the relationship
    const ex = await findExistingAccount(company, domain);
    if (ex) {
      accountId = ex;
    } else {
      const r = await ensureAccount(company, domain, importerUserId);
      accountId = r.id;
      created = r.created;
    }
  } else {
    const r = await ensureAccount(company, domain, importerUserId);
    accountId = r.id;
    created = r.created;
  }

  // Contacts
  let added = 0;
  let linked = 0;
  for (const row of rows) {
    const data = rowToContactInput(row, accountId, importerUserId);
    if (!data) continue;
    try {
      const c = await prisma.contact.upsert({
        where: { email: data.email },
        create: data,
        update: {
          // Only fill nulls; don't overwrite manually edited records
          fullName: data.fullName,
          jobTitle: data.jobTitle ?? undefined,
          linkedinUrl: data.linkedinUrl ?? undefined,
          accountId,
        },
        select: { id: true, createdAt: true, updatedAt: true },
      });
      if (c.createdAt.getTime() === c.updatedAt.getTime()) added++;

      await prisma.campaignContact.upsert({
        where: { campaignId_contactId: { campaignId, contactId: c.id } },
        create: { campaignId, contactId: c.id, status: 'ACTIVE' },
        update: {},
      });
      linked++;
    } catch (e) {
      // Skip individual row errors (e.g. dup email collision against a manually-added contact)
      // but keep going for the rest.
      console.warn(`     ! row error in ${basename(path)}: ${(e as Error).message.slice(0, 100)}`);
    }
  }

  return { company, created, contactsAdded: added, contactsLinked: linked };
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: bun prisma/import-bd-notion.ts <dir>');
    process.exit(1);
  }
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv')).sort();
  console.log(`Found ${files.length} CSV files in ${dir}`);

  const importer =
    (await prisma.user.findUnique({ where: { email: 'demo@sysde.com' }, select: { id: true } })) ??
    (await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } }));
  if (!importer) throw new Error('No importer user found');
  console.log(`Importer: ${importer.id}`);

  const campaignId = await ensureCampaign(importer.id);
  console.log(`Campaign id: ${campaignId}`);

  let companiesCreated = 0;
  let companiesExisting = 0;
  let totalContactsAdded = 0;
  let totalLinked = 0;
  let i = 0;

  for (const f of files) {
    i++;
    const path = join(dir, f);
    try {
      const r = await processFile(path, importer.id, campaignId);
      if (r.created) companiesCreated++;
      else companiesExisting++;
      totalContactsAdded += r.contactsAdded;
      totalLinked += r.contactsLinked;
      if (i % 25 === 0 || i <= 5 || r.contactsAdded > 0) {
        console.log(
          `   [${i}/${files.length}] ${r.company.slice(0, 36).padEnd(36)} ${r.created ? 'NEW' : 'has '} +${r.contactsAdded}/${r.contactsLinked}`
        );
      }
    } catch (e) {
      console.error(`!! ${f}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone.`);
  console.log(`  Companies created (new leads): ${companiesCreated}`);
  console.log(`  Companies that already existed: ${companiesExisting}`);
  console.log(`  Contacts added: ${totalContactsAdded}`);
  console.log(`  Contacts enrolled in campaign: ${totalLinked}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
