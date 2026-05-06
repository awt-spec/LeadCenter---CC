import Link from 'next/link';
import { Reply, Flame, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { ManagementStats } from '@/lib/opportunities/management-queries';

/**
 * Strip de stats clickeables. Cada tile filtra el listado al subset
 * correspondiente (URL params: staleness=red|orange|yellow OR
 * needsResponse=true). El tile activo se resalta.
 */

const HOUR = 60 * 60 * 1000;
void HOUR;

type Active = 'fresh' | 'yellow' | 'orange' | 'red' | 'needsResponse' | null;

function detectActive(searchParams: URLSearchParams | null): Active {
  if (!searchParams) return null;
  if (searchParams.get('needsResponse') === 'true') return 'needsResponse';
  const s = searchParams.get('staleness');
  if (s === 'fresh' || s === 'yellow' || s === 'orange' || s === 'red') return s;
  return null;
}

function buildHref(
  baseQuery: URLSearchParams,
  set: { needsResponse?: boolean; staleness?: string | null }
): string {
  const next = new URLSearchParams(baseQuery);
  // Estos filtros son mutuamente excluyentes en la UX
  next.delete('needsResponse');
  next.delete('staleness');
  if (set.needsResponse) next.set('needsResponse', 'true');
  if (set.staleness) next.set('staleness', set.staleness);
  next.delete('page');
  const s = next.toString();
  return s ? `?${s}` : '?';
}

export function ManagementStatsStrip({
  stats,
  searchParams,
  basePath = '/opportunities',
}: {
  stats: ManagementStats;
  searchParams: URLSearchParams | null;
  basePath?: string;
}) {
  const active = detectActive(searchParams);
  const baseQuery = new URLSearchParams(searchParams?.toString() ?? '');

  const tiles: Array<{
    key: Exclude<Active, null>;
    icon: React.ReactNode;
    label: string;
    value: number;
    /// Tailwind classes para fondo + texto
    palette: { idle: string; activeBg: string; ring: string };
    href: string;
    description: string;
  }> = [
    {
      key: 'needsResponse',
      icon: <Reply className="h-4 w-4" />,
      label: 'Necesitan respuesta',
      value: stats.needsResponse,
      palette: {
        idle: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
        activeBg: 'bg-blue-600 text-white border-blue-700',
        ring: 'ring-blue-300',
      },
      href: `${basePath}${buildHref(baseQuery, { needsResponse: true })}`,
      description: 'cliente respondió',
    },
    {
      key: 'red',
      icon: <Flame className="h-4 w-4" />,
      label: 'En rojo',
      value: stats.red,
      palette: {
        idle: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
        activeBg: 'bg-red-600 text-white border-red-700',
        ring: 'ring-red-300',
      },
      href: `${basePath}${buildHref(baseQuery, { staleness: 'red' })}`,
      description: '72h+ sin gestión',
    },
    {
      key: 'orange',
      icon: <AlertTriangle className="h-4 w-4" />,
      label: 'En naranja',
      value: stats.orange,
      palette: {
        idle: 'bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200',
        activeBg: 'bg-orange-600 text-white border-orange-700',
        ring: 'ring-orange-300',
      },
      href: `${basePath}${buildHref(baseQuery, { staleness: 'orange' })}`,
      description: '48-72h',
    },
    {
      key: 'yellow',
      icon: <Clock className="h-4 w-4" />,
      label: 'En amarillo',
      value: stats.yellow,
      palette: {
        idle: 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
        activeBg: 'bg-yellow-500 text-white border-yellow-600',
        ring: 'ring-yellow-300',
      },
      href: `${basePath}${buildHref(baseQuery, { staleness: 'yellow' })}`,
      description: '24-48h',
    },
    {
      key: 'fresh',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Al día',
      value: stats.fresh,
      palette: {
        idle: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
        activeBg: 'bg-green-600 text-white border-green-700',
        ring: 'ring-green-300',
      },
      href: `${basePath}${buildHref(baseQuery, { staleness: 'fresh' })}`,
      description: '<24h',
    },
  ];

  // Si no hay nada para mostrar (escenario raro), oculto el strip
  if (stats.total === 0) return null;

  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => {
        const isActive = active === t.key;
        const cls = isActive ? t.palette.activeBg : t.palette.idle;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={`relative rounded-lg border px-4 py-3 transition-all ${cls} ${
              isActive ? `ring-2 ${t.palette.ring} ring-offset-1` : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold opacity-90">
                {t.icon}
                {t.label}
              </div>
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums leading-none">{t.value}</div>
            <div
              className={`mt-1 text-[10px] ${
                isActive ? 'text-white/80' : 'opacity-75'
              }`}
            >
              {t.description}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
