'use client';

import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePipelineFilters } from '@/lib/pipeline/use-pipeline-filters';
import {
  PRODUCT_LABELS,
  RATING_LABELS,
  SEGMENT_LABELS_EXTENDED,
  COMMERCIAL_MODEL_LABELS,
  STAGE_LABELS,
} from '@/lib/shared/labels';
import { getInitials } from '@/lib/utils';

type UserLite = { id: string; name: string; email: string; avatarUrl: string | null };

const MAX_VALUE_CAP = 2_000_000;

export function PipelineFilters({
  countries,
  users,
}: {
  countries: string[];
  users: UserLite[];
}) {
  const { filters, update, toggleArray, clear, activeCount } = usePipelineFilters();

  const [q, setQ] = useState(filters.q ?? '');
  const [debouncedQ, setDebouncedQ] = useState(q);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    if ((filters.q ?? '') !== debouncedQ) {
      update({ q: debouncedQ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="sticky top-14 z-20 -mx-8 border-b border-sysde-border bg-white px-8 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sysde-mid" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, cuenta, código…"
            className="pl-9"
          />
        </div>

        <MultiFilter
          label="Producto"
          count={filters.product?.length ?? 0}
          options={Object.entries(PRODUCT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
          selected={filters.product ?? []}
          onToggle={(v) => toggleArray('product', v)}
        />

        <MultiFilter
          label="Owner"
          count={filters.ownerId?.length ?? 0}
          options={users.map((u) => ({ value: u.id, label: u.name, avatar: u }))}
          selected={filters.ownerId ?? []}
          onToggle={(v) => toggleArray('ownerId', v)}
          renderOption={(opt) => (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                {opt.avatar?.avatarUrl ? (
                  <AvatarImage src={opt.avatar.avatarUrl} alt={opt.label} />
                ) : null}
                <AvatarFallback className="text-[9px]">{getInitials(opt.label)}</AvatarFallback>
              </Avatar>
              <span className="text-sm">{opt.label}</span>
            </div>
          )}
        />

        <MultiFilter
          label="Rating"
          count={filters.rating?.length ?? 0}
          options={Object.entries(RATING_LABELS).map(([v, r]) => ({
            value: v,
            label: r.label,
            color: r.color,
          }))}
          selected={filters.rating ?? []}
          onToggle={(v) => toggleArray('rating', v)}
          renderOption={(opt) => (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-5 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: opt.color ?? '#94A3B8' }}
              >
                {opt.label}
              </span>
            </div>
          )}
        />

        <Button
          size="sm"
          variant={filters.onlyMine ? 'default' : 'outline'}
          onClick={() => update({ onlyMine: !filters.onlyMine })}
        >
          Solo mías
        </Button>

        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal className="mr-1.5 h-4 w-4" />
          Más filtros
          {activeCount > 0 && <Badge className="ml-2">{activeCount}</Badge>}
        </Button>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <X className="mr-1 h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      <ActiveChips />

      <AdvancedFiltersSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        countries={countries}
      />
    </div>
  );
}

type OptionType = { value: string; label: string; color?: string; avatar?: UserLite };

function MultiFilter({
  label,
  count,
  options,
  selected,
  onToggle,
  renderOption,
}: {
  label: string;
  count: number;
  options: OptionType[];
  selected: string[];
  onToggle: (value: string) => void;
  renderOption?: (opt: OptionType) => React.ReactNode;
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
              {renderOption ? renderOption(opt) : <span className="text-sm">{opt.label}</span>}
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ActiveChips() {
  const { filters, update, toggleArray, clear } = usePipelineFilters();

  type Chip = { key: string; label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (filters.q) chips.push({ key: 'q', label: `"${filters.q}"`, onRemove: () => update({ q: null }) });
  for (const v of filters.product ?? [])
    chips.push({ key: `product-${v}`, label: PRODUCT_LABELS[v as keyof typeof PRODUCT_LABELS] ?? v, onRemove: () => toggleArray('product', v) });
  for (const v of filters.rating ?? [])
    chips.push({ key: `rating-${v}`, label: `Rating ${RATING_LABELS[v as keyof typeof RATING_LABELS]?.label ?? v}`, onRemove: () => toggleArray('rating', v) });
  for (const v of filters.country ?? [])
    chips.push({ key: `country-${v}`, label: v, onRemove: () => toggleArray('country', v) });
  for (const v of filters.segment ?? [])
    chips.push({ key: `segment-${v}`, label: SEGMENT_LABELS_EXTENDED[v as keyof typeof SEGMENT_LABELS_EXTENDED] ?? v, onRemove: () => toggleArray('segment', v) });
  if (filters.onlyMine) chips.push({ key: 'mine', label: 'Solo mías', onRemove: () => update({ onlyMine: null }) });
  if (filters.overdueNextAction)
    chips.push({ key: 'overdue', label: 'Próxima acción vencida', onRemove: () => update({ overdueNextAction: null }) });
  if (filters.stale7d)
    chips.push({ key: 'stale', label: 'Sin actividad +7d', onRemove: () => update({ stale7d: null }) });
  if (filters.includeWon) chips.push({ key: 'won', label: `Incluir ${STAGE_LABELS.WON}`, onRemove: () => update({ includeWon: null }) });
  if (filters.includeLost) chips.push({ key: 'lost', label: `Incluir ${STAGE_LABELS.LOST}`, onRemove: () => update({ includeLost: null }) });
  if (filters.includeStandBy) chips.push({ key: 'sb', label: `Incluir ${STAGE_LABELS.STAND_BY}`, onRemove: () => update({ includeStandBy: null }) });
  if (filters.includeNurture) chips.push({ key: 'nur', label: `Incluir ${STAGE_LABELS.NURTURE}`, onRemove: () => update({ includeNurture: null }) });

  if (chips.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          type="button"
          key={c.key}
          onClick={c.onRemove}
          className="group inline-flex items-center gap-1 rounded-md border border-sysde-border bg-white px-2.5 py-1 text-xs text-sysde-gray transition-colors hover:border-sysde-red hover:text-sysde-red"
        >
          {c.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={clear}
        className="text-xs text-sysde-mid hover:text-sysde-red"
      >
        Limpiar todo
      </button>
    </div>
  );
}

function AdvancedFiltersSheet({
  open,
  onOpenChange,
  countries,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  countries: string[];
}) {
  const { filters, update, toggleArray, clear } = usePipelineFilters();

  const [valueRange, setValueRange] = useState<[number, number]>([
    filters.minValue ?? 0,
    filters.maxValue ?? MAX_VALUE_CAP,
  ]);

  useEffect(() => {
    setValueRange([filters.minValue ?? 0, filters.maxValue ?? MAX_VALUE_CAP]);
  }, [filters.minValue, filters.maxValue]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filtros avanzados</SheetTitle>
          <SheetDescription>Afina la vista del pipeline.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          <div>
            <Label className="mb-2 block">País</Label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-sysde-border p-2">
              {countries.length === 0 && (
                <div className="text-xs text-sysde-mid">Sin datos</div>
              )}
              {countries.map((c) => (
                <Label
                  key={c}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-sysde-bg"
                >
                  <Checkbox
                    checked={filters.country?.includes(c) ?? false}
                    onCheckedChange={() => toggleArray('country', c)}
                  />
                  <span className="text-sm">{c}</span>
                </Label>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Segmento</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SEGMENT_LABELS_EXTENDED).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleArray('segment', v)}
                  className={
                    filters.segment?.includes(v)
                      ? 'rounded-md border border-sysde-red bg-sysde-red-light px-2.5 py-1 text-xs text-sysde-red'
                      : 'rounded-md border border-sysde-border bg-white px-2.5 py-1 text-xs text-sysde-gray hover:border-sysde-red/30'
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Modelo comercial</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COMMERCIAL_MODEL_LABELS).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleArray('commercialModel', v)}
                  className={
                    filters.commercialModel?.includes(v)
                      ? 'rounded-md border border-sysde-red bg-sysde-red-light px-2.5 py-1 text-xs text-sysde-red'
                      : 'rounded-md border border-sysde-border bg-white px-2.5 py-1 text-xs text-sysde-gray hover:border-sysde-red/30'
                  }
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <Label>Rango de valor (USD)</Label>
              <span className="text-xs text-sysde-mid">
                ${valueRange[0].toLocaleString('en-US')} – $
                {valueRange[1].toLocaleString('en-US')}
              </span>
            </div>
            <Slider
              min={0}
              max={MAX_VALUE_CAP}
              step={10_000}
              value={valueRange}
              onValueChange={(v) => setValueRange(v as [number, number])}
              onValueCommit={(v) => {
                const [mn, mx] = v as [number, number];
                update({
                  minValue: mn > 0 ? mn : null,
                  maxValue: mx < MAX_VALUE_CAP ? mx : null,
                });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs">Cierre desde</Label>
              <Input
                type="date"
                value={filters.closeFrom ?? ''}
                onChange={(e) => update({ closeFrom: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Cierre hasta</Label>
              <Input
                type="date"
                value={filters.closeTo ?? ''}
                onChange={(e) => update({ closeTo: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Creada desde</Label>
              <Input
                type="date"
                value={filters.createdFrom ?? ''}
                onChange={(e) => update({ createdFrom: e.target.value || null })}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Creada hasta</Label>
              <Input
                type="date"
                value={filters.createdTo ?? ''}
                onChange={(e) => update({ createdTo: e.target.value || null })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="block">Alertas</Label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.overdueNextAction ?? false}
                onCheckedChange={(v) => update({ overdueNextAction: !!v })}
              />
              <span className="text-sm">Solo con próxima acción vencida</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.stale7d ?? false}
                onCheckedChange={(v) => update({ stale7d: !!v })}
              />
              <span className="text-sm">Sin actividad +7 días</span>
            </label>
          </div>

          <div className="space-y-2">
            <Label className="block">Incluir fases inactivas</Label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.includeWon ?? false}
                onCheckedChange={(v) => update({ includeWon: !!v })}
              />
              <span className="text-sm">Ganadas</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.includeLost ?? false}
                onCheckedChange={(v) => update({ includeLost: !!v })}
              />
              <span className="text-sm">Perdidas</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.includeStandBy ?? false}
                onCheckedChange={(v) => update({ includeStandBy: !!v })}
              />
              <span className="text-sm">Stand-by</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.includeNurture ?? false}
                onCheckedChange={(v) => update({ includeNurture: !!v })}
              />
              <span className="text-sm">Nurture pasivo</span>
            </label>
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              clear();
            }}
          >
            Limpiar todo
          </Button>
          <Button onClick={() => onOpenChange(false)}>Aplicar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
