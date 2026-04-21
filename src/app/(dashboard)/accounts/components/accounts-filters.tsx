'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_SIZE_LABELS,
  SEGMENT_LABELS_EXTENDED,
} from '@/lib/shared/labels';

type UserLite = { id: string; name: string };

type Props = {
  countries: string[];
  users: UserLite[];
};

export function AccountsFilters({ countries, users }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');

  const getMulti = (key: string) => params.getAll(key);

  function update(next: Record<string, string | string[] | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      sp.delete(k);
      if (v === null || (Array.isArray(v) && v.length === 0) || v === '') continue;
      if (Array.isArray(v)) v.forEach((val) => sp.append(k, val));
      else sp.set(k, v);
    }
    sp.delete('page');
    router.push(`/accounts?${sp.toString()}`);
  }

  const toggleMulti = (key: string, value: string) => {
    const current = getMulti(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next });
  };

  const hasActiveOpps = params.get('hasActiveOpps') === 'true';

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <form onSubmit={onSearch} className="relative w-full min-w-[260px] sm:w-80">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
        <Input
          placeholder="Buscar cuenta, dominio…"
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      <FilterPopover
        label="País"
        count={getMulti('country').length}
        options={countries.map((c) => ({ value: c, label: c }))}
        selected={getMulti('country')}
        onToggle={(v) => toggleMulti('country', v)}
      />
      <FilterPopover
        label="Segmento"
        count={getMulti('segment').length}
        options={Object.entries(SEGMENT_LABELS_EXTENDED).map(([v, l]) => ({ value: v, label: l }))}
        selected={getMulti('segment')}
        onToggle={(v) => toggleMulti('segment', v)}
      />
      <FilterPopover
        label="Status"
        count={getMulti('status').length}
        options={Object.entries(ACCOUNT_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        selected={getMulti('status')}
        onToggle={(v) => toggleMulti('status', v)}
      />
      <FilterPopover
        label="Tamaño"
        count={getMulti('size').length}
        options={Object.entries(COMPANY_SIZE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        selected={getMulti('size')}
        onToggle={(v) => toggleMulti('size', v)}
      />
      <FilterPopover
        label="Owner"
        count={getMulti('ownerId').length}
        options={users.map((u) => ({ value: u.id, label: u.name }))}
        selected={getMulti('ownerId')}
        onToggle={(v) => toggleMulti('ownerId', v)}
      />

      <Button
        size="sm"
        variant={hasActiveOpps ? 'default' : 'outline'}
        onClick={() => update({ hasActiveOpps: hasActiveOpps ? null : 'true' })}
      >
        Con oportunidades activas
      </Button>

      {(q || getMulti('country').length || getMulti('segment').length || hasActiveOpps) && (
        <Button variant="ghost" size="sm" onClick={() => { setQ(''); router.push('/accounts'); }}>
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}

function FilterPopover({
  label,
  count,
  options,
  selected,
  onToggle,
}: {
  label: string;
  count: number;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
          {count > 0 && <Badge className="ml-2">{count}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {options.length === 0 && (
            <div className="px-2 py-3 text-xs text-sysde-mid">Sin opciones</div>
          )}
          {options.map((opt) => (
            <Label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sysde-bg"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
              />
              <span className="text-sm text-sysde-gray">{opt.label}</span>
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
