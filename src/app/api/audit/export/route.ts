import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { listAuditForExport, type AuditLogRow } from '@/lib/audit/queries';
import { parseAuditFilters } from '@/lib/audit/parse-filters';

const MAX_EXPORT_ROWS = 10_000;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  // RFC 4180: si tiene coma, quotes o newline, envolver en quotes y duplicar quotes internas.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCSV(rows: AuditLogRow[]): string {
  const header = [
    'timestamp_iso',
    'user_id',
    'user_name',
    'user_email',
    'action',
    'resource',
    'resource_id',
    'ip',
    'user_agent',
    'changes_json',
    'metadata_json',
  ].join(',');

  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      r.user?.id ?? '',
      r.user?.name ?? '',
      r.user?.email ?? '',
      r.action,
      r.resource,
      r.resourceId ?? '',
      r.ipAddress ?? '',
      r.userAgent ?? '',
      r.changes,
      r.metadata,
    ]
      .map(csvEscape)
      .join(',')
  );

  return [header, ...lines].join('\r\n') + '\r\n';
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!can(session, 'audit:read')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters = parseAuditFilters(url.searchParams);

  const rows = await listAuditForExport(filters, MAX_EXPORT_ROWS);
  const csv = rowsToCSV(rows);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `audit-${stamp}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
