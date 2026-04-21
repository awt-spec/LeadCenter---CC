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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { accountFormSchema, type AccountFormValues } from '@/lib/accounts/schemas';
import { createAccount, updateAccount, deleteAccount } from '@/lib/accounts/mutations';
import {
  ACCOUNT_STATUS_LABELS,
  COMPANY_SIZE_LABELS,
  SEGMENT_LABELS_EXTENDED,
} from '@/lib/shared/labels';

type UserLite = { id: string; name: string };
type AccountLite = { id: string; name: string };

type Props = {
  mode: 'create' | 'edit';
  accountId?: string;
  defaults?: Partial<AccountFormValues>;
  users: UserLite[];
  accounts: AccountLite[];
  canDelete?: boolean;
};

const NONE = '__none__';

export function AccountForm({ mode, accountId, defaults, users, accounts, canDelete }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: defaults?.name ?? '',
      legalName: defaults?.legalName ?? '',
      domain: defaults?.domain ?? '',
      website: defaults?.website ?? '',
      segment: defaults?.segment ?? null,
      industry: defaults?.industry ?? '',
      subIndustry: defaults?.subIndustry ?? '',
      size: defaults?.size ?? 'UNKNOWN',
      currency: defaults?.currency ?? 'USD',
      country: defaults?.country ?? '',
      region: defaults?.region ?? '',
      city: defaults?.city ?? '',
      address: defaults?.address ?? '',
      status: defaults?.status ?? 'PROSPECT',
      ownerId: defaults?.ownerId ?? null,
      parentAccountId: defaults?.parentAccountId ?? null,
      description: defaults?.description ?? '',
      internalNotes: defaults?.internalNotes ?? '',
    },
  });

  const segment = watch('segment');
  const size = watch('size');
  const status = watch('status');
  const ownerId = watch('ownerId');
  const parentAccountId = watch('parentAccountId');

  async function onSubmit(values: AccountFormValues) {
    setSubmitting(true);
    const res = mode === 'create'
      ? await createAccount(values)
      : await updateAccount(accountId!, values);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === 'create' ? 'Cuenta creada' : 'Cuenta actualizada');
    router.push(`/accounts/${res.data.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!accountId) return;
    const res = await deleteAccount(accountId);
    if (res.ok) {
      toast.success('Cuenta eliminada');
      router.push('/accounts');
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader><CardTitle>Identificación</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input {...register('name')} autoFocus />
          </Field>
          <Field label="Nombre legal">
            <Input {...register('legalName')} />
          </Field>
          <Field label="Dominio (ej: empresa.com)">
            <Input {...register('domain')} />
          </Field>
          <Field label="Website">
            <Input type="url" {...register('website')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Clasificación</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Segmento">
            <Select value={segment ?? NONE} onValueChange={(v) => setValue('segment', v === NONE ? null : (v as AccountFormValues['segment']))}>
              <SelectTrigger><SelectValue placeholder="Sin segmento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin segmento</SelectItem>
                {Object.entries(SEGMENT_LABELS_EXTENDED).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tamaño">
            <Select value={size} onValueChange={(v) => setValue('size', v as AccountFormValues['size'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COMPANY_SIZE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Industria">
            <Input {...register('industry')} />
          </Field>
          <Field label="Sub-industria">
            <Input {...register('subIndustry')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Geografía</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="País"><Input {...register('country')} /></Field>
          <Field label="Región">
            <Select value={watch('region') ?? ''} onValueChange={(v) => setValue('region', v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sin región" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin región</SelectItem>
                <SelectItem value="LATAM">LATAM</SelectItem>
                <SelectItem value="CENTRAL_AMERICA">Centroamérica</SelectItem>
                <SelectItem value="CARIBBEAN">Caribe</SelectItem>
                <SelectItem value="AFRICA">África</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ciudad"><Input {...register('city')} /></Field>
          <Field label="Dirección"><Input {...register('address')} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Comercial</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setValue('status', v as AccountFormValues['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner">
            <Select value={ownerId ?? NONE} onValueChange={(v) => setValue('ownerId', v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Cuenta padre (jerarquía)">
            <Select value={parentAccountId ?? NONE} onValueChange={(v) => setValue('parentAccountId', v === NONE ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sin padre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin padre</SelectItem>
                {accounts.filter((a) => a.id !== accountId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Descripción pública">
            <Textarea rows={3} {...register('description')} />
          </Field>
          <Field label="Notas internas">
            <Textarea rows={3} {...register('internalNotes')} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === 'edit' && canDelete && (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar cuenta
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
        title="¿Eliminar cuenta?"
        description="Se eliminarán todas las oportunidades asociadas. Esta acción no se puede deshacer."
        destructive
        confirmLabel="Sí, eliminar"
        onConfirm={handleDelete}
      />
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
