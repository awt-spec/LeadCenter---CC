import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogRow } from '@/lib/audit/queries';
import { ACTION_LABEL, ACTION_VARIANT, RESOURCE_LABEL } from './labels';
import { ChangesDiff } from './changes-diff';
import { UAIcon } from './ua-icon';

export function AuditTable({
  rows,
  total,
  page,
  pageSize,
  baseUrl,
}: {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  baseUrl: string; // ya incluye los filtros, e.g. "/audit?action=create"
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const sep = baseUrl.includes('?') ? '&' : '?';
  const prevHref = `${baseUrl}${sep}page=${Math.max(1, page - 1)}`;
  const nextHref = `${baseUrl}${sep}page=${Math.min(totalPages, page + 1)}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sysde-border">
        <h3 className="text-sm font-semibold text-sysde-gray">Eventos</h3>
        <div className="text-xs text-sysde-mid">
          {total === 0 ? '0 resultados' : `${from}–${to} de ${total.toLocaleString('es')}`}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Cuándo</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>IP</TableHead>
            <TableHead className="w-[60px]">Cliente</TableHead>
            <TableHead className="w-[60px] text-right">Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12 text-sysde-mid text-sm">
                Sin eventos para los filtros actuales.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => <AuditRow key={r.id} row={r} />)
          )}
        </TableBody>
      </Table>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between px-4 py-3 border-t border-sysde-border text-sm">
          <span className="text-xs text-sysde-mid">
            Página {page} de {totalPages.toLocaleString('es')}
          </span>
          <div className="flex gap-2">
            <Link
              href={prevHref}
              aria-disabled={page <= 1}
              className={`px-3 py-1 rounded-md border text-xs ${
                page <= 1
                  ? 'opacity-40 pointer-events-none border-sysde-border'
                  : 'border-sysde-border hover:border-sysde-red hover:text-sysde-red'
              }`}
            >
              ← Anterior
            </Link>
            <Link
              href={nextHref}
              aria-disabled={page >= totalPages}
              className={`px-3 py-1 rounded-md border text-xs ${
                page >= totalPages
                  ? 'opacity-40 pointer-events-none border-sysde-border'
                  : 'border-sysde-border hover:border-sysde-red hover:text-sysde-red'
              }`}
            >
              Siguiente →
            </Link>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AuditRow({ row }: { row: AuditLogRow }) {
  const actionLabel = ACTION_LABEL[row.action] ?? row.action;
  const actionVariant = ACTION_VARIANT[row.action] ?? 'secondary';
  const resourceLabel = RESOURCE_LABEL[row.resource] ?? row.resource;

  const userName = row.user?.name ?? row.user?.email ?? 'Sistema';
  const userInitials = userName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hasDetail =
    (row.changes && Object.keys(row.changes as object).length > 0) ||
    (row.metadata && Object.keys(row.metadata as object).length > 0);

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="text-sm text-sysde-gray">
          {formatDistanceToNow(row.createdAt, { addSuffix: true, locale: es })}
        </div>
        <div className="text-[10px] text-sysde-mid font-mono">
          {format(row.createdAt, 'yyyy-MM-dd HH:mm:ss')}
        </div>
      </TableCell>
      <TableCell className="align-top">
        {row.user ? (
          <Link
            href={`/audit?userId=${row.user.id}`}
            className="flex items-center gap-2 hover:text-sysde-red"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sysde-red text-white text-[10px] font-bold">
              {userInitials || '·'}
            </span>
            <div>
              <div className="text-sm font-medium">{userName}</div>
              {row.user.email && row.user.name ? (
                <div className="text-[10px] text-sysde-mid">{row.user.email}</div>
              ) : null}
            </div>
          </Link>
        ) : (
          <span className="text-xs text-sysde-mid italic">Sistema</span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Badge variant={actionVariant}>{actionLabel}</Badge>
      </TableCell>
      <TableCell className="align-top text-sm">{resourceLabel}</TableCell>
      <TableCell className="align-top">
        {row.resourceId ? (
          <Link
            href={`/audit/resource/${encodeURIComponent(row.resource)}/${encodeURIComponent(row.resourceId)}`}
            className="text-[10px] bg-sysde-bg px-1.5 py-0.5 rounded text-sysde-mid hover:bg-red-50 hover:text-sysde-red transition-colors font-mono"
            title="Ver historia completa de este recurso"
          >
            {row.resourceId.slice(0, 12)}
            {row.resourceId.length > 12 ? '…' : ''}
          </Link>
        ) : (
          <span className="text-sysde-mid">—</span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <span className="text-[11px] font-mono text-sysde-mid">{row.ipAddress ?? '—'}</span>
      </TableCell>
      <TableCell className="align-top">
        <UAIcon ua={row.userAgent} />
      </TableCell>
      <TableCell className="align-top text-right">
        {hasDetail ? (
          <details className="inline-block">
            <summary className="cursor-pointer text-sysde-red text-xs hover:underline list-none">
              ver
            </summary>
            <div className="absolute right-4 mt-1 w-[480px] max-w-[90vw] rounded-lg border border-sysde-border bg-white shadow-lg p-3 z-10 text-left">
              {row.changes ? (
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-sysde-mid mb-1.5">
                    Cambios
                  </div>
                  <ChangesDiff changes={row.changes} />
                </div>
              ) : null}
              {row.metadata ? (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-sysde-mid mb-1">
                    Metadata
                  </div>
                  <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-sysde-gray bg-sysde-bg p-2 rounded">
                    {JSON.stringify(row.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : (
          <span className="text-sysde-mid text-xs">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}
