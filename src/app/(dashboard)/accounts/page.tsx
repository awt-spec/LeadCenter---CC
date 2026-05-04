import Link from 'next/link';
import { Building2, Plus, Download } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Forbidden } from '@/components/shared/forbidden';
import { EmptyState } from '@/components/shared/empty-state';
import { listAccounts, getAccountStats } from '@/lib/accounts/queries';
import { listCountries, listUsers } from '@/lib/contacts/queries';
import { accountFilterSchema } from '@/lib/accounts/schemas';
import { AccountStats } from './components/account-stats';
import { AccountsFilters } from './components/accounts-filters';
import { AccountsTable, type AccountRow } from './components/accounts-table';

export const metadata = { title: 'Cuentas' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function arr(v: string | string[] | undefined) {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'accounts:read:all') && !can(session, 'accounts:read:own')) {
    return <Forbidden message="No tienes permiso para ver cuentas." />;
  }

  const filters = accountFilterSchema.parse({
    q: typeof sp.q === 'string' ? sp.q : undefined,
    country: arr(sp.country),
    segment: arr(sp.segment),
    status: arr(sp.status),
    size: arr(sp.size),
    ownerId: arr(sp.ownerId),
    hasActiveOpps: sp.hasActiveOpps === 'true',
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 50,
    sortBy: typeof sp.sortBy === 'string' ? sp.sortBy : 'createdAt',
    sortDir: sp.sortDir === 'asc' ? 'asc' : 'desc',
  });

  const [{ rows, total }, stats, countries, users] = await Promise.all([
    listAccounts(session, filters),
    getAccountStats(session),
    listCountries(),
    listUsers(),
  ]);

  const canCreate = can(session, 'accounts:create');
  const canUpdateAll = can(session, 'accounts:update:all');
  const canDelete = can(session, 'accounts:delete');

  const tableRows: AccountRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    needsDomainReview: r.needsDomainReview,
    country: r.country,
    segment: r.segment,
    size: r.size,
    status: r.status,
    priority: r.priority,
    updatedAt: r.updatedAt,
    owner: r.owner,
    _count: r._count,
    pipelineTotal: r.opportunities.reduce((acc, o) => acc + Number(o.estimatedValue ?? 0), 0),
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold text-sysde-gray">Cuentas</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {stats.total.toLocaleString('es-MX')} cuentas · {stats.prospects} prospectos ·{' '}
            {stats.customers} clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href="/accounts/api/export" download>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </a>
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/accounts/new">
                <Plus className="mr-2 h-4 w-4" />
                Nueva cuenta
              </Link>
            </Button>
          )}
        </div>
      </div>

      <AccountStats stats={stats} />

      <div className="mt-6">
        <AccountsFilters
          countries={countries}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />

        {total === 0 ? (
          <div className="rounded-xl border border-sysde-border bg-white">
            <EmptyState
              icon={Building2}
              title="Sin cuentas"
              description="Crea la primera cuenta de tu pipeline."
              action={
                canCreate && (
                  <Button asChild>
                    <Link href="/accounts/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva cuenta
                    </Link>
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <AccountsTable
            rows={tableRows}
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
            users={users.map((u) => ({ id: u.id, name: u.name }))}
            canUpdateAll={canUpdateAll}
            canDelete={canDelete}
          />
        )}
      </div>
    </div>
  );
}
