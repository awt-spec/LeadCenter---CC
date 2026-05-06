import Link from 'next/link';
import { Briefcase, Download, LayoutGrid, Plus, Table as TableIcon } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import { Forbidden } from '@/components/shared/forbidden';
import { EmptyState } from '@/components/shared/empty-state';
import type { Prisma } from '@prisma/client';
import { listCountries, listUsers } from '@/lib/contacts/queries';
import { listOpportunities, getOpportunityStats } from '@/lib/opportunities/queries';
import {
  getManagementStats,
  getNeedAttentionOpps,
} from '@/lib/opportunities/management-queries';
import { opportunityFilterSchema } from '@/lib/opportunities/schemas';
import { OpportunityStats } from './components/opportunity-stats';
import { OpportunitiesFilters } from './components/opportunities-filters';
import { OpportunitiesTable, type OpportunityRow } from './components/opportunities-table';
import { OpportunitiesCards } from './components/opportunities-cards';
import { ManagementStatsStrip } from './components/management-stats-strip';
import { NeedAttentionHero } from './components/need-attention-hero';

export const metadata = { title: 'Oportunidades' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function arr(v: string | string[] | undefined) {
  if (!v) return undefined;
  return Array.isArray(v) ? v : [v];
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return <Forbidden message="No tienes permiso para ver oportunidades." />;
  }

  const filters = opportunityFilterSchema.parse({
    q: typeof sp.q === 'string' ? sp.q : undefined,
    stage: arr(sp.stage),
    status: arr(sp.status),
    product: arr(sp.product),
    subProduct: arr(sp.subProduct),
    rating: arr(sp.rating),
    ownerId: arr(sp.ownerId),
    country: arr(sp.country),
    onlyMine: sp.onlyMine === 'true',
    page: sp.page ? Number(sp.page) : 1,
    pageSize: sp.pageSize ? Number(sp.pageSize) : 50,
    sortBy: typeof sp.sortBy === 'string' ? sp.sortBy : 'createdAt',
    sortDir: sp.sortDir === 'asc' ? 'asc' : 'desc',
  });

  // Scope para management stats: si user es admin, ve todas; si solo
  // tiene :read:own, ve las suyas. Mismo principio que listOpportunities.
  const canAll = can(session, 'opportunities:read:all');
  const mgmtScope: Prisma.OpportunityWhereInput = canAll
    ? {}
    : { ownerId: session.user.id };
  // Si el user activó "onlyMine" en filtros, también scopeamos las stats
  const effectiveScope: Prisma.OpportunityWhereInput =
    filters.onlyMine && canAll ? { ownerId: session.user.id } : mgmtScope;

  const [
    { rows, total },
    stats,
    mgmtStats,
    needAttention,
    countries,
    users,
  ] = await Promise.all([
    listOpportunities(session, filters),
    getOpportunityStats(session),
    getManagementStats(effectiveScope),
    getNeedAttentionOpps(effectiveScope, 6),
    listCountries(),
    listUsers(),
  ]);

  const canCreate = can(session, 'opportunities:create');

  // Vista preferida (table o cards). Default = table.
  const viewMode: 'table' | 'cards' = sp.view === 'cards' ? 'cards' : 'table';

  // Reconstruimos URLSearchParams para los hijos (stats strip, etc.)
  const searchParamsString = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => searchParamsString.append(k, val));
    else searchParamsString.set(k, v);
  }

  const tableRows: OpportunityRow[] = rows.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    stage: o.stage,
    status: o.status,
    product: o.product,
    rating: o.rating,
    estimatedValue: o.estimatedValue ? Number(o.estimatedValue) : null,
    currency: o.currency,
    probability: o.probability,
    expectedCloseDate: o.expectedCloseDate,
    nextActionDate: o.nextActionDate,
    lastActivityAt: o.lastActivityAt,
    lastActivityDirection: o.lastActivityDirection,
    updatedAt: o.updatedAt,
    account: o.account,
    owner: o.owner,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-semibold text-sysde-gray">Oportunidades</h2>
          <p className="mt-1 text-sm text-sysde-mid">
            {stats.openCount} abiertas · Pipeline{' '}
            {stats.pipelineTotal.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} · Forecast{' '}
            {stats.forecast.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-sysde-border bg-white p-1 text-sm">
            <Link
              href={(() => {
                const next = new URLSearchParams(searchParamsString);
                next.delete('view');
                const qs = next.toString();
                return `/opportunities${qs ? '?' + qs : ''}`;
              })()}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-sysde-bg text-sysde-gray'
                  : 'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tabla
            </Link>
            <Link
              href={(() => {
                const next = new URLSearchParams(searchParamsString);
                next.set('view', 'cards');
                return `/opportunities?${next.toString()}`;
              })()}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${
                viewMode === 'cards'
                  ? 'bg-sysde-bg text-sysde-gray'
                  : 'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
            </Link>
            <Link
              href="/pipeline"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium text-sysde-mid transition-colors hover:bg-sysde-bg hover:text-sysde-gray"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </Link>
          </div>
          <Button asChild variant="outline">
            <a href="/opportunities/api/export" download>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </a>
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/opportunities/new">
                <Plus className="mr-2 h-4 w-4" />
                Nueva oportunidad
              </Link>
            </Button>
          )}
        </div>
      </div>

      <OpportunityStats stats={stats} />

      {/* Reglas de gestión: stats strip clickeables + hero de atención */}
      <div className="mt-6 space-y-4">
        <ManagementStatsStrip
          stats={mgmtStats}
          searchParams={searchParamsString}
          basePath="/opportunities"
        />
        <NeedAttentionHero
          opps={needAttention}
          totalNeedsResponse={mgmtStats.needsResponse}
          totalRed={mgmtStats.red}
        />
      </div>

      <div className="mt-6">
        <OpportunitiesFilters
          countries={countries}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
        />

        {total === 0 ? (
          <div className="rounded-xl border border-sysde-border bg-white">
            <EmptyState
              icon={Briefcase}
              title="Sin oportunidades"
              description="Crea la primera oportunidad del pipeline."
              action={
                canCreate && (
                  <Button asChild>
                    <Link href="/opportunities/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Nueva oportunidad
                    </Link>
                  </Button>
                )
              }
            />
          </div>
        ) : viewMode === 'cards' ? (
          <OpportunitiesCards
            rows={tableRows}
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
          />
        ) : (
          <OpportunitiesTable
            rows={tableRows}
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
          />
        )}
      </div>
    </div>
  );
}
