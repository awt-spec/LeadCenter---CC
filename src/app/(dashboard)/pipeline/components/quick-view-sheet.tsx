'use client';

import Link from 'next/link';
import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, Pencil, AlertCircle, Building2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { StageBadge } from '../../opportunities/components/stage-badge';
import {
  CONTACT_ROLE_COLORS,
  CONTACT_ROLE_LABELS,
  PRODUCT_CARD_COLORS,
  PRODUCT_LABELS,
  RATING_LABELS,
  formatMoney,
} from '@/lib/shared/labels';
import type { PipelineOpportunityCard } from '@/lib/pipeline/stats';
import { getInitials } from '@/lib/utils';

type Props = {
  card: PipelineOpportunityCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function QuickViewSheet({ card, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        {card ? <SheetBody card={card} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ card }: { card: PipelineOpportunityCard }) {
  const rating = RATING_LABELS[card.rating as keyof typeof RATING_LABELS];
  const productColors = PRODUCT_CARD_COLORS[card.product] ?? PRODUCT_CARD_COLORS.CUSTOM!;
  const weighted =
    card.estimatedValue !== null ? card.estimatedValue * (card.probability / 100) : null;
  const daysInStage = differenceInDays(new Date(), card.stageChangedAt);
  const nextOverdue = card.nextActionDate && isPast(card.nextActionDate) && card.status === 'OPEN';

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {rating && (
              <span
                className="inline-flex h-6 min-w-[32px] items-center justify-center rounded-full px-2 text-xs font-semibold text-white"
                style={{ backgroundColor: rating.color }}
              >
                {rating.label}
              </span>
            )}
            {card.code && (
              <span className="font-mono text-xs text-sysde-mid">{card.code}</span>
            )}
          </div>
        </div>
        <SheetTitle className="text-[22px] leading-tight">{card.name}</SheetTitle>
        <Link
          href={`/accounts/${card.account.id}`}
          className="mt-1 inline-flex items-center gap-1 text-sm text-sysde-red hover:underline"
        >
          <Building2 className="h-3.5 w-3.5" />
          {card.account.name}
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          <StageBadge stage={card.stage} size="sm" />
          <span
            className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: productColors.bg, color: productColors.text }}
          >
            {PRODUCT_LABELS[card.product as keyof typeof PRODUCT_LABELS] ?? card.product}
          </span>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-6">
          {/* Valor y timing */}
          <Section title="Valor y timing">
            <Grid>
              <KV label="Valor" value={formatMoney(card.estimatedValue, card.currency)} />
              <KV label="Probabilidad" value={`${card.probability}%`} />
              <KV
                label="Ponderado"
                value={weighted !== null ? formatMoney(weighted, card.currency) : '—'}
              />
              <KV
                label="Cierre esperado"
                value={
                  card.expectedCloseDate
                    ? format(card.expectedCloseDate, "d 'de' LLL yyyy", { locale: es })
                    : '—'
                }
              />
              <KV label="Días en fase actual" value={`${daysInStage} días`} />
            </Grid>
            <div className="mt-3">
              <Progress value={card.probability} />
            </div>
          </Section>

          {/* Próxima acción */}
          <Section title="Próxima acción">
            {card.nextActionDate ? (
              <div
                className={
                  nextOverdue
                    ? 'rounded-lg border border-danger/30 bg-red-50 p-3'
                    : 'rounded-lg border border-sysde-border bg-sysde-bg p-3'
                }
              >
                <div
                  className={
                    nextOverdue
                      ? 'flex items-center gap-2 text-sm font-medium text-danger'
                      : 'text-sm font-medium text-sysde-gray'
                  }
                >
                  {nextOverdue && <AlertCircle className="h-4 w-4" />}
                  {format(card.nextActionDate, "d LLL yyyy", { locale: es })} ·{' '}
                  {formatDistanceToNow(card.nextActionDate, { addSuffix: true, locale: es })}
                </div>
                {card.nextActionNote && (
                  <p className="mt-1 text-sm text-sysde-mid">{card.nextActionNote}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-sysde-mid">Sin próxima acción definida.</p>
            )}
          </Section>

          {/* Dimensionamiento */}
          {(card.portfolioAmount !== null ||
            card.userCount !== null ||
            card.annualOperations !== null ||
            card.clientCount !== null) && (
            <Section title="Dimensionamiento">
              <Grid>
                {card.portfolioAmount !== null && (
                  <KV label="Cartera" value={formatMoney(card.portfolioAmount, card.currency)} />
                )}
                {card.userCount !== null && (
                  <KV label="Usuarios" value={card.userCount.toLocaleString('es-MX')} />
                )}
                {card.annualOperations !== null && (
                  <KV
                    label="Operaciones anuales"
                    value={card.annualOperations.toLocaleString('es-MX')}
                  />
                )}
                {card.clientCount !== null && (
                  <KV label="Clientes" value={card.clientCount.toLocaleString('es-MX')} />
                )}
              </Grid>
            </Section>
          )}

          {/* Owner */}
          {card.owner && (
            <Section title="Owner">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {card.owner.avatarUrl ? (
                    <AvatarImage src={card.owner.avatarUrl} alt={card.owner.name} />
                  ) : null}
                  <AvatarFallback>{getInitials(card.owner.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium text-sysde-gray">{card.owner.name}</div>
                  <div className="text-xs text-sysde-mid">{card.owner.email}</div>
                </div>
              </div>
            </Section>
          )}

          {/* Contactos */}
          {card.primaryContact && (
            <Section title="Contacto primario">
              <Link
                href={`/contacts/${card.primaryContact.id}`}
                className="flex items-center justify-between rounded-lg border border-sysde-border bg-white p-3 transition-colors hover:border-sysde-red/30"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {card.primaryContact.avatarUrl ? (
                      <AvatarImage
                        src={card.primaryContact.avatarUrl}
                        alt={card.primaryContact.fullName}
                      />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      {getInitials(card.primaryContact.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium text-sysde-gray">
                      {card.primaryContact.fullName}
                    </div>
                  </div>
                </div>
                <span
                  className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{
                    backgroundColor:
                      CONTACT_ROLE_COLORS[
                        card.primaryContact.role as keyof typeof CONTACT_ROLE_COLORS
                      ] ?? '#64748B',
                  }}
                >
                  {CONTACT_ROLE_LABELS[
                    card.primaryContact.role as keyof typeof CONTACT_ROLE_LABELS
                  ] ?? card.primaryContact.role}
                </span>
              </Link>
            </Section>
          )}

          {/* Descripción */}
          {card.description && (
            <Section title="Descripción">
              <p className="whitespace-pre-wrap text-sm text-sysde-gray">{card.description}</p>
            </Section>
          )}

          {/* Actividad reciente placeholder */}
          <Section title="Actividad reciente">
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-sysde-border bg-sysde-bg text-xs text-sysde-mid">
              Disponible en Fase 2
            </div>
          </Section>
        </div>
      </ScrollArea>

      <SheetFooter>
        <Button variant="outline" asChild>
          <Link href={`/opportunities/${card.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/opportunities/${card.id}`}>
            Ver oportunidad completa
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </SheetFooter>
    </div>
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

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 text-sm">{children}</div>;
}

function KV({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-sysde-mid">{label}</div>
      <div className="text-sm font-medium text-sysde-gray">{value}</div>
    </div>
  );
}
