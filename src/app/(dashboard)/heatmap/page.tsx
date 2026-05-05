import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { loadHeatmap, type HeatmapFilters } from '@/lib/heatmap/queries';
import { listCountries, listUsers } from '@/lib/contacts/queries';
import { HeatmapHeader } from './components/heatmap-header';
import { HeatmapGrid } from './components/heatmap-grid';
import { HeatmapFiltersBar } from './components/heatmap-filters';
import { HeatmapLegend } from './components/heatmap-legend';

export const metadata = { title: 'Mapa de calor' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HeatmapPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return <Forbidden message="No tienes permiso para ver el mapa de calor." />;
  }

  const oneOf = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const filters: HeatmapFilters = {
    ownerId: oneOf('owner') || undefined,
    segment: oneOf('segment') || undefined,
    country: oneOf('country') || undefined,
    status: oneOf('status') || undefined,
    weeks: oneOf('weeks') ? Number(oneOf('weeks')) : 12,
    scope: (oneOf('scope') as 'all' | 'mine') ?? (can(session, 'opportunities:read:all') ? 'all' : 'mine'),
  };

  const [heatmap, countries, users] = await Promise.all([
    loadHeatmap(session, filters),
    listCountries(),
    listUsers(),
  ]);

  return (
    <div className="space-y-6">
      <HeatmapHeader
        totalAccounts={heatmap.totals.accounts}
        totalActivities={heatmap.totals.activities}
        weeksCount={heatmap.weeks.length}
      />

      <HeatmapFiltersBar
        countries={countries}
        users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, avatarUrl: u.avatarUrl }))}
        canSeeAll={can(session, 'opportunities:read:all')}
      />

      <HeatmapLegend />

      <HeatmapGrid weeks={heatmap.weeks} rows={heatmap.rows} />
    </div>
  );
}
