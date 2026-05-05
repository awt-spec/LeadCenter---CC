// Extractor runner — translates an ExtractorConfig into a Prisma query and
// returns flat row records ready for the table UI / CSV export.

import { prisma } from '@/lib/db';
import type { Session } from 'next-auth';
import { can } from '@/lib/rbac';
import { ENTITIES, OPS_BY_TYPE, type ExtractorConfig, type FilterRow } from './schema';

const MAX_LIMIT = 1000;

interface RunResult {
  rows: Record<string, unknown>[];
  total: number;
  truncated: boolean;
}

/// Translate one filter row into a Prisma where fragment. Returns null when
/// the value is missing (the UI can render incomplete filter rows that we
/// just skip silently).
function filterToPrisma(filter: FilterRow): Record<string, unknown> | null {
  const { field, op, value } = filter;
  const segments = field.split('.');

  // Build the leaf clause based on op
  let leaf: unknown;
  switch (op) {
    case 'eq': if (value === undefined || value === '' || value === null) return null; leaf = value; break;
    case 'ne': if (value === undefined || value === '' || value === null) return null; leaf = { not: value }; break;
    case 'contains': if (!value) return null; leaf = { contains: String(value), mode: 'insensitive' }; break;
    case 'starts_with': if (!value) return null; leaf = { startsWith: String(value), mode: 'insensitive' }; break;
    case 'ends_with': if (!value) return null; leaf = { endsWith: String(value), mode: 'insensitive' }; break;
    case 'gt': if (value === undefined || value === null || value === '') return null; leaf = { gt: parseScalar(value) }; break;
    case 'gte': if (value === undefined || value === null || value === '') return null; leaf = { gte: parseScalar(value) }; break;
    case 'lt': if (value === undefined || value === null || value === '') return null; leaf = { lt: parseScalar(value) }; break;
    case 'lte': if (value === undefined || value === null || value === '') return null; leaf = { lte: parseScalar(value) }; break;
    case 'between': {
      if (!Array.isArray(value) || value.length !== 2) return null;
      const [a, b] = value;
      if (a === '' && b === '') return null;
      const clause: Record<string, unknown> = {};
      if (a !== '' && a != null) clause.gte = parseScalar(a);
      if (b !== '' && b != null) clause.lte = parseScalar(b);
      leaf = clause;
      break;
    }
    case 'in': if (!Array.isArray(value) || value.length === 0) return null; leaf = { in: value }; break;
    case 'not_in': if (!Array.isArray(value) || value.length === 0) return null; leaf = { notIn: value }; break;
    case 'is_null': leaf = null; break;
    case 'is_not_null': leaf = { not: null }; break;
  }

  // Wrap in nested object for relation paths: "account.country" → { account: { country: leaf } }
  let clause: Record<string, unknown> = { [segments[segments.length - 1]]: leaf };
  for (let i = segments.length - 2; i >= 0; i--) {
    clause = { [segments[i]]: clause };
  }
  return clause;
}

function parseScalar(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  // ISO date detection
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v);
  const n = Number(v);
  if (!Number.isNaN(n) && v.length > 0) return n;
  return v;
}

/// Read a value from a deeply nested record using "a.b.c" path.
function readPath(row: Record<string, unknown>, path: string): unknown {
  const segs = path.split('.');
  let cur: unknown = row;
  for (const s of segs) {
    if (cur && typeof cur === 'object' && s in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return null;
    }
  }
  return cur;
}

export async function runExtractor(
  session: Session,
  config: ExtractorConfig
): Promise<RunResult> {
  const entity = ENTITIES[config.entity];
  if (!entity) throw new Error(`Entidad desconocida: ${config.entity}`);

  // RBAC scope — limit the user to data they can read. Admins (read:all) see
  // everything; everyone else only their own.
  const scopeAll = can(session, 'opportunities:read:all') || can(session, 'reports:read:all');
  const scopeWhere = scopeAll ? {} : ownerScopeFor(entity.model, session.user?.id ?? '');

  // Build filter where
  const filterWheres = config.filters
    .map(filterToPrisma)
    .filter((c): c is Record<string, unknown> => c !== null);
  const where = { AND: [scopeWhere, ...filterWheres] };

  // Build select: top-level fields + nested relations grouped together.
  // We always select id for stable row keys.
  const select: Record<string, unknown> = { id: true };
  const relationSelects = new Map<string, Set<string>>();
  for (const colKey of config.columns) {
    const def = entity.fields[colKey];
    if (!def || !def.selectable) continue;
    const segments = def.path.split('.');
    if (segments.length === 1) {
      select[segments[0]] = true;
    } else if (segments.length === 2) {
      const [rel, leaf] = segments;
      let s = relationSelects.get(rel);
      if (!s) { s = new Set(); relationSelects.set(rel, s); }
      s.add(leaf);
    }
  }
  for (const [rel, leafs] of relationSelects) {
    const sel: Record<string, unknown> = {};
    for (const l of leafs) sel[l] = true;
    select[rel] = { select: sel };
  }

  const limit = Math.max(1, Math.min(config.limit ?? 200, MAX_LIMIT));

  // Build orderBy
  let orderBy: Record<string, unknown> | undefined;
  if (config.orderBy) {
    const segs = config.orderBy.field.split('.');
    let ob: Record<string, unknown> = { [segs[segs.length - 1]]: config.orderBy.dir };
    for (let i = segs.length - 2; i >= 0; i--) ob = { [segs[i]]: ob };
    orderBy = ob;
  }

  // Run query against the right model
  const model = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]>; count: (args: { where: unknown }) => Promise<number> }>)[entity.model];
  if (!model) throw new Error(`Modelo Prisma no encontrado: ${entity.model}`);

  const [rawRows, total] = await Promise.all([
    model.findMany({ where, select, orderBy, take: limit }) as Promise<Record<string, unknown>[]>,
    model.count({ where }),
  ]);

  // Project to flat records using the column paths
  const rows = rawRows.map((row) => {
    const out: Record<string, unknown> = { __id: row.id };
    for (const colKey of config.columns) {
      const def = entity.fields[colKey];
      if (!def) continue;
      const v = readPath(row, def.path);
      out[colKey] = serialiseScalar(v);
    }
    return out;
  });

  return { rows, total, truncated: total > limit };
}

function serialiseScalar(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  // Decimal from Prisma is an object — convert to number.
  if (v && typeof v === 'object' && 'toString' in v && typeof (v as { toString: () => string }).toString === 'function' && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return (v as { toNumber: () => number }).toNumber();
  }
  return v;
}

function ownerScopeFor(model: string, userId: string): Record<string, unknown> {
  // Each model has a different owner field. Map them so non-admins only
  // see records they own.
  switch (model) {
    case 'opportunity': return { ownerId: userId };
    case 'account': return { ownerId: userId };
    case 'contact': return { ownerId: userId };
    case 'activity': return { OR: [{ createdById: userId }, { account: { ownerId: userId } }] };
    case 'task': return { OR: [{ createdById: userId }, { account: { ownerId: userId } }] };
    default: return {};
  }
}

/// Convert a result set to CSV. Headers come from the column labels (entity
/// schema); cells are stringified (dates → ISO, numbers → as-is).
export function rowsToCsv(rows: Record<string, unknown>[], columns: string[], entityKey: string): string {
  const entity = ENTITIES[entityKey];
  if (!entity) throw new Error(`Entidad desconocida: ${entityKey}`);
  const headers = columns.map((c) => entity.fields[c]?.label ?? c);
  const lines: string[] = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(','));
  }
  return lines.join('\n');
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'true' : 'false') : JSON.stringify(v);
  // Escape quotes
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
