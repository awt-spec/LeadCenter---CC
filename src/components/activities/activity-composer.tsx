'use client';

import { useEffect, useMemo, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, Plus, X } from 'lucide-react';
import type {
  ActivityOutcome,
  ActivityTag,
  ActivityType,
  NextActionType,
} from '@prisma/client';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ActivityEditor } from './activity-editor';
import { ActivityTypePicker } from './activity-type-picker';
import { ActivityTagBadge } from './activity-tag-badge';
import {
  ACTIVITY_TEMPLATES,
  type ActivityTemplate,
  type TemplateSection,
} from '@/lib/activities/templates';
import {
  ACTIVITY_OUTCOME_COLORS,
  ACTIVITY_OUTCOME_LABELS,
  ACTIVITY_TAG_LABELS,
  NEXT_ACTION_TYPE_LABELS,
} from '@/lib/activities/labels';
import { createActivity } from '@/lib/activities/mutations';
import { cn } from '@/lib/utils';
import type { ActivityFormValues } from '@/lib/activities/schemas';
import { classifyContactHealth, HEALTH_BG, HEALTH_LABELS } from '@/lib/contacts/health';
import type { ContactStatus, SeniorityLevel } from '@prisma/client';
import { useAccountContacts } from '@/lib/hooks/use-account-contacts';
import { useQueryClient } from '@tanstack/react-query';

interface AccountContact {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  seniorityLevel: SeniorityLevel | null;
  status: ContactStatus;
}

type EntityOption = { id: string; label: string; sublabel?: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Pre-fill linked entities */
  defaults?: {
    contactId?: string;
    accountId?: string;
    opportunityId?: string;
    contactLabel?: string;
    accountLabel?: string;
    opportunityLabel?: string;
  };
  /** Available picker lists */
  contacts: EntityOption[];
  accounts: EntityOption[];
  opportunities: EntityOption[];
  users: { id: string; name: string }[];
  currentUserId: string;
};

const ALL_TAGS: ActivityTag[] = [
  'BL',
  'INFO',
  'CONSUL',
  'SOLIC',
  'URGENT',
  'FOLLOWUP',
  'WIN_SIGNAL',
  'RISK_SIGNAL',
];

const NONE = '__none__';

