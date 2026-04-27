'use client';

import { useState, useTransition } from 'react';
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
  CONTACT_STATUS_LABELS,
  CONTACT_SOURCE_LABELS,
  SEGMENT_LABELS,
  PRODUCT_INTEREST_LABELS,
} from '@/lib/constants';

type Option = { value: string; label: string; color?: string };

type UserLite = { id: string; name: string; email: string };
type TagLite = { id: string; name: string; color: string };

type Props = {
  countries: string[];
  users: UserLite[];
  tags: TagLite[];
};

const STATUS_OPTIONS: Option[] = Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => ({
  value: v,
  label: l,
}));
const SOURCE_OPTIONS: Option[] = Object.entries(CONTACT_SOURCE_LABELS).map(([v, l]) => ({
  value: v,
  label: l,
}));
const SEGMENT_OPTIONS: Option[] = Object.entries(SEGMENT_LABELS).map(([v, l]) => ({
  value: v,
  label: l,
}));
const PRODUCT_OPTIONS: Option[] = Object.entries(PRODUCT_INTEREST_LABELS).map(
  ([v, l]) => ({ value: v, label: l })
);

export function ContactsFilters({ countries, users, tags }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
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
    startTransition(() => router.push(`/contacts?${sp.toString()}`));
  }

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update({ q });
  };

  const toggleMulti = (key: string, value: string) => {
    const current = getMulti(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ [key]: next });
  };

  const activeFilters = [
    ...getMulti('country').map((v) => ({ key: 'country', label: v, value: v })),
    ...getMulti('status').map((v) => ({
      key: 'status',
      label: CONTACT_STATUS_LABELS[v] ?? v,
      value: v,
    })),
    ...getMulti('source').map((v) => ({
      key: 'source',
      label: CONTACT_SOURCE_LABELS[v] ?? v,
      value: v,
    })),
    ...getMulti('ownerId').map((v) => ({
      key: 'ownerId',
      label: users.find((u) => u.id === v)?.name ?? v,
      value: v,
    })),
    ...getMulti('marketSegment').map((v) => ({
      key: 'marketSegment',
      label: SEGMENT_LABELS[v] ?? v,
      value: v,
    })),
    ...getMulti('productInterest').map((v) => ({
      key: 'productInterest',
      label: PRODUCT_INTEREST_LABELS[v] ?? v,
      value: v,
    })),
    ...getMulti('tagIds').map((v) => ({
      key: 'tagIds',
      label: tags.find((t) => t.id === v)?.name ?? v,
      value: v,
    })),
  ];

  const hasAnyFilter = activeFilters.length > 0 || !!params.get('q');

  return (
    <div className="sticky top-14 z-10 -mx-8 mb-6 border-b border-sysde-border bg-white px-8 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={onSearchSubmit} className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, email, empresa…"
            className="pl-9"
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
          label="Status"
          count={getMulti('status').length}
          options={STATUS_OPTIONS}
          selected={getMulti('status')}
          onToggle={(v) => toggleMulti('status', v)}
        />
        <FilterPopover
          label="Source"
          count={getMulti('source').length}
          options={SOURCE_OPTIONS}
          selected={getMulti('source')}
          onToggle={(v) => toggleMulti('source', v)}
        />
        <FilterPopover
          label="Owner"
          count={getMulti('ownerId').length}
          options={users.map((u) => ({ value: u.id, label: u.name }))}
          selected={getMulti('ownerId')}
          onToggle={(v) => toggleMulti('ownerId', v)}
        />
        <FilterPopover
          label="Segmento"
          count={getMulti('marketSegment').length}
          options={SEGMENT_OPTIONS}
          selected={getMulti('marketSegment')}
          onToggle={(v) => toggleMulti('marketSegment', v)}
        />
        <FilterPopover
          label="Producto"
          count={getMulti('productInterest').length}
          options={PRODUCT_OPTIONS}
          selected={getMulti('productInterest')}
          onToggle={(v) => toggleMulti('productInterest', v)}
        />
        <FilterPopover
          label="Tags"
          count={getMulti('tagIds').length}
          options={tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
          selected={getMulti('tagIds')}
          onToggle={(v) => toggleMulti('tagIds', v)}
        />

        {hasAnyFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              router.push('/contacts');
            }}
          >
            <X className="mr-1.5 h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeFilters.map((f) => (
            <button
              key={`${f.key}-${f.value}`}
              type="button"
              onClick={() => toggleMulti(f.key, f.value)}
              className="group inline-flex items-center gap-1 rounded-md border border-sysde-border bg-white px-2.5 py-1 text-xs text-sysde-gray transition-colors hover:border-sysde-red hover:text-sysde-red"
            >
              <span className="text-sysde-mid">{f.key}:</span>
              {f.label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
        </div>
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
  options: Option[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {label}
          {count > 0 && (
            <Badge variant="default" className="ml-2">
              {count}
            </Badge>
          )}
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
              {opt.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span className="text-sm text-sysde-gray">{opt.label}</span>
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
