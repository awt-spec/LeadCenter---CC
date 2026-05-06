import Link from 'next/link';
import type { Session } from 'next-auth';
import type { Prisma } from '@prisma/client';
import { Megaphone, Database, Users, Building2, ListChecks, Sparkles, ArrowUpRight } from 'lucide-react';
import { auth } from '@/lib/auth';
import { hasRole, can } from '@/lib/rbac';
import { Forbidden } from '@/components/shared/forbidden';
import { Card } from '@/components/ui/card';
import { loadMarketingSprint, loadBDSprint, loadAudit } from '@/lib/sprint/queries';
import {
  getManagementStats,
  getNeedAttentionOpps,
} from '@/lib/opportunities/management-queries';
import { SprintBoardView } from './components/sprint-board';
import { AuditTable } from './components/audit-table';
import { NeedAttentionHero } from '../opportunities/components/need-attention-hero';

export const metadata = { title: 'Sprint' };
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VIEWS = [
  { key: 'sprint', label: 'Sprint' },
  { key: 'audit', label: 'Auditoría' },
] as const;

export default async function SprintPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) return null;

  // Detect role view. Marketing → leads, BD → bd. Admin/CEO can pick.
  const isAdmin = hasRole(session, 'admin') || hasRole(session, 'ceo');
  const isMarketing = hasRole(session, 'marketing');
  const isBD = hasRole(session, 'bd');

  if (!isMarketing && !isBD && !isAdmin) {
    return <Forbidden message="Tu rol no tiene una vista de sprint asociada." />;
  }

  const requestedRoleView = (Array.isArray(sp.role) ? sp.role[0] : sp.role) as 'marketing' | 'bd' | undefined;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) === 'audit' ? 'audit' : 'sprint';

  const roleView: 'marketing' | 'bd' = requestedRoleView ?? (isMarketing ? 'marketing' : isBD ? 'bd' : 'marketing');

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-sysde-red">
            {roleView === 'marketing' ? 'Marketing & Demand Gen' : 'Business Development'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-sysde-gray sm:text-3xl">
            Sprint actual
          </h1>
          <p className="mt-0.5 text-sm text-sysde-mid">
            {roleView === 'marketing'
              ? 'Leads en gestión esta semana, campañas activas, y tu cadencia de actividad.'
              : 'Pipeline de generación de base de datos y trabajo de research.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-1 rounded-lg border border-sysde-border bg-white p-1 text-[11px]">
              <Link
                href="/sprint?role=marketing"
                className={tabBtnCls(roleView === 'marketing')}
              >
                <Megaphone className="mr-1 h-3 w-3" /> Marketing
              </Link>
              <Link
                href="/sprint?role=bd"
                className={tabBtnCls(roleView === 'bd')}
              >
                <Database className="mr-1 h-3 w-3" /> BD
              </Link>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-sysde-border bg-white p-1 text-[11px]">
            {VIEWS.map((v) => (
              <Link
                key={v.key}
                href={
                  v.key === 'sprint'
                    ? `/sprint${roleView !== (isMarketing ? 'marketing' : 'bd') ? `?role=${roleView}` : ''}`
                    : `/sprint?tab=audit${roleView !== (isMarketing ? 'marketing' : 'bd') ? `&role=${roleView}` : ''}`
                }
                className={tabBtnCls(tab === v.key)}
              >
                {v.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Hero "Atención requerida" del usuario actual — siempre visible
          en Sprint (excepto en Auditoría que tiene su propia consola). */}
      {tab !== 'audit' ? (
        <MyAttentionWidget session={session} />
      ) : null}

      {tab === 'audit' ? (
        <AuditView />
      ) : roleView === 'marketing' ? (
        <MarketingView session={session} />
      ) : (
        <BDView session={session} />
      )}
    </div>
  );
}

async function MyAttentionWidget({ session }: { session: Session }) {
  // Permiso de leer opps. Si solo tiene :read:own scopeamos a sus propias.
  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return null;
  }
  const canAll = can(session, 'opportunities:read:all');
  // En Sprint queremos ver SIEMPRE las del user actual aunque sea admin —
  // el sprint es personal.
  const scope: Prisma.OpportunityWhereInput = canAll
    ? { ownerId: session.user.id }
    : { ownerId: session.user.id };

  const [stats, opps] = await Promise.all([
    getManagementStats(scope),
    getNeedAttentionOpps(scope, 6),
  ]);

  // Si no tiene NADA en su pipeline abierto, no mostramos el widget
  if (stats.total === 0) return null;

  return (
    <NeedAttentionHero
      opps={opps}
      totalNeedsResponse={stats.needsResponse}
      totalRed={stats.red}
    />
  );
}

function tabBtnCls(active: boolean): string {
  return `inline-flex items-center rounded-md px-3 py-1.5 font-semibold uppercase tracking-wide transition ${
    active ? 'bg-sysde-red text-white shadow-sm' : 'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
  }`;
}

async function AuditView() {
  const users = await loadAudit(14);
  return (
    <div className="space-y-3">
      <p className="text-sm text-sysde-mid">
        Actividad por usuario en los últimos 14 días. Quién hizo qué y cuándo — emails, llamadas, reuniones, notas y tareas.
      </p>
      <AuditTable users={users} />
    </div>
  );
}

async function MarketingView({ session }: { session: import('next-auth').Session }) {
  const { board, campaigns } = await loadMarketingSprint(session);
  return (
    <div className="space-y-6">
      <SprintBoardView board={board} />

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-sysde-border bg-sysde-bg/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-sysde-red" />
            <h2 className="font-semibold text-sysde-gray">Campañas activas</h2>
          </div>
          <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs font-medium text-sysde-red hover:underline">
            Ver todas <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-sysde-border">
          {campaigns.length === 0 ? (
            <div className="px-4 py-6 text-sm text-sysde-mid">
              No tenés campañas activas. <Link href="/campaigns" className="text-sysde-red hover:underline">Crear una</Link>.
            </div>
          ) : (
            campaigns.map((c) => {
              const pct = c.targetCount === 0 ? 0 : Math.round((c.engagedCount / c.targetCount) * 100);
              return (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="grid grid-cols-[1fr_120px_140px] items-center gap-4 px-4 py-3 transition hover:bg-sysde-bg/40"
                >
                  <div>
                    <p className="font-medium text-sysde-gray">{c.name}</p>
                    <p className="text-[11px] text-sysde-mid">
                      {c.targetCount} contactos · {c.engagedCount} engaged · {c.status}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="text-right text-xs text-sysde-mid">
                    <span className="font-semibold tabular-nums text-sysde-gray">{pct}%</span> respuesta
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}

async function BDView({ session }: { session: import('next-auth').Session }) {
  const { board, stats } = await loadBDSprint(session);
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Building2 className="h-4 w-4 text-sysde-red" />} label="Cuentas totales" value={stats.totalAccounts.toLocaleString('es-MX')} />
        <StatCard icon={<Users className="h-4 w-4 text-sysde-red" />} label="Contactos totales" value={stats.totalContacts.toLocaleString('es-MX')} />
        <StatCard icon={<Sparkles className="h-4 w-4 text-emerald-600" />} label="Esta semana" value={`+${stats.addedThisWeek}`} accent="emerald" />
        <StatCard icon={<ListChecks className="h-4 w-4 text-amber-600" />} label="Por revisar dominio" value={stats.needsReview.toLocaleString('es-MX')} accent="amber" />
      </div>

      <SprintBoardView board={board} />
    </div>
  );
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: 'emerald' | 'amber' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</span>
      </div>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${accent === 'emerald' ? 'text-emerald-600' : accent === 'amber' ? 'text-amber-600' : 'text-sysde-gray'}`}>
        {value}
      </p>
    </Card>
  );
}
