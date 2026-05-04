'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users, Sparkles, Filter, X, ArrowRight, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AudienceFilter {
  accountStatus?: string[];
  accountSegment?: string[];
  accountCountry?: string[];
  contactStatus?: string[];
  contactSeniority?: string[];
  hasEmail?: boolean;
  q?: string;
}

const ACCOUNT_STATUSES = [
  { key: 'PROSPECT', label: 'Prospecto' },
  { key: 'ACTIVE', label: 'Activo' },
  { key: 'CUSTOMER', label: 'Cliente' },
  { key: 'PARTNER', label: 'Partner' },
  { key: 'LOST', label: 'Perdido' },
  { key: 'INACTIVE', label: 'Inactivo' },
];

const ACCOUNT_SEGMENTS = [
  { key: 'BANK', label: 'Banco' },
  { key: 'FINANCE_COMPANY', label: 'Financiera' },
  { key: 'MICROFINANCE', label: 'Microfinanza' },
  { key: 'COOPERATIVE', label: 'Cooperativa' },
  { key: 'PENSION_FUND', label: 'AFP' },
  { key: 'INSURANCE', label: 'Seguros' },
  { key: 'FINTECH', label: 'Fintech' },
  { key: 'RETAIL', label: 'Retail' },
];

const SENIORITY_LEVELS = [
  { key: 'OWNER', label: 'Owner' },
  { key: 'C_LEVEL', label: 'C-level' },
  { key: 'VP', label: 'VP' },
  { key: 'DIRECTOR', label: 'Director' },
  { key: 'MANAGER', label: 'Manager' },
  { key: 'ANALYST', label: 'Analista' },
  { key: 'UNKNOWN', label: 'Sin info' },
];

const CONTACT_STATUSES = [
  { key: 'ACTIVE', label: 'Activo' },
  { key: 'NURTURE', label: 'Nurture' },
  { key: 'COLD', label: 'Frío' },
];

interface PreviewResult {
  count: number;
  sample: Array<{
    id: string;
    fullName: string;
    email: string;
    jobTitle: string | null;
    seniorityLevel: string;
    account: { id: string; name: string; status: string } | null;
  }>;
  byAccount: Array<{ accountId: string | null; _count: { _all: number } }>;
}

export function AudienceBuilder({
  campaignId,
  countries,
}: {
  campaignId: string;
  countries: string[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<AudienceFilter>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const fetchPreview = useCallback(
    async (f: AudienceFilter) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/audience`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'preview', filter: f }),
        });
        const json = (await res.json()) as PreviewResult & { ok?: boolean };
        if (json.ok) setPreview(json);
      } finally {
        setLoading(false);
      }
    },
    [campaignId]
  );

  // Debounced auto-preview when filters change
  useEffect(() => {
    const t = setTimeout(() => fetchPreview(filter), 300);
    return () => clearTimeout(t);
  }, [filter, fetchPreview]);

  function toggle(field: keyof AudienceFilter, value: string) {
    setFilter((prev) => {
      const arr = (prev[field] as string[] | undefined) ?? [];
      const next = arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
      return { ...prev, [field]: next.length ? next : undefined };
    });
  }

  function clearAll() {
    setFilter({});
  }

  async function enroll() {
    if (!preview || preview.count === 0) return;
    if (!confirm(`Inscribir ${preview.count} contactos en la campaña?`)) return;
    setEnrolling(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'enroll', filter }),
      });
      const json = (await res.json()) as { ok?: boolean; enrolled?: number; error?: string };
      if (!json.ok) {
        toast.error(json.error ?? 'Error al inscribir');
        return;
      }
      toast.success(`${json.enrolled} contactos inscritos`);
      router.refresh();
    } finally {
      setEnrolling(false);
    }
  }

  const hasFilters = Object.values(filter).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
      {/* Left: filtros */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-sysde-mid" />
            <h3 className="text-sm font-semibold text-sysde-gray">Audiencia objetivo</h3>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-[11px] text-sysde-mid hover:text-sysde-gray"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          )}
        </div>

        <div className="space-y-4">
          <FilterGroup
            label="Estado de cuenta"
            icon={Building2}
            options={ACCOUNT_STATUSES}
            selected={filter.accountStatus ?? []}
            onToggle={(v) => toggle('accountStatus', v)}
          />
          <FilterGroup
            label="Segmento"
            options={ACCOUNT_SEGMENTS}
            selected={filter.accountSegment ?? []}
            onToggle={(v) => toggle('accountSegment', v)}
          />
          {countries.length > 0 && (
            <FilterGroup
              label="País"
              options={countries.map((c) => ({ key: c, label: c }))}
              selected={filter.accountCountry ?? []}
              onToggle={(v) => toggle('accountCountry', v)}
            />
          )}
          <FilterGroup
            label="Seniority del contacto"
            options={SENIORITY_LEVELS}
            selected={filter.contactSeniority ?? []}
            onToggle={(v) => toggle('contactSeniority', v)}
          />
          <FilterGroup
            label="Estado del contacto"
            options={CONTACT_STATUSES}
            selected={filter.contactStatus ?? []}
            onToggle={(v) => toggle('contactStatus', v)}
          />
        </div>
      </Card>

      {/* Right: preview */}
      <div className="space-y-3 lg:sticky lg:top-20">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-sysde-mid" />
              <h3 className="text-sm font-semibold text-sysde-gray">Preview</h3>
            </div>
            {loading && <Loader2 className="h-3 w-3 animate-spin text-sysde-mid" />}
          </div>

          <div className="rounded-lg border border-sysde-border bg-gradient-to-br from-sysde-red/5 to-violet-500/5 p-4">
            <div className="text-3xl font-semibold tabular-nums text-sysde-gray">
              {(preview?.count ?? 0).toLocaleString('es-MX')}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-sysde-mid">
              Contactos coinciden
            </div>
          </div>

          <Button
            onClick={enroll}
            disabled={!preview || preview.count === 0 || enrolling}
            className="mt-3 w-full gap-1.5 bg-sysde-red hover:bg-sysde-red-dark"
          >
            {enrolling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {enrolling ? 'Inscribiendo…' : `Inscribir ${preview?.count ?? 0}`}
          </Button>

          {/* Sample rows */}
          {preview && preview.sample.length > 0 && (
            <div className="mt-4 border-t border-sysde-border pt-3">
              <div className="mb-2 text-[10px] uppercase tracking-wide text-sysde-mid">Muestra</div>
              <ul className="space-y-1.5">
                {preview.sample.map((c) => (
                  <li key={c.id} className="rounded-md border border-sysde-border bg-white p-2 text-xs">
                    <div className="font-medium text-sysde-gray">{c.fullName}</div>
                    <div className="text-[11px] text-sysde-mid">
                      {c.jobTitle ?? '—'}
                      {c.account && (
                        <>
                          <ArrowRight className="mx-1 inline h-2.5 w-2.5" />
                          {c.account.name}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  icon: Icon,
  options,
  selected,
  onToggle,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  options: Array<{ key: string; label: string }>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-sysde-mid">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
        {selected.length > 0 && <span className="text-sysde-red">· {selected.length}</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const sel = selected.includes(o.key);
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onToggle(o.key)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all',
                sel
                  ? 'border-sysde-red bg-sysde-red text-white'
                  : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
