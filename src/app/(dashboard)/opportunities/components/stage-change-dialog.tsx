'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
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
import { STAGE_LABELS, LOST_REASON_LABELS } from '@/lib/shared/labels';
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

const STAGES: OpportunityStage[] = [
  'LEAD',
  'DISCOVERY',
  'SIZING',
  'DEMO',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'HANDOFF',
  'WON',
  'LOST',
  'STAND_BY',
  'NURTURE',
];

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cambiar fase de oportunidad</DialogTitle>
          <DialogDescription>
            Fase actual:{' '}
            <StageBadge stage={opportunity.stage} size="sm" className="ml-1" />
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Nueva fase</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setToStage(s)}
                  className={cn(
                    'rounded-lg border p-2 text-left text-sm transition-colors',
                    toStage === s
                      ? 'border-sysde-red bg-sysde-red-light'
                      : 'border-sysde-border bg-white hover:border-sysde-red/40'
                  )}
                >
                  <StageBadge stage={s} size="sm" />
                  <div className="mt-1 text-xs text-sysde-mid">{STAGE_LABELS[s]}</div>
                </button>
              ))}
            </div>
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
