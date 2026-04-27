import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, Upload, ArrowRight, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';

type RowError = { row: number; email?: string; message: string };

export const metadata = { title: 'Resultado de importación' };

export default async function ImportResultPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'contacts:import_csv') && !can(session, 'audit:read')) {
    return <Forbidden />;
  }

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!batch) notFound();

  const errors: RowError[] = Array.isArray(batch.errors) ? (batch.errors as unknown as RowError[]) : [];

  const stats = [
    { label: 'Creados', value: batch.createdCount, color: 'text-success' },
    { label: 'Actualizados', value: batch.updatedCount, color: 'text-info' },
    { label: 'Saltados', value: batch.skippedCount, color: 'text-warning' },
    { label: 'Fallidos', value: batch.failedCount, color: 'text-danger' },
  ];

  return (
    <div>
      <Link
        href="/contacts"
        className="inline-flex items-center gap-1 text-sm text-sysde-mid transition-colors hover:text-sysde-gray"
      >
        <ChevronLeft className="h-4 w-4" />
        Contactos
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold text-sysde-gray">Resultado de importación</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            <strong className="font-medium">{batch.fileName}</strong> ·{' '}
            {batch.totalRows.toLocaleString('es-MX')} filas ·{' '}
            {batch.completedAt &&
              format(batch.completedAt, "d LLL yyyy HH:mm", { locale: es })}
          </p>
        </div>
        <Badge
          variant={
            batch.status === 'COMPLETED'
              ? 'success'
              : batch.status === 'COMPLETED_WITH_ERRORS'
              ? 'warning'
              : batch.status === 'FAILED'
              ? 'danger'
              : 'secondary'
          }
        >
          {batch.status.replace(/_/g, ' ')}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className={`text-3xl font-semibold ${s.color}`}>{s.value.toLocaleString('es-MX')}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-sysde-mid">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/contacts?importBatchId=${batch.id}`}>
            Ver contactos importados
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/contacts/import">
            <Upload className="mr-2 h-4 w-4" />
            Importar otro archivo
          </Link>
        </Button>
      </div>

      {errors.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Errores por fila ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-sysde-bg">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-20">Fila</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mensaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((err, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{err.row}</TableCell>
                    <TableCell className="text-sysde-mid">{err.email ?? '—'}</TableCell>
                    <TableCell className="text-sysde-gray">{err.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
