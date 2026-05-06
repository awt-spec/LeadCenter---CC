'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import { ACTION_LABEL, RESOURCE_LABEL } from './labels';

type Option = { value: string; label: string };
type UserOption = { id: string; name: string | null; email: string };

function chip(active: boolean) {
  return active
    ? 'border-sysde-red bg-sysde-red text-white'
    : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red';
}

export function AuditFilters({
  users,
  actions,
  resources,
  current,
}: {
  users: UserOption[];
  actions: string[];
  resources: string[];
  current: {
    userId: string[];
    action: string[];
    resource: string[];
    dateFrom?: string;
    dateTo?: string;
    q?: string;
    reviewState?: 'reviewed' | 'unreviewed' | 'all';
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(mutator: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(sp?.toString());
    mutator(next);
    next.delete('page'); // resetear paginación al cambiar filtros
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function toggleMulti(key: 'userId' | 'action' | 'resource', value: string) {
    update((n) => {
      const all = n.getAll(key);
      n.delete(key);
      if (all.includes(value)) all.filter((v) => v !== value).forEach((v) => n.append(key, v));
      else [...all, value].forEach((v) => n.append(key, v));
    });
  }

  function clearAll() {
    update((n) => {
      ['userId', 'action', 'resource', 'dateFrom', 'dateTo', 'q', 'reviewState'].forEach((k) =>
        n.delete(k)
      );
    });
  }

  const hasFilters =
    current.userId.length ||
    current.action.length ||
    current.resource.length ||
    current.dateFrom ||
    current.dateTo ||
    current.q ||
    (current.reviewState && current.reviewState !== 'all');

  const userOptions: Option[] = users.map((u) => ({
    value: u.id,
    label: u.name ?? u.email,
  }));
  const actionOptions: Option[] = actions.map((a) => ({
    value: a,
    label: ACTION_LABEL[a] ?? a,
  }));
  const resourceOptions: Option[] = resources.map((r) => ({
    value: r,
    label: RESOURCE_LABEL[r] ?? r,
  }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-sysde-mid pointer-events-none" />
          <Input
            placeholder="Buscar acción/recurso/id…"
            defaultValue={current.q ?? ''}
            className="pl-8 h-9 w-72"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim();
                update((n) => {
                  if (v) n.set('q', v);
                  else n.delete('q');
                });
              }
            }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-sysde-mid">Desde</span>
          <Input
            type="date"
            defaultValue={current.dateFrom ?? ''}
            className="h-9 w-[140px]"
            onChange={(e) => {
              const v = e.target.value;
              update((n) => {
                if (v) n.set('dateFrom', v);
                else n.delete('dateFrom');
              });
            }}
          />
          <span className="text-xs text-sysde-mid">Hasta</span>
          <Input
            type="date"
            defaultValue={current.dateTo ?? ''}
            className="h-9 w-[140px]"
            onChange={(e) => {
              const v = e.target.value;
              update((n) => {
                if (v) n.set('dateTo', v);
                else n.delete('dateTo');
              });
            }}
          />
        </div>

        <div className="inline-flex items-center gap-1 ml-2">
          <span className="text-xs text-sysde-mid">Revisión</span>
          {(['unreviewed', 'reviewed', 'all'] as const).map((opt) => {
            const isActive = (current.reviewState ?? 'all') === opt;
            const label = opt === 'unreviewed' ? 'Sin revisar' : opt === 'reviewed' ? 'Revisados' : 'Todos';
            return (
              <button
                key={opt}
                type="button"
                onClick={() =>
                  update((n) => {
                    if (opt === 'all') n.delete('reviewState');
                    else n.set('reviewState', opt);
                  })
                }
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  isActive
                    ? 'border-sysde-red bg-sysde-red text-white'
                    : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {hasFilters ? (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={pending}
            className="ml-auto h-9"
          >
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        ) : null}
      </div>

      <FilterChipGroup
        title="Usuarios"
        options={userOptions}
        selected={current.userId}
        onToggle={(v) => toggleMulti('userId', v)}
        chipClass={chip}
      />
      <FilterChipGroup
        title="Acciones"
        options={actionOptions}
        selected={current.action}
        onToggle={(v) => toggleMulti('action', v)}
        chipClass={chip}
      />
      <FilterChipGroup
        title="Recursos"
        options={resourceOptions}
        selected={current.resource}
        onToggle={(v) => toggleMulti('resource', v)}
        chipClass={chip}
      />
    </div>
  );
}

function FilterChipGroup({
  title,
  options,
  selected,
  onToggle,
  chipClass,
}: {
  title: string;
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
  chipClass: (active: boolean) => string;
}) {
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-sysde-mid pt-1.5 mr-1 min-w-[68px]">
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${chipClass(
              selected.includes(opt.value)
            )}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
