'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  opportunityFormSchema,
  type OpportunityFormValues,
} from '@/lib/opportunities/schemas';
import {
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from '@/lib/opportunities/mutations';
import {
  PRODUCT_LABELS,
  SUB_PRODUCT_LABELS,
  SUB_PRODUCTS_BY_PRODUCT,
  STAGE_LABELS,
  STATUS_LABELS,
  RATING_LABELS,
  COMMERCIAL_MODEL_LABELS,
} from '@/lib/shared/labels';
import { CONTACT_SOURCE_LABELS } from '@/lib/constants';
import type { SysdeProduct } from '@prisma/client';

type UserLite = { id: string; name: string };
type AccountLite = { id: string; name: string; country: string | null };
type ContactLite = { id: string; fullName: string };

type Props = {
  mode: 'create' | 'edit';
  opportunityId?: string;
  defaults?: Partial<OpportunityFormValues>;
  users: UserLite[];
  accounts: AccountLite[];
  contacts: ContactLite[];
  canDelete?: boolean;
};

const NONE = '__none__';

export function OpportunityForm({
  mode,
  opportunityId,
  defaults,
  users,
  accounts,
  contacts,
  canDelete,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunityFormSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      code: defaults?.code ?? '',
      accountId: defaults?.accountId ?? '',
      product: defaults?.product ?? 'SAF_PLUS',
      subProduct: defaults?.subProduct ?? null,
      stage: defaults?.stage ?? 'LEAD',
      status: defaults?.status ?? 'OPEN',
      rating: defaults?.rating ?? 'UNSCORED',
      probability: defaults?.probability ?? 10,
      estimatedValue: defaults?.estimatedValue ?? null,
      currency: defaults?.currency ?? 'USD',
      commercialModel: defaults?.commercialModel ?? 'UNDEFINED',
      portfolioAmount: defaults?.portfolioAmount ?? null,
      userCount: defaults?.userCount ?? null,
      annualOperations: defaults?.annualOperations ?? null,
      clientCount: defaults?.clientCount ?? null,
      officeCount: defaults?.officeCount ?? null,
      expectedCloseDate: defaults?.expectedCloseDate ?? null,
      nextActionDate: defaults?.nextActionDate ?? null,
      nextActionNote: defaults?.nextActionNote ?? '',
      source: defaults?.source ?? 'UNKNOWN',
      sourceDetail: defaults?.sourceDetail ?? '',
      isDirectProspecting: defaults?.isDirectProspecting ?? false,
      referredById: defaults?.referredById ?? null,
      ownerId: defaults?.ownerId ?? null,
      description: defaults?.description ?? '',
      internalNotes: defaults?.internalNotes ?? '',
    },
  });

  const product = watch('product');
  const subProduct = watch('subProduct');
  const stage = watch('stage');
  const status = watch('status');
  const rating = watch('rating');
  const source = watch('source');
  const ownerId = watch('ownerId');
  const accountId = watch('accountId');
  const referredById = watch('referredById');
  const commercialModel = watch('commercialModel');

  const availableSubProducts = SUB_PRODUCTS_BY_PRODUCT[product as SysdeProduct] ?? ['NONE'];

  async function onSubmit(values: OpportunityFormValues) {
    setSubmitting(true);
    const res = mode === 'create'
      ? await createOpportunity(values)
      : await updateOpportunity(opportunityId!, values);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === 'create' ? 'Oportunidad creada' : 'Oportunidad actualizada');
    router.push(`/opportunities/${res.data.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!opportunityId) return;
    const res = await deleteOpportunity(opportunityId);
    if (res.ok) {
      toast.success('Oportunidad eliminada');
      router.push('/opportunities');
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader><CardTitle>Información básica</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input {...register('name')} autoFocus />
          </Field>
          <Field label="Código (opcional, autogenerado)">
            <Input placeholder="OPP-2026-0001" {...register('code')} />
          </Field>
          <Field label="Cuenta *" error={errors.accountId?.message} className="md:col-span-2">
            <Select value={accountId} onValueChange={(v) => setValue('accountId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona una cuenta" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{a.country ? ` · ${a.country}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descripción" className="md:col-span-2">
            <Textarea rows={3} {...register('description')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Producto</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Producto *">
            <Select value={product} onValueChange={(v) => { setValue('product', v as OpportunityFormValues['product']); setValue('subProduct', null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PRODUCT_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sub-producto">
            <Select
              value={subProduct ?? NONE}
              onValueChange={(v) => setValue('subProduct', v === NONE ? null : (v as OpportunityFormValues['subProduct']))}
            >
              <SelectTrigger><SelectValue placeholder="Sin sub-producto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin sub-producto</SelectItem>
                {availableSubProducts.map((sp) => (
                  <SelectItem key={sp} value={sp}>{SUB_PRODUCT_LABELS[sp]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Fase y calificación</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Fase">
            <Select value={stage} onValueChange={(v) => setValue('stage', v as OpportunityFormValues['stage'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setValue('status', v as OpportunityFormValues['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Rating I.O.">
            <Select value={rating} onValueChange={(v) => setValue('rating', v as OpportunityFormValues['rating'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RATING_LABELS).map(([v, { label }]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Probabilidad (%)" error={errors.probability?.message}>
            <Input type="number" min={0} max={100} {...register('probability', { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comercial</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Valor estimado">
            <Input type="number" step="0.01" {...register('estimatedValue', { valueAsNumber: true })} />
          </Field>
          <Field label="Moneda">
            <Input {...register('currency')} />
          </Field>
          <Field label="Modelo comercial">
            <Select value={commercialModel} onValueChange={(v) => setValue('commercialModel', v as OpportunityFormValues['commercialModel'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMMERCIAL_MODEL_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cierre esperado">
            <Input
              type="date"
              {...register('expectedCloseDate', {
                setValueAs: (v) => (v ? new Date(v) : null),
              })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dimensionamiento</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Monto de cartera">
            <Input type="number" step="0.01" {...register('portfolioAmount', { valueAsNumber: true })} />
          </Field>
          <Field label="Usuarios">
            <Input type="number" {...register('userCount', { valueAsNumber: true })} />
          </Field>
          <Field label="Operaciones anuales">
            <Input type="number" {...register('annualOperations', { valueAsNumber: true })} />
          </Field>
          <Field label="Clientes">
            <Input type="number" {...register('clientCount', { valueAsNumber: true })} />
          </Field>
          <Field label="Oficinas">
            <Input type="number" {...register('officeCount', { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Origen y timing</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Source">
            <Select value={source} onValueChange={(v) => setValue('source', v as OpportunityFormValues['source'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CONTACT_SOURCE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source detail">
            <Input {...register('sourceDetail')} />
          </Field>
          <Field label="Referido por">
            <Select value={referredById ?? NONE} onValueChange={(v) => setValue('referredById', v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sin referido" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin referido</SelectItem>
                {contacts.slice(0, 50).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Próxima acción — fecha">
            <Input
              type="date"
              {...register('nextActionDate', {
                setValueAs: (v) => (v ? new Date(v) : null),
              })}
            />
          </Field>
          <Field label="Próxima acción — nota" className="md:col-span-2">
            <Input {...register('nextActionNote')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Asignación y notas</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Owner">
            <Select value={ownerId ?? NONE} onValueChange={(v) => setValue('ownerId', v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notas internas" className="md:col-span-2">
            <Textarea rows={3} {...register('internalNotes')} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === 'edit' && canDelete && (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar oportunidad?"
        description="Esta acción no se puede deshacer."
        destructive
        confirmLabel="Sí, eliminar"
        onConfirm={handleDelete}
      />
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
