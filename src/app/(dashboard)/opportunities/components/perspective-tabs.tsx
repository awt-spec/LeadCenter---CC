import Link from 'next/link';
import {
  Sparkles,
  AlertOctagon,
  TrendingUp,
  UserX,
  Users,
} from 'lucide-react';
import type { AttentionPerspective } from '@/lib/opportunities/management-queries';

const TABS: Array<{
  key: AttentionPerspective;
  label: string;
  icon: React.ElementType;
  description: string;
}> = [
  {
    key: 'smart',
    label: 'Smart',
    icon: Sparkles,
    description: 'Score combinado: urgencia × valor × stage × asignación',
  },
  {
    key: 'urgency',
    label: 'Urgencia',
    icon: AlertOctagon,
    description: 'Pelota en tu campo → 72h+ → sin gestión',
  },
  {
    key: 'value',
    label: 'Valor',
    icon: TrendingUp,
    description: 'Las más grandes que están en peligro',
  },
  {
    key: 'unassigned',
    label: 'Sin asignar',
    icon: UserX,
    description: 'Opps sin owner que necesitan dueño',
  },
  {
    key: 'by_owner',
    label: 'Por owner',
    icon: Users,
    description: 'Agrupado por responsable',
  },
];

/**
 * Tabs URL-driven (?attention=smart|urgency|...).
 * Server component — el href usa el path actual con ese parámetro.
 */
export function PerspectiveTabs({
  current,
  basePath,
  searchParams,
}: {
  current: AttentionPerspective;
  basePath: string;
  searchParams: URLSearchParams;
}) {
  const buildHref = (perspective: AttentionPerspective): string => {
    const next = new URLSearchParams(searchParams);
    if (perspective === 'smart') next.delete('attention'); // smart es default
    else next.set('attention', perspective);
    const qs = next.toString();
    return `${basePath}${qs ? '?' + qs : ''}`;
  };

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-lg border border-sysde-border bg-white p-1"
      role="tablist"
    >
      {TABS.map((t) => {
        const isActive = current === t.key;
        const Icon = t.icon;
        return (
          <Link
            key={t.key}
            href={buildHref(t.key)}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            title={t.description}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              isActive
                ? 'bg-sysde-red text-white shadow-sm'
                : 'text-sysde-mid hover:bg-sysde-bg hover:text-sysde-gray'
            }`}
          >
            <Icon className="h-3 w-3" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
