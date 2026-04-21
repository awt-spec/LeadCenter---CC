import Link from 'next/link';
import { Briefcase, Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Forbidden } from '@/components/shared/forbidden';
import { EmptyState } from '@/components/shared/empty-state';
import { listCountries, listUsers } from '@/lib/contacts/queries';
import { listOpportunities, getOpportunityStats } from '@/lib/opportunities/queries';
import { opportunityFilterSchema } from '@/lib/opportunities/schemas';
import { OpportunityStats } from './components/opportunity-stats';
import { OpportunitiesFilters } from './components/opportunities-filters';
import { OpportunitiesTable, type OpportunityRow } from './components/opportunities-table';

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

  const [{ rows, total }, stats, countries, users] = await Promise.all([
    listOpportunities(session, filters),
    getOpportunityStats(session),
    listCountries(),
    listUsers(),
  ]);

  const canCreate = can(session, 'opportunities:create');

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
            <button type="button" className="rounded-md bg-sysde-bg px-3 py-1 font-medium text-sysde-gray">
              Tabla
            </button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <button
                      type="button"
                      disabled
                      className="rounded-md px-3 py-1 text-sysde-mid opacity-60"
                    >
                      Kanban
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Próximamente (siguiente fase)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