export function ActivityComposer({
  open,
  onOpenChange,
  defaults,
  contacts,
  accounts,
  opportunities,
  users,
  currentUserId,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'pick' | 'compose'>('pick');
  const [templateKey, setTemplateKey] = useState<string | 'free'>('free');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [subject, setSubject] = useState('');
  const [occurredAt, setOccurredAt] = useState<string>(() =>
    toDatetimeLocal(new Date())
  );
  const [durationMinutes, setDurationMinutes] = useState<string>('');
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [sectionValues, setSectionValues] = useState<Record<string, string | string[]>>({});
  const [bodyJson, setBodyJson] = useState<JSONContent | null>(null);
  const [bodyText, setBodyText] = useState('');
  const [participantContactIds, setParticipantContactIds] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<ActivityOutcome | ''>('');

  const [nextActionType, setNextActionType] = useState<NextActionType | ''>('');
  const [nextActionNote, setNextActionNote] = useState('');
  const [nextActionDate, setNextActionDate] = useState<string>('');
  const [nextActionAssigneeId, setNextActionAssigneeId] = useState<string>(currentUserId);

  const [contactId, setContactId] = useState<string>(defaults?.contactId ?? '');
  const [accountId, setAccountId] = useState<string>(defaults?.accountId ?? '');
  const [opportunityId, setOpportunityId] = useState<string>(defaults?.opportunityId ?? '');

  // OPT-013: contactos de la cuenta vía React Query — cache compartido
  // entre componentes que monten el mismo accountId, dedup automático
  // de requests in-flight, y los datos persisten 60s en cache (no se
  // re-fetchean al re-abrir el composer).
  const accountContactsQuery = useAccountContacts(accountId || null);
  const accountContacts = (accountContactsQuery.data ?? []) as AccountContact[];
  const accountContactsLoading = accountContactsQuery.isLoading;
  const queryClient = useQueryClient();
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const template: ActivityTemplate | null =
    templateKey !== 'free' ? ACTIVITY_TEMPLATES[templateKey] ?? null : null;

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep('pick');
      setTemplateKey('free');
      setSubject('');
      setOccurredAt(toDatetimeLocal(new Date()));
      setDurationMinutes('');
      setTags([]);
      setSectionValues({});
      setBodyJson(null);
      setBodyText('');
      setParticipantContactIds([]);
      setOutcome('');
      setNextActionType('');
      setNextActionNote('');
      setNextActionDate(plusBusinessDaysISO(3));
      setNextActionAssigneeId(currentUserId);
      setContactId(defaults?.contactId ?? '');
      setAccountId(defaults?.accountId ?? '');
      setOpportunityId(defaults?.opportunityId ?? '');
    }
  }, [open, defaults, currentUserId]);

  // When template changes, set sensible defaults
  useEffect(() => {
    if (!template) return;
    if (template.defaultNextAction) {
      setNextActionType(template.defaultNextAction);
    }
    setSubject(template.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey]);

  async function handleQuickCreateContact(input: {
    firstName: string; lastName: string; email: string; jobTitle?: string; seniorityLevel?: string;
  }) {
    const res = await fetch('/api/contacts/quick-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, accountId: accountId || null }),
    });
    const json = (await res.json()) as { ok?: boolean; contact?: AccountContact; error?: string; alreadyExisted?: boolean };
    if (!res.ok || !json.ok || !json.contact) {
      throw new Error(json.error ?? 'No se pudo crear el contacto');
    }
    // Optimistic update + invalidate para que el próximo mount del
    // hook re-fetchee con el contacto nuevo incluido.
    queryClient.setQueryData<AccountContact[]>(
      ['account-contacts', accountId],
      (prev) => [json.contact!, ...(prev ?? []).filter((c) => c.id !== json.contact!.id)]
    );
    queryClient.invalidateQueries({ queryKey: ['account-contacts', accountId] });
    setContactId(json.contact.id);
    setShowQuickCreate(false);
    return json;
  }

  const onPickTemplate = (key: string | 'free') => {
    setTemplateKey(key);
    setStep('compose');
  };

  const hasScope = !!(contactId || accountId || opportunityId);

  const canSubmit = useMemo(() => {
    if (!subject.trim()) return false;
    if (!hasScope) return false;
    if (template) {
      for (const s of template.sections) {
        if (!s.required) continue;
        const v = sectionValues[s.key];
        if (s.type === 'list') {
          if (!Array.isArray(v) || v.filter((x) => x.trim()).length === 0) return false;
        } else {
          if (!v || (typeof v === 'string' && !v.trim())) return false;
        }
      }
      if (template.requiresNextAction && (!nextActionType || !nextActionDate)) return false;
    }
    return true;
  }, [subject, hasScope, template, sectionValues, nextActionType, nextActionDate]);

  async function handleSubmit() {
    setSubmitting(true);

    const finalBodyJson = template ? buildBodyFromSections(template, sectionValues) : bodyJson;
    const finalBodyText = template
      ? extractTextFromSections(template, sectionValues)
      : bodyText;

    const type: ActivityType = template?.type ?? 'INTERNAL_NOTE';

    const payload: ActivityFormValues = {
      type,
      subject: subject.trim(),
      bodyJson: finalBodyJson,
      bodyText: finalBodyText,
      tags,
      occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      contactId: contactId || null,
      accountId: accountId || null,
      opportunityId: opportunityId || null,
      participantContactIds,
      mentionUserIds: [],
      nextActionType: nextActionType || null,
      nextActionNote: nextActionNote || null,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      nextActionAssigneeId: nextActionAssigneeId || null,
      outcome: outcome || null,
      subtype: null,
      templateKey: templateKey !== 'free' ? templateKey : null,
    };

    const res = await createActivity(payload);
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Actividad registrada');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-[640px]">
        <SheetHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'compose' && (
              <Button variant="ghost" size="icon" onClick={() => setStep('pick')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <SheetTitle>
              {step === 'pick' ? 'Nueva actividad' : template ? template.name : 'Actividad libre'}
            </SheetTitle>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {step === 'pick' && <ActivityTypePicker onPick={onPickTemplate} />}

            {step === 'compose' && (
              <div className="space-y-6">
                {/* Vinculación */}
                <Section title="Vinculación">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <Label className="text-xs">Contacto</Label>
                        {accountId && (
                          <button
                            type="button"
                            onClick={() => setShowQuickCreate((s) => !s)}
                            className="text-[11px] font-medium text-sysde-red hover:underline"
                          >
                            {showQuickCreate ? 'Cerrar' : '+ Crear'}
                          </button>
                        )}
                      </div>
                      <Select
                        value={contactId || NONE}
                        onValueChange={(v) => setContactId(v === NONE ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder={accountId ? (accountContactsLoading ? 'Cargando…' : 'Sin contacto') : 'Sin contacto'} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin contacto</SelectItem>
                          {accountId && accountContacts.length > 0
                            ? accountContacts.map((c) => {
                                const h = classifyContactHealth({
                                  email: c.email, status: c.status, seniorityLevel: c.seniorityLevel,
                                });
                                return (
                                  <SelectItem key={c.id} value={c.id}>
                                    <span className="flex items-center gap-2">
                                      <span className={cn('h-1.5 w-1.5 rounded-full', HEALTH_BG[h])} title={HEALTH_LABELS[h]} />
                                      {c.fullName}
                                      {c.jobTitle && <span className="text-[11px] text-sysde-mid">· {c.jobTitle}</span>}
                                    </span>
                                  </SelectItem>
                                );
                              })
                            : contacts.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                      {showQuickCreate && (
                        <QuickCreateContactForm
                          onSubmit={handleQuickCreateContact}
                          onCancel={() => setShowQuickCreate(false)}
                        />
                      )}
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Cuenta</Label>
                      <Select
                        value={accountId || NONE}
                        onValueChange={(v) => setAccountId(v === NONE ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Sin cuenta" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin cuenta</SelectItem>
                          {accounts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Oportunidad</Label>
                      <Select
                        value={opportunityId || NONE}
                        onValueChange={(v) => setOpportunityId(v === NONE ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Sin oportunidad" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin oportunidad</SelectItem>
                          {opportunities.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {!hasScope && (
                    <p className="mt-2 text-xs text-danger">
                      Debes vincular a al menos un contacto, cuenta u oportunidad.
                    </p>
                  )}
                </Section>

                {/* Detalles */}
                <Section title="Detalles">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label className="mb-1 block text-xs">Asunto *</Label>
                      <Input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        maxLength={160}
                        placeholder="Título corto de la actividad"
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Cuándo ocurrió</Label>
                      <Input
                        type="datetime-local"
                        value={occurredAt}
                        onChange={(e) => setOccurredAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Duración (min)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Label className="mb-1 block text-xs">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_TAGS.map((t) => {
                        const active = tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() =>
                              setTags((prev) =>
                                prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                              )
                            }
                            className={cn(
                              'transition-colors',
                              active ? 'ring-2 ring-sysde-red ring-offset-1 rounded-md' : 'opacity-70 hover:opacity-100'
                            )}
                          >
                            <ActivityTagBadge tag={t} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Section>

                {/* Contenido */}
                <Section title="Contenido">
                  {template ? (
                    <div className="space-y-4">
                      {template.sections.map((s) => (
                        <SectionField
                          key={s.key}
                          section={s}
                          value={sectionValues[s.key]}
                          onChange={(v) => setSectionValues((prev) => ({ ...prev, [s.key]: v }))}
                        />
                      ))}
                    </div>
                  ) : (
                    <div>
                      <Label className="mb-1 block text-xs">Cuerpo</Label>
                      <ActivityEditor
                        value={bodyJson}
                        onChange={(json, text) => {
                          setBodyJson(json);
                          setBodyText(text);
                        }}
                        placeholder="Describe la actividad. Usa @ para mencionar a un compañero."
                      />
                    </div>
                  )}
                </Section>

                {/* Participantes — preferimos los contactos de la cuenta
                    seleccionada (más relevantes para una demo / reunión); si
                    no hay cuenta caemos a la lista global lite (top 30). */}
                {(template?.requiresParticipants || !template) && (accountContacts.length > 0 || contacts.length > 0) && (
                  <Section
                    title={
                      accountId && accountContacts.length > 0
                        ? `Participantes — contactos de la cuenta (${accountContacts.length})`
                        : 'Participantes (contactos externos)'
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      {(accountContacts.length > 0 ? accountContacts : contacts.slice(0, 30)).map((c) => {
                        const active = participantContactIds.includes(c.id);
                        const isAccountContact = 'fullName' in c;
                        const health = isAccountContact
                          ? classifyContactHealth({
                              email: (c as AccountContact).email,
                              status: (c as AccountContact).status,
                              seniorityLevel: (c as AccountContact).seniorityLevel,
                            })
                          : null;
                        const label = isAccountContact ? (c as AccountContact).fullName : (c as EntityOption).label;
                        const sublabel = isAccountContact ? (c as AccountContact).jobTitle : null;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              setParticipantContactIds((prev) =>
                                prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                              )
                            }
                            className={cn(
                              'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                              active
                                ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                                : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/30'
                            )}
                          >
                            {health && <span className={cn('h-1.5 w-1.5 rounded-full', HEALTH_BG[health])} title={HEALTH_LABELS[health]} />}
                            <span className="font-medium">{label}</span>
                            {sublabel && <span className="text-[10px] text-sysde-mid">· {sublabel}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {accountId && accountContactsLoading && (
                      <p className="mt-2 text-[11px] text-sysde-mid">Cargando contactos de la cuenta…</p>
                    )}
                  </Section>
                )}

                {/* Outcome */}
                <Section title="Resultado">
                  <RadioGroup
                    value={outcome}
                    onValueChange={(v) => setOutcome(v as ActivityOutcome)}
                    className="grid grid-cols-2 gap-2 sm:grid-cols-5"
                  >
                    {Object.entries(ACTIVITY_OUTCOME_LABELS).map(([v, l]) => (
                      <label
                        key={v}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          outcome === v
                            ? 'border-sysde-red bg-sysde-red-light'
                            : 'border-sysde-border bg-white hover:border-sysde-red/30'
                        )}
                      >
                        <RadioGroupItem value={v} />
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{
                            backgroundColor:
                              ACTIVITY_OUTCOME_COLORS[v as ActivityOutcome],
                          }}
                        />
                        <span>{l}</span>
                      </label>
                    ))}
                  </RadioGroup>
                </Section>

                {/* Próxima acción */}
                {(template?.requiresNextAction || !template || template.type !== 'INTERNAL_NOTE') && (
                  <Section title="Próxima acción">
                    <div className="space-y-3 rounded-xl border border-sysde-red/20 bg-sysde-red-light/50 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="mb-1 block text-xs">Tipo</Label>
                          <Select
                            value={nextActionType || NONE}
                            onValueChange={(v) =>
                              setNextActionType(v === NONE ? '' : (v as NextActionType))
                            }
                          >
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Sin próxima acción</SelectItem>
                              {Object.entries(NEXT_ACTION_TYPE_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs">Fecha</Label>
                          <Input
                            type="date"
                            value={nextActionDate}
                            onChange={(e) => setNextActionDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">Nota</Label>
                        <Textarea
                          rows={2}
                          value={nextActionNote}
                          onChange={(e) => setNextActionNote(e.target.value)}
                          placeholder="Qué hay que hacer como siguiente paso"
                        />
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">Asignado a</Label>
                        <Select value={nextActionAssigneeId} onValueChange={setNextActionAssigneeId}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {users.map((u) => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          {step === 'compose' && (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? 'Guardando…' : 'Guardar actividad'}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-sysde-mid">
        {title}
      </div>
      {children}
    </div>
  );
}

function SectionField({
  section,
  value,
  onChange,
}: {
  section: TemplateSection;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">
        {section.label} {section.required && <span className="text-danger">*</span>}
      </Label>
      {section.type === 'text' && (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={section.placeholder}
        />
      )}
      {section.type === 'textarea' && (
        <Textarea
          rows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={section.placeholder}
        />
      )}
      {section.type === 'list' && (
        <ListEditor
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          placeholder={section.placeholder}
        />
      )}
      {section.helpText && (
        <p className="mt-1 text-[11px] text-sysde-mid">{section.helpText}</p>
      )}
    </div>
  );
}

function ListEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...value, v]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-md border border-sysde-border bg-white px-2.5 py-1.5 text-sm"
            >
              <span className="text-sysde-mid">•</span>
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="text-sysde-mid hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? 'Añadir item y presiona Enter'}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function plusBusinessDaysISO(days: number): string {
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function buildBodyFromSections(
  template: ActivityTemplate,
  values: Record<string, string | string[]>
): JSONContent {
  const content: JSONContent[] = [];
  for (const s of template.sections) {
    const v = values[s.key];
    if (!v || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim()))
      continue;
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'bold' }], text: s.label }],
    });
    if (Array.isArray(v)) {
      content.push({
        type: 'bulletList',
        content: v
          .filter((x) => x.trim())
          .map((item) => ({
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
          })),
      });
    } else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: v }] });
    }
  }
  return { type: 'doc', content };
}

function extractTextFromSections(
  template: ActivityTemplate,
  values: Record<string, string | string[]>
): string {
  const out: string[] = [];
  for (const s of template.sections) {
    const v = values[s.key];
    if (!v) continue;
    out.push(`${s.label}:`);
    if (Array.isArray(v)) out.push(v.join(' · '));
    else out.push(v);
  }
  return out.join('\n');
}

// ───────────────────────────────────────────────────────────
// QuickCreateContactForm — inline form to add a contact mid-activity.
// Aparece colapsable bajo el dropdown de "Contacto" cuando hay
// accountId. Crea via /api/contacts/quick-create con campos mínimos.

interface QuickCreateInput {
  firstName: string; lastName: string; email: string;
  jobTitle?: string; seniorityLevel?: string;
}

const SENIORITY_OPTS: Array<{ value: string; label: string }> = [
  { value: 'UNKNOWN', label: 'Sin especificar' },
  { value: 'ANALYST', label: 'Analista' },
  { value: 'MANAGER', label: 'Gerente / Manager' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'VP', label: 'VP' },
  { value: 'C_LEVEL', label: 'C-Level (CEO/CFO/CTO)' },
  { value: 'OWNER', label: 'Dueño / Founder' },
];

function QuickCreateContactForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: QuickCreateInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [seniorityLevel, setSeniorityLevel] = useState('UNKNOWN');
  const [submitting, setSubmitting] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), jobTitle: jobTitle.trim() || undefined, seniorityLevel });
    } catch (err) {
      // toast comes from caller via reject — keep silent here
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handle}
      className="mt-2 space-y-2 rounded-md border border-sysde-border bg-sysde-bg/40 p-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-8 text-xs" placeholder="Nombre *" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        <Input className="h-8 text-xs" placeholder="Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <Input className="h-8 text-xs" placeholder="email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="grid grid-cols-2 gap-2">
        <Input className="h-8 text-xs" placeholder="Cargo" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        <select
          className="h-8 rounded-md border border-sysde-border bg-white px-2 text-xs"
          value={seniorityLevel}
          onChange={(e) => setSeniorityLevel(e.target.value)}
        >
          {SENIORITY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="text-[11px] text-sysde-mid hover:text-sysde-gray">Cancelar</button>
        <button
          type="submit"
          disabled={submitting || !firstName.trim() || !email.trim()}
          className="rounded-md bg-sysde-red px-3 py-1 text-[11px] font-medium text-white hover:bg-sysde-red-dk disabled:opacity-50"
        >
          {submitting ? 'Creando…' : 'Crear'}
        </button>
      </div>
    </form>
  );
}
