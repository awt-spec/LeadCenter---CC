'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { campaignFormSchema, type CampaignFormValues } from '@/lib/campaigns/schemas';
import { createCampaign, updateCampaign } from '@/lib/campaigns/mutations';
import {
  CAMPAIGN_GOAL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
} from '@/lib/campaigns/labels';

const TYPES = Object.keys(CAMPAIGN_TYPE_LABELS) as Array<keyof typeof CAMPAIGN_TYPE_LABELS>;
const STATUSES = Object.keys(CAMPAIGN_STATUS_LABELS) as Array<keyof typeof CAMPAIGN_STATUS_LABELS>;
const GOALS = Object.keys(CAMPAIGN_GOAL_LABELS) as Array<keyof typeof CAMPAIGN_GOAL_LABELS>;

export function CampaignForm({
  initial,
  campaignId,
}: {
  initial?: Partial<CampaignFormValues>;
  campaignId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      description: initial?.description ?? '',
      type: initial?.type ?? 'MIXED',
      status: initial?.status ?? 'DRAFT',
      goal: initial?.goal ?? 'LEAD_GEN',
      targetSegment: initial?.targetSegment ?? null,
      targetCountry: initial?.targetCountry ?? '',
      startDate: initial?.startDate ?? '',
      endDate: initial?.endDate ?? '',
      budget: initial?.budget ?? null,
      spent: initial?.spent ?? null,
      currency: initial?.currency ?? 'USD',
      ownerId: initial?.ownerId ?? null,
    },
  });

  const type = watch('type');
  const status = watch('status');
  const goal = watch('goal');

  function onSubmit(values: CampaignFormValues) {
    startTransition(async () => {
      const result = campaignId
        ? await updateCampaign(campaignId, values)
        : await createCampaign(values);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(campaignId ? 'Campaña actualizada' : 'Campaña creada');
      const id =
        campaignId ??
        (result.ok && 'data' in result && result.data && 'id' in result.data
          ? result.data.id
          : '');
      router.push(`/campaigns/${id || ''}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold">Información general</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register('name')} placeholder="Outbound Q2 banca digital" />
            {errors.name && <p className="mt-1 text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="code">Código</Label>
            <Input id="code" {...register('code')} placeholder="OBQ2-2026" />
          </div>

          <div>
            <Label htmlFor="targetCountry">País objetivo</Label>
            <Input id="targetCountry" {...register('targetCountry')} placeholder="México, Costa Rica..." />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={3} {...register('description')} />
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold">Tipo, estado y objetivo</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setValue('type', v as CampaignFormValues['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CAMPAIGN_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Estado</Label>
            <Select
              value={status}
              onValueChange={(v) => setValue('status', v as CampaignFormValues['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {CAMPAIGN_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Objetivo</Label>
            <Select value={goal} onValueChange={(v) => setValue('goal', v as CampaignFormValues['goal'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {CAMPAIGN_GOAL_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-base font-semibold">Fechas y presupuesto</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="startDate">Inicio</Label>
            <Input id="startDate" type="date" {...register('startDate')} />
          </div>
          <div>
            <Label htmlFor="endDate">Fin</Label>
            <Input id="endDate" type="date" {...register('endDate')} />
          </div>
          <div>
            <Label htmlFor="budget">Presupuesto</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              {...register('budget', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="spent">Gastado</Label>
            <Input
              id="spent"
              type="number"
              step="0.01"
              {...register('spent', { setValueAs: (v) => (v === '' ? null : Number(v)) })}
              placeholder="0"
            />
          </div>
          <div>
            <Label htmlFor="currency">Moneda</Label>
            <Input id="currency" {...register('currency')} placeholder="USD" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : campaignId ? 'Guardar cambios' : 'Crear campaña'}
        </Button>
      </div>
    </form>
  );
}
