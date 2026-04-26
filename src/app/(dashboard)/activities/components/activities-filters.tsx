'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import {
  ActivityTag,
  ActivityType,
} from '@prisma/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TAG_LABELS,
} from '@/lib/activities/labels';

const ALL_TYPES: ActivityType[] = [
  'CALL',
  'EMAIL_SENT',
  'EMAIL_RECEIVED',
  'WHATSAPP',
  'MEETING',
  'DEMO',
  'MATERIAL_SENT',
  'PROPOSAL_SENT',
  'INTERNAL_NOTE',
  'TASK',
  'LINKEDIN_MESSAGE',
  'EVENT_ATTENDED',
];

const ALL_TAGS: ActivityTag[] = [
  'BL',
  'INFO',
  'CONSUL',
  'SOLIC',
  'URGENT',
  'FOLLOWUP',
  'WIN_SIGNAL',
  'RISK_SIGNAL',
];

export function ActivitiesFilters({
  users,
}: {
  users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    if ((params.get('q') ?? '') !== debouncedQ) update({ q: debouncedQ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const getMulti = (key: string) => params.getAll(key);

  function update(next: Record<string, string | string[] | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      sp.delete(k);
      if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      if (Array.isArray(v)) v.forEach((val) => sp.append(k, val));
      else sp.set(k, v);
    }
    router.push(`/activities?${sp.toString()}`);
  }

  const toggleMulti = (key: string, value: string) => {
    const current = getMulti(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    update({ [key]: next });
  };

  const pendingNextAction = params.get('pendingNextAction') === 'true';
  const onlyMyMentions = params.get('onlyMyMentions') === 'true';
  const includeSystem = params.get('includeSystem') === 'true';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="relative min-w-[260px] flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en actividades…"
          className="pl-9"
        />
      </div>

      <FilterPopover
        label="Tipo"
        count={getMulti('type').length}
        options={ALL_TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] }))}
        selected={getMulti('type')}
        onToggle={(v) => toggleMulti('type', v)}
      />

      <FilterPopover
        label="Tags"
        count={getMulti('tags').length}
        options={ALL_TAGS.map((t) => ({ value: t, label: ACTIVITY_TAG_LABELS[t] }))}
        selected={getMulti('tags')}
        onToggle={(v) => toggleMulti('tags', v)}
      />

      <FilterPopover
        label="Creador"
        count={getMulti('createdById').length}
        options={users.map((u) => ({ value: u.id, label: u.name }))}
        selected={getMulti('createdById')}
        onToggle={(v) => toggleMulti('createdById', v)}
      />

      <Button
        size="sm"
        variant={pendingNextAction ? 'default' : 'outline'}
        onClick={() => update({ pendingNextAction: pendingNextAction ? null : 'true' })}
      >
        Acciones pendientes
      </Button>

      <Button
        size="sm"
        variant={onlyMyMentions ? 'default' : 'outline'}
        onClick={() => update({ onlyMyMentions: onlyMyMentions ? null : 'true' })}
      >
        Mis menciones
      </Button>

      <Button
        size="sm"
        variant={includeSystem ? 'default' : 'outline'}
        onClick={() => update({ includeSystem: includeSystem ? null : 'true' })}
      >
        Incluir sistema
      </Button>

      {(q || getMulti('type').length || getMulti('tags').length || pendingNextAction) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ('');
            router.push('/activities');
          }}
        >
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
          {options.map((opt) => (
            <Label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sysde-bg"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
