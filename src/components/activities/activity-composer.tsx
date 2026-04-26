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
                      <Label className="mb-1 block text-xs">Contacto</Label>
                      <Select
                        value={contactId || NONE}
                        onValueChange={(v) => setContactId(v === NONE ? '' : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Sin contacto" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Sin contacto</SelectItem>
                          {contacts.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

                {/* Participantes */}
                {(template?.requiresParticipants || !template) && contacts.length > 0 && (
                  <Section title="Participantes (contactos externos)">
                    <div className="flex flex-wrap gap-2">
                      {contacts.slice(0, 30).map((c) => {
                        const active = participantContactIds.includes(c.id);
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
                              'rounded-md border px-2.5 py-1 text-xs transition-colors',
                              active
                                ? 'border-sysde-red bg-sysde-red-light text-sysde-red'
                                : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/30'
                            )}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
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
