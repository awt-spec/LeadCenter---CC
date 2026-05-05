'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, Check, ChevronRight } from 'lucide-react';
import type { OpportunityStage } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StageBadge } from './stage-badge';
import { changeStage } from '@/lib/opportunities/mutations';
import { STAGE_LABELS, LOST_REASON_LABELS, STAGE_PROBABILITY } from '@/lib/shared/labels';
import {
  getStageRequirements,
  REQUIREMENT_LABELS,
  type StageRequirementField,
} from '@/lib/opportunities/stage-rules';
import { cn } from '@/lib/utils';
import type { LostReason } from '@prisma/client';

type OppSnapshot = {
  id: string;
  stage: OpportunityStage;
  estimatedValue: number | null;
  portfolioAmount: number | null;
  userCount: number | null;
  annualOperations: number | null;
  commercialModel: string;
  expectedCloseDate: Date | null;
  hasContacts: boolean;
};

type Props = {
  opportunity: OppSnapshot;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/// Pipeline progression — el camino "feliz" del prospecto al cierre.
/// Mostrado como stepper horizontal con chevrons, en orden de avance.
const FUNNEL_STAGES: OpportunityStage[] = [
  'LEAD',
  'DISCOVERY',
  'SIZING',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'HANDOFF',
  'WON',
];

/// Outcomes / pausas — fuera del flujo principal, mostrados como chips
/// separados con un divisor visual.
const OUTCOME_STAGES: OpportunityStage[] = ['LOST', 'STAND_BY', 'NURTURE'];

/// Etiquetas cortas para el stepper. Los % ya van como número grande arriba.
const STAGE_SHORT: Record<OpportunityStage, string> = {
  LEAD: 'Prospecto',
  DISCOVERY: 'Calificar',
  SIZING: 'Dimensionar',
  DEMO: 'Validar',
  PROPOSAL: 'Decidir',
  NEGOTIATION: 'Negociar',
  CLOSING: 'Firma',
  HANDOFF: 'Handoff',
  WON: 'Ganado',
  LOST: 'Perdido',
  STAND_BY: 'Stand-by',
  NURTURE: 'Nurture',
};

/// Sub-label opcional con el ángulo metodológico (Sandler/MEDDIC) para
/// que el rep tenga la pista de qué pedir en esa etapa.
const STAGE_HINT: Record<OpportunityStage, string> = {
  LEAD: 'Contacto iniciado',
  DISCOVERY: 'Dolor / Poder / Proceso',
  SIZING: 'Volumetría',
  DEMO: 'Visión de compra',
  PROPOSAL: 'Propuesta revisada',
  NEGOTIATION: 'Aprobación verbal',
  CLOSING: 'Firma / OC',
  HANDOFF: 'Customer Success',
  WON: 'Cliente activo',
  LOST: '',
  STAND_BY: 'Pausa',
  NURTURE: 'Nurture pasivo',
};

const STAGES: OpportunityStage[] = [...FUNNEL_STAGES, ...OUTCOME_STAGES];

export function StageChangeDialog({ opportunity, open, onOpenChange }: Props) {
  const router = useRouter();
  const [toStage, setToStage] = useState<OpportunityStage>(opportunity.stage);
  const [notes, setNotes] = useState('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostReasonDetail, setLostReasonDetail] = useState('');
  const [competitorWon, setCompetitorWon] = useState('');
  const [wonReason, setWonReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requirements = getStageRequirements(toStage);
  const missingReqs = requirements.filter((r) => !hasRequirement(r, opportunity));

  async function handleSubmit() {
    if (toStage === 'LOST' && !lostReason) {
      toast.error('Indica la razón de pérdida');
      return;
    }
    setSubmitting(true);
    const res = await changeStage(opportunity.id, {
      toStage,
      notes: notes || null,
      lostReason: lostReason || undefined,
      lostReasonDetail: toStage === 'LOST' ? lostReasonDetail || null : null,
      competitorWon: toStage === 'LOST' ? competitorWon || null : null,
      wonReason: toStage === 'WON' ? wonReason || null : null,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Fase actualizada');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cambiar fase de oportunidad</DialogTitle>
          <DialogDescription>
            Fase actual:{' '}
            <StageBadge stage={opportunity.stage} size="sm" className="ml-1" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-3 block text-xs uppercase tracking-wide text-sysde-mid">
              Avanzar el deal
            </Label>
            {/* Funnel stepper — horizontal flow con probabilidad arriba,
                etiqueta corta + hint debajo. El stage actual es rojo SYSDE
                lleno, los pasados quedan con check verde, los futuros gris. */}
            <div className="relative -mx-1 flex flex-wrap items-stretch gap-y-2 overflow-x-auto rounded-xl border border-sysde-border bg-gradient-to-b from-sysde-light/30 to-white p-3">
              {FUNNEL_STAGES.map((s, idx) => {
                const stageIdx = FUNNEL_STAGES.indexOf(opportunity.stage as OpportunityStage);
                const isCurrent = toStage === s;
                const isPassed = stageIdx >= 0 && idx < stageIdx;
                const isOriginal = opportunity.stage === s;
                const prob = STAGE_PROBABILITY[s];
                return (
                  <div key={s} className="flex shrink-0 items-stretch">
                    <button
                      type="button"
                      onClick={() => setToStage(s)}
                      className={cn(
                        'group relative flex min-w-[112px] flex-col items-center gap-0.5 rounded-lg border-2 px-3 py-2 transition-all',
                        isCurrent
                          ? 'scale-[1.04] border-sysde-red bg-sysde-red text-white shadow-md shadow-sysde-red/20'
                          : isPassed
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500'
                            : isOriginal
                              ? 'border-sysde-red bg-white text-sysde-gray ring-1 ring-sysde-red/30'
                              : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40 hover:bg-sysde-light/40'
                      )}
                    >
                      <div className="flex items-baseline gap-1">
                        {prob > 0 ? (
                          <>
                            <span className={cn('font-display text-xl font-bold leading-none', isCurrent && 'text-white')}>
                              {prob}
                            </span>
                            <span className={cn('text-[10px] font-semibold opacity-75', isCurrent && 'text-white')}>%</span>
                          </>
                        ) : (
                          <Check className={cn('h-5 w-5', isCurrent ? 'text-white' : 'text-emerald-600')} />
                        )}
                      </div>
                      <div className={cn('text-[11px] font-semibold uppercase tracking-wide', isCurrent ? 'text-white' : 'text-sysde-gray')}>
                        {STAGE_SHORT[s]}
                      </div>
                      {STAGE_HINT[s] && (
                        <div className={cn('text-[10px] leading-tight text-center', isCurrent ? 'text-white/85' : 'text-sysde-mid')}>
                          {STAGE_HINT[s]}
                        </div>
                      )}
                      {isPassed && (
                        <div className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-[8px] font-bold text-white">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                    {idx < FUNNEL_STAGES.length - 1 && (
                      <div className="flex items-center px-0.5 text-sysde-mid/40">
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-sysde-border" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sysde-mid">
              o marcar como
            </span>
            <span className="h-px flex-1 bg-sysde-border" />
          </div>

          <div className="flex flex-wrap gap-2">
            {OUTCOME_STAGES.map((s) => {
              const isCurrent = toStage === s;
              const variant: Record<OpportunityStage, string> = {
                LOST: 'border-red-300 bg-red-50 text-red-900 hover:border-red-500',
                STAND_BY: 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500',
                NURTURE: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500',
              } as never;
              const activeVariant: Record<OpportunityStage, string> = {
                LOST: 'border-red-500 bg-red-500 text-white',
                STAND_BY: 'border-amber-500 bg-amber-500 text-white',
                NURTURE: 'border-emerald-500 bg-emerald-500 text-white',
              } as never;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setToStage(s)}
                  className={cn(
                    'inline-flex flex-col items-start rounded-lg border-2 px-4 py-2 text-left transition',
                    isCurrent ? activeVariant[s] : variant[s]
                  )}
                >
                  <span className="text-sm font-semibold uppercase tracking-wide">{STAGE_SHORT[s]}</span>
                  {STAGE_HINT[s] && <span className={cn('text-[10px]', isCurrent ? 'text-white/80' : 'opacity-75')}>{STAGE_HINT[s]}</span>}
                </button>
              );
            })}
          </div>

          {missingReqs.length > 0 && toStage !== 'LOST' && toStage !== 'WON' && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-amber-50 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <div className="font-medium text-sysde-gray">
                  Campos recomendados para {STAGE_LABELS[toStage]}
                </div>
                <ul className="mt-1 list-inside list-disc text-xs text-sysde-mid">
                  {missingReqs.map((r) => (
                    <li key={r}>{REQUIREMENT_LABELS[r]}</li>
                  ))}
                </ul>
                <div className="mt-1 text-xs text-sysde-mid">
                  Puedes avanzar igual pero se recomienda completar estos campos antes.
                </div>
              </div>
            </div>
          )}

          {toStage === 'WON' && (
            <div className="space-y-2">
              <Label>Razón de ganancia</Label>
              <Textarea
                rows={2}
                placeholder="¿Qué permitió cerrar? (mejor propuesta técnica, relación con sponsor, timing…)"
                value={wonReason}
                onChange={(e) => setWonReason(e.target.value)}
              />
            </div>
          )}

          {toStage === 'LOST' && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Razón de pérdida *</Label>
                <Select value={lostReason || undefined} onValueChange={(v) => setLostReason(v as LostReason)}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOST_REASON_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Detalle</Label>
                <Textarea
                  rows={2}
                  value={lostReasonDetail}
                  onChange={(e) => setLostReasonDetail(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Competidor que ganó (opcional)</Label>
                <Input value={competitorWon} onChange={(e) => setCompetitorWon(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>Nota del cambio</Label>
            <Textarea
              rows={2}
              placeholder="Contexto del cambio, próximos pasos…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || toStage === opportunity.stage}>
            {submitting ? 'Guardando…' : 'Cambiar fase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function hasRequirement(field: StageRequirementField, o: OppSnapshot): boolean {
  switch (field) {
    case 'portfolioAmount': return o.portfolioAmount !== null;
    case 'userCount': return o.userCount !== null;
    case 'annualOperations': return o.annualOperations !== null;
    case 'contactRoles': return o.hasContacts;
    case 'estimatedValue': return o.estimatedValue !== null;
    case 'commercialModel': return o.commercialModel !== 'UNDEFINED';
    case 'expectedCloseDate': return o.expectedCloseDate !== null;
  }
}
