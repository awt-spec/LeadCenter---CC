'use client';

import { useState } from 'react';
import type { LostReason, OpportunityStage } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LOST_REASON_LABELS, STAGE_LABELS } from '@/lib/shared/labels';
import type { KanbanStageChangeInput } from '@/lib/pipeline/mutations';

type CriticalStage = 'WON' | 'LOST' | 'STAND_BY' | 'NURTURE';

export type ConfirmPayload = Omit<KanbanStageChangeInput, 'opportunityId'>;

type Props = {
  open: boolean;
  toStage: CriticalStage;
  opportunityName: string;
  currentValue: number | null;
  currency: string;
  onConfirm: (payload: ConfirmPayload) => Promise<void>;
  onCancel: () => void;
};

export function StageChangeConfirm({
  open,
  toStage,
  opportunityName,
  currentValue,
  currency,
  onConfirm,
  onCancel,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  // WON
  const [closedValue, setClosedValue] = useState<string>(currentValue?.toString() ?? '');
  const [closedDate, setClosedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [wonReason, setWonReason] = useState('');

  // LOST
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [lostReasonDetail, setLostReasonDetail] = useState('');
  const [competitorWon, setCompetitorWon] = useState('');

  // STAND_BY / NURTURE
  const [standbyReason, setStandbyReason] = useState('');
  const [expectedRestartAt, setExpectedRestartAt] = useState('');

  async function handleConfirm() {
    if (toStage === 'LOST' && !lostReason) return;

    setSubmitting(true);
    const payload: ConfirmPayload = { toStage: toStage as OpportunityStage };

    if (toStage === 'WON') {
      const val = Number(closedValue);
      if (Number.isFinite(val) && val > 0) payload.closedValue = val;
      if (closedDate) payload.closedAt = new Date(closedDate);
      if (wonReason) payload.wonReason = wonReason;
    }
    if (toStage === 'LOST') {
      payload.lostReason = lostReason as LostReason;
      if (lostReasonDetail) payload.lostReasonDetail = lostReasonDetail;
      if (competitorWon) payload.competitorWon = competitorWon;
    }
    if (toStage === 'STAND_BY' || toStage === 'NURTURE') {
      if (standbyReason) payload.standbyReason = standbyReason;
      if (expectedRestartAt) payload.expectedRestartAt = new Date(expectedRestartAt);
    }

    try {
      await onConfirm(payload);
    } finally {
      setSubmitting(false);
    }
  }

  const title = {
    WON: 'Marcar como Ganada',
    LOST: 'Marcar como Perdida',
    STAND_BY: 'Mover a Stand-by',
    NURTURE: 'Mover a Nurture pasivo',
  }[toStage];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !submitting) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {opportunityName} · pasará a fase <strong>{STAGE_LABELS[toStage]}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {toStage === 'WON' && (
            <>
              <div className="space-y-2">
                <Label>Valor final de cierre</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={closedValue}
                    onChange={(e) => setClosedValue(e.target.value)}
                  />
                  <span className="text-sm text-sysde-mid">{currency}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fecha de cierre</Label>
                <Input
                  type="date"
                  value={closedDate}
                  onChange={(e) => setClosedDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Razón de ganancia</Label>
                <Textarea
                  rows={3}
                  placeholder="¿Qué hizo que ganaras este deal?"
                  value={wonReason}
                  onChange={(e) => setWonReason(e.target.value)}
                />
              </div>
            </>
          )}

          {toStage === 'LOST' && (
            <>
              <div className="space-y-2">
                <Label>
                  Razón de pérdida <span className="text-danger">*</span>
                </Label>
                <Select value={lostReason || undefined} onValueChange={(v) => setLostReason(v as LostReason)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una razón" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOST_REASON_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Competidor que ganó</Label>
                <Input
                  placeholder="Nombre del competidor (opcional)"
                  value={competitorWon}
                  onChange={(e) => setCompetitorWon(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Detalle</Label>
                <Textarea
                  rows={3}
                  placeholder="Contexto adicional de la pérdida"
                  value={lostReasonDetail}
                  onChange={(e) => setLostReasonDetail(e.target.value)}
                />
              </div>
            </>
          )}

          {(toStage === 'STAND_BY' || toStage === 'NURTURE') && (
            <>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea
                  rows={3}
                  placeholder={
                    toStage === 'STAND_BY'
                      ? '¿Por qué se pausa activamente? (reorganización interna, timing, etc.)'
                      : '¿Por qué entra a nurture pasivo? (prospección de largo plazo)'
                  }
                  value={standbyReason}
                  onChange={(e) => setStandbyReason(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha estimada para retomar</Label>
                <Input
                  type="date"
                  value={expectedRestartAt}
                  onChange={(e) => setExpectedRestartAt(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || (toStage === 'LOST' && !lostReason)}
            variant={toStage === 'LOST' ? 'destructive' : 'default'}
          >
            {submitting ? 'Guardando…' : title}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
