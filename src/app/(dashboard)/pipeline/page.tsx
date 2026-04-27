import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { listCountries, listUsers } from '@/lib/contacts/queries';
import { loadPipeline } from '@/lib/pipeline/queries';
import { computePipelineStats } from '@/lib/pipeline/forecast';
import { parsePipelineFilters } from '@/lib/pipeline/parse-filters';
import { PipelineHeader } from './components/pipeline-header';
import { PipelineStatsBar } from './components/pipeline-stats';
import { PipelineFilters } from './components/pipeline-filters';
import { PipelineBoard } from './components/pipeline-board';

export const metadata = { title: 'Pipeline' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return <Forbidden message="No tienes permiso para ver el pipeline." />;
  }

  // Build URLSearchParams-like for reuse
  const urlParams = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((val) => urlParams.append(k, val));
    else urlParams.set(k, v);
  }
  const filters = parsePipelineFilters(urlParams);

  const [cards, stats, countries, users] = await Promise.all([
    loadPipeline(session, filters),
    computePipelineStats(session, filters),
    listCountries(),
    listUsers(),
  ]);

  const canChangeStage = can(session, 'opportunities:change_stage');
  const canCreate = can(session, 'opportunities:create');

  return (
    <div className="space-y-6">
      <PipelineHeader
        openCount={stats.openCount}
        pipelineTotal={stats.pipelineTotal}
        forecast={stats.forecast}
        canCreate={canCreate}
      />

      <PipelineStatsBar stats={stats} />

      <PipelineFilters
        countries={countries}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarUrl: u.avatarUrl,
        }))}
      />

      <PipelineBoard
        initialCards={cards}
        visibleOptional={{
          includeWon: !!filters.includeWon,
          includeLost: !!filters.includeLost,
          includeStandBy: !!filters.includeStandBy,
          includeNurture: !!filters.includeNurture,
        }}
        canChangeStage={canChangeStage}
        canCreate={canCreate}
      />
    </div>
  );
}
