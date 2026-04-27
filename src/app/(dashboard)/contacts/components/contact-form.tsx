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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TagPicker } from './tag-picker';
import { contactFormSchema, type ContactFormValues } from '@/lib/contacts/schemas';
import { createContact, updateContact, deleteContact } from '@/lib/contacts/mutations';
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_STATUS_LABELS,
  SEGMENT_LABELS,
  SENIORITY_LABELS,
} from '@/lib/constants';

type UserLite = { id: string; name: string };
type TagLite = { id: string; name: string; color: string };

type Props = {
  mode: 'create' | 'edit';
  contactId?: string;
  defaults?: Partial<ContactFormValues>;
  users: UserLite[];
  tags: TagLite[];
  canDelete?: boolean;
};

const NONE_VALUE = '__none__';

export function ContactForm({ mode, contactId, defaults, users, tags, canDelete }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      email: defaults?.email ?? '',
      firstName: defaults?.firstName ?? '',
      lastName: defaults?.lastName ?? '',
      jobTitle: defaults?.jobTitle ?? '',
      department: defaults?.department ?? '',
      seniorityLevel: defaults?.seniorityLevel ?? 'UNKNOWN',
      companyName: defaults?.companyName ?? '',
      country: defaults?.country ?? '',
      city: defaults?.city ?? '',
      phone: defaults?.phone ?? '',
      mobilePhone: defaults?.mobilePhone ?? '',
      linkedinUrl: defaults?.linkedinUrl ?? '',
      website: defaults?.website ?? '',
      source: defaults?.source ?? 'MANUAL',
      sourceDetail: defaults?.sourceDetail ?? '',
      status: defaults?.status ?? 'ACTIVE',
      ownerId: defaults?.ownerId ?? null,
      marketSegment: defaults?.marketSegment ?? null,
      productInterest: defaults?.productInterest ?? [],
      optIn: defaults?.optIn ?? false,
      doNotContact: defaults?.doNotContact ?? false,
      notes: defaults?.notes ?? '',
      tagIds: defaults?.tagIds ?? [],
    },
  });

  const tagIds = watch('tagIds');
  const ownerId = watch('ownerId');
  const source = watch('source');
  const status = watch('status');
  const seniority = watch('seniorityLevel');
  const segment = watch('marketSegment');
  const optIn = watch('optIn');
  const doNotContact = watch('doNotContact');

  async function onSubmit(values: ContactFormValues) {
    setSubmitting(true);
    const res =
      mode === 'create'
        ? await createContact(values)
        : await updateContact(contactId!, values);

    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      if (res.fieldErrors) {
        for (const [key, message] of Object.entries(res.fieldErrors)) {
          toast.error(`${key}: ${message}`);
        }
      }
      return;
    }

    toast.success(mode === 'create' ? 'Contacto creado' : 'Contacto actualizado');
    router.push(`/contacts/${res.data.id}`);
    router.refresh();
  }

  async function handleDelete() {
    if (!contactId) return;
    const res = await deleteContact(contactId);
    if (res.ok) {
      toast.success('Contacto eliminado');
      router.push('/contacts');
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información básica</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre *" error={errors.firstName?.message}>
            <Input {...register('firstName')} autoFocus />
          </Field>
          <Field label="Apellido *" error={errors.lastName?.message}>
            <Input {...register('lastName')} />
          </Field>
          <Field label="Email *" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label="Teléfono">
            <Input {...register('phone')} />
          </Field>
          <Field label="Móvil">
            <Input {...register('mobilePhone')} />
          </Field>
          <Field label="LinkedIn" error={errors.linkedinUrl?.message}>
            <Input type="url" placeholder="https://linkedin.com/in/…" {...register('linkedinUrl')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profesional</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Cargo">
            <Input {...register('jobTitle')} />
          </Field>
          <Field label="Departamento">
            <Input {...register('department')} />
          </Field>
          <Field label="Empresa">
            <Input {...register('companyName')} />
          </Field>
          <Field label="Sitio web" error={errors.website?.message}>
            <Input type="url" {...register('website')} />
          </Field>
          <Field label="Seniority">
            <Select
              value={seniority}
              onValueChange={(v) => setValue('seniorityLevel', v as ContactFormValues['seniorityLevel'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SENIORITY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Segmento">
            <Select
              value={segment ?? NONE_VALUE}
              onValueChange={(v) =>
                setValue('marketSegment', v === NONE_VALUE ? null : (v as ContactFormValues['marketSegment']))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin segmento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sin segmento</SelectItem>
                {Object.entries(SEGMENT_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Geografía</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="País">
            <Input {...register('country')} />
          </Field>
          <Field label="Ciudad">
            <Input {...register('city')} />
          </Field>
          <Field label="Timezone">
            <Input placeholder="America/Mexico_City" {...register('timezone')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comercial</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Source">
            <Select
              value={source}
              onValueChange={(v) => setValue('source', v as ContactFormValues['source'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTACT_SOURCE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source detail">
            <Input {...register('sourceDetail')} placeholder="Ej: Campaña Q2 México" />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onValueChange={(v) => setValue('status', v as ContactFormValues['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTACT_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner">
            <Select
              value={ownerId ?? NONE_VALUE}
              onValueChange={(v) => setValue('ownerId', v === NONE_VALUE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Sin asignar</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagPicker
            tags={tags}
            value={tagIds ?? []}
            onChange={(v) => setValue('tagIds', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consentimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={optIn}
              onCheckedChange={(v) => setValue('optIn', !!v)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-sysde-gray">Opt-in de marketing</div>
              <div className="text-xs text-sysde-mid">
                El contacto aceptó explícitamente recibir comunicaciones comerciales.
              </div>
            </div>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={doNotContact}
              onCheckedChange={(v) => setValue('doNotContact', !!v)}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium text-sysde-gray">No contactar</div>
              <div className="text-xs text-sysde-mid">
                El contacto solicitó no ser contactado. Se mostrará como bloqueado.
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notas</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={5} placeholder="Contexto, próximos pasos…" {...register('notes')} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div>
          {mode === 'edit' && canDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar contacto
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar contacto?"
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
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
