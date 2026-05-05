'use client';

import { useState, useTransition } from 'react';
import { Save, Loader2, Target, ListChecks, AlertTriangle, Compass } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { saveCocStrategy } from '@/lib/coc/mutations';

interface Initial {
  headline: string | null;
  strategy: string | null;
  goals: string | null;
  risks: string | null;
  nextSteps: string | null;
}

export function CocStrategyForm({ accountId, initial }: { accountId: string; initial: Initial }) {
  const [headline, setHeadline] = useState(initial.headline ?? '');
  const [strategy, setStrategy] = useState(initial.strategy ?? '');
  const [goals, setGoals] = useState(initial.goals ?? '');
  const [risks, setRisks] = useState(initial.risks ?? '');
  const [nextSteps, setNextSteps] = useState(initial.nextSteps ?? '');
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  function onSave() {
    start(async () => {
      const res = await saveCocStrategy({
        accountId,
        headline: headline.trim() || null,
        strategy: strategy.trim() || null,
        goals: goals.trim() || null,
        risks: risks.trim() || null,
        nextSteps: nextSteps.trim() || null,
      });
      if (res.ok) {
        toast.success('Estrategia guardada');
        setDirty(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Estrategia compartida</CardTitle>
        <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
          {pending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {dirty ? 'Guardar' : 'Sin cambios'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Título / encabezado" hint="Una línea que sintetiza el play. Ej. «Migración SAF+ 2026 en BCP — entrar por Riesgos»">
          <Input
            placeholder="Ej. Estrategia 2026 para BCP"
            value={headline}
            onChange={(e) => markDirty(setHeadline)(e.target.value)}
            maxLength={200}
          />
        </Field>

        <Field icon={Compass} label="Estrategia" hint="Cómo vamos a ganar esta cuenta. Hipótesis, palancas, players internos del prospect que necesitamos.">
          <Textarea
            rows={5}
            placeholder="Entramos por Riesgos con un POC de 90 días sobre 1 sucursal. Aliado interno: CRO. Decisor final: COO. Palanca: la directiva regulatoria de Mar 2026."
            value={strategy}
            onChange={(e) => markDirty(setStrategy)(e.target.value)}
            maxLength={10000}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field icon={Target} label="Objetivos / KPIs">
            <Textarea
              rows={4}
              placeholder="• Cerrar POC firmado antes del 30 jun&#10;• Demo a comité: 3 directores + CFO&#10;• ARR objetivo USD 250k"
              value={goals}
              onChange={(e) => markDirty(setGoals)(e.target.value)}
              maxLength={10000}
            />
          </Field>
          <Field icon={AlertTriangle} label="Riesgos">
            <Textarea
              rows={4}
              placeholder="• Compite con incumbente local con 12 años en la cuenta&#10;• CIO en transición — no tomará decisiones técnicas hasta Q3&#10;• Restricción presupuestal hasta cierre fiscal"
              value={risks}
              onChange={(e) => markDirty(setRisks)(e.target.value)}
              maxLength={10000}
            />
          </Field>
        </div>

        <Field icon={ListChecks} label="Próximos pasos">
          <Textarea
            rows={4}
            placeholder="1) Enviar propuesta revisada (Alberto, vie 9)&#10;2) Coordinar demo técnica con TI (Eze, sem 20)&#10;3) Validar pricing con CFO interno antes de la 2da reunión"
            value={nextSteps}
            onChange={(e) => markDirty(setNextSteps)(e.target.value)}
            maxLength={10000}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sysde-mid">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      {hint && <p className="mb-1.5 text-[11px] text-sysde-mid">{hint}</p>}
      {children}
    </div>
  );
}
