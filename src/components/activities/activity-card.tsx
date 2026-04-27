'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Building2,
  Briefcase,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  ACTIVITY_OUTCOME_COLORS,
  ACTIVITY_OUTCOME_LABELS,
  ACTIVITY_TYPE_COLORS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_TYPE_LABELS,
  NEXT_ACTION_TYPE_ICONS,
  NEXT_ACTION_TYPE_LABELS,
} from '@/lib/activities/labels';
import { getTemplate } from '@/lib/activities/templates';
import { ActivityTagBadge } from './activity-tag-badge';
import { AssigneePicker } from './assignee-picker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { completeNextAction, deleteActivity } from '@/lib/activities/mutations';
import type { ActivityWithRelations } from '@/lib/activities/queries';
import { cn, getInitials } from '@/lib/utils';

type Props = {
  activity: ActivityWithRelations;
  currentUserId: string;
  hideRelations?: boolean;
  allUsers?: { id: string; name: string; email?: string; avatarUrl?: string | null }[];
};

export function ActivityCard({ activity, currentUserId, hideRelations, allUsers }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const Icon = ACTIVITY_TYPE_ICONS[activity.type];
  const color = ACTIVITY_TYPE_COLORS[activity.type];
  const template = getTemplate(activity.templateKey);

  const canEdit = activity.createdById === currentUserId;
  const isMyAction =
    !!activity.nextActionAssigneeId && activity.nextActionAssigneeId === currentUserId;
  const nextOverdue =
    activity.nextActionDate &&
    !activity.nextActionCompleted &&
    isPast(activity.nextActionDate);

  async function handleComplete() {
    const res = await completeNextAction(activity.id);
    if (res.ok) {
      toast.success('Acción completada');
      router.refresh();
    } else toast.error(res.error);
  }

  async function handleDelete() {
    const res = await deleteActivity(activity.id);
    if (res.ok) {
      toast.success('Actividad eliminada');
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <div className="relative pl-10">
      {/* Dot */}
      <div
        className="absolute left-0 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="rounded-xl border border-sysde-border bg-white p-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-sysde-mid">
              <span className="font-semibold text-sysde-gray">
                {ACTIVITY_TYPE_LABELS[activity.type]}
              </span>
              {template && (
                <>
                  <span>·</span>
                  <span>{template.name}</span>
                </>
              )}
              <span>·</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>{formatDistanceToNow(activity.occurredAt, { addSuffix: true, locale: es })}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(activity.occurredAt, "d 'de' LLL yyyy HH:mm", { locale: es })}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {activity.durationMinutes && (
                <>
                  <span>·</span>
                  <span>{activity.durationMinutes}m</span>
                </>
              )}
              {activity.tags.length > 0 && (
                <>
                  <span>·</span>
                  <div className="flex flex-wrap gap-1">
                    {activity.tags.map((t) => (
                      <ActivityTagBadge key={t} tag={t} />
                    ))}
                  </div>
                </>
              )}
            </div>
            <h4 className="mt-1 text-[15px] font-medium leading-snug text-sysde-gray">
              {activity.subject}
            </h4>
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>Editar (próximamente)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-danger focus:text-danger"
                  onSelect={(e) => {
                    e.preventDefault();
                    setConfirmDelete(true);
                  }}
                >
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Body */}
        {activity.bodyJson ? (
          <BodyRenderer doc={activity.bodyJson} />
        ) : activity.bodyText ? (
          <p className="mt-3 whitespace-pre-wrap text-sm text-sysde-gray">
            {activity.bodyText}
          </p>
        ) : null}

        {/* Participants */}
        {activity.participants.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-sysde-mid">
            <span className="font-medium">Participantes:</span>
            <div className="flex -space-x-1">
              {activity.participants.slice(0, 5).map((p) => (
                <TooltipProvider key={p.contactId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-5 w-5 border-2 border-white">
                        {p.contact.avatarUrl ? (
                          <AvatarImage src={p.contact.avatarUrl} alt={p.contact.fullName} />
                        ) : null}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(p.contact.fullName)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>{p.contact.fullName}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
            {activity.participants.length > 5 && (
              <span>+{activity.participants.length - 5} más</span>
            )}
          </div>
        )}

        {/* Outcome */}
        {activity.outcome && activity.outcome !== 'NEUTRAL' && (
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: ACTIVITY_OUTCOME_COLORS[activity.outcome] }}
            >
              {ACTIVITY_OUTCOME_LABELS[activity.outcome]}
            </span>
          </div>
        )}

        {/* Next action card */}
        {activity.nextActionDate && activity.nextActionType && (
          <div
            className={cn(
              'mt-3 rounded-lg border p-3',
              nextOverdue
                ? 'border-danger/30 bg-red-50'
                : activity.nextActionCompleted
                ? 'border-success/30 bg-green-50/40'
                : 'border-sysde-red/20 bg-sysde-red-light/40'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                {(() => {
                  const NextIcon = NEXT_ACTION_TYPE_ICONS[activity.nextActionType];
                  return (
                    <NextIcon
                      className={cn(
                        'mt-0.5 h-4 w-4',
                        nextOverdue
                          ? 'text-danger'
                          : activity.nextActionCompleted
                          ? 'text-success'
                          : 'text-sysde-red'
                      )}
                    />
                  );
                })()}
                <div className="text-sm">
                  <div className="font-medium text-sysde-gray">
                    {NEXT_ACTION_TYPE_LABELS[activity.nextActionType]}
                    {activity.nextActionCompleted && (
                      <span className="ml-2 text-xs text-success">· completada</span>
                    )}
                    {nextOverdue && !activity.nextActionCompleted && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-danger">
                        <AlertCircle className="h-3 w-3" />
                        vencida
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-sysde-mid">
                    {format(activity.nextActionDate, "d 'de' LLL yyyy", { locale: es })}
                    {activity.nextActionAssignee &&
                      ` · ${activity.nextActionAssignee.name.split(' ')[0]}`}
                  </div>
                  {activity.nextActionNote && (
                    <div className="mt-1 text-sm text-sysde-gray">{activity.nextActionNote}</div>
                  )}
                </div>
              </div>
              {!activity.nextActionCompleted && isMyAction && (
                <Button size="sm" variant="outline" onClick={handleComplete}>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Completada
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Linked entities (if global timeline) */}
        {!hideRelations && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-sysde-border pt-3 text-xs text-sysde-mid">
            {activity.contact && (
              <Link
                href={`/contacts/${activity.contact.id}`}
                className="inline-flex items-center gap-1 transition-colors hover:text-sysde-red"
              >
                <UserIcon className="h-3 w-3" />
                {activity.contact.fullName}
              </Link>
            )}
            {activity.account && (
              <Link
                href={`/accounts/${activity.account.id}`}
                className="inline-flex items-center gap-1 transition-colors hover:text-sysde-red"
              >
                <Building2 className="h-3 w-3" />
                {activity.account.name}
              </Link>
            )}
            {activity.opportunity && (
              <Link
                href={`/opportunities/${activity.opportunity.id}`}
                className="inline-flex items-center gap-1 transition-colors hover:text-sysde-red"
              >
                <Briefcase className="h-3 w-3" />
                {activity.opportunity.code ?? activity.opportunity.name}
              </Link>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-sysde-border pt-3 text-xs text-sysde-mid">
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              {activity.createdBy.avatarUrl ? (
                <AvatarImage src={activity.createdBy.avatarUrl} alt={activity.createdBy.name} />
              ) : null}
              <AvatarFallback className="text-[9px]">
                {getInitials(activity.createdBy.name)}
              </AvatarFallback>
            </Avatar>
            <span>{activity.createdBy.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {allUsers && (
              <>
                <span className="text-[10px] uppercase tracking-wide">Resp.</span>
                <AssigneePicker
                  activityId={activity.id}
                  initial={activity.assignees.map((a) => ({
                    id: a.user.id,
                    name: a.user.name,
                    email: a.user.email,
                    avatarUrl: a.user.avatarUrl,
                  }))}
                  allUsers={allUsers}
                  size="xs"
                />
              </>
            )}
            <span>·</span>
            <span>{format(activity.createdAt, 'd LLL', { locale: es })}</span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar actividad?"
        description="Esta acción no se puede deshacer."
        destructive
        confirmLabel="Sí, eliminar"
        onConfirm={handleDelete}
      />
    </div>
  );
}

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string }[];
};

function BodyRenderer({ doc }: { doc: unknown }) {
  if (!doc || typeof doc !== 'object') return null;
  return (
    <div className="prose prose-sm mt-3 max-w-none text-sm text-sysde-gray [&>*]:my-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
      {renderNodes((doc as TiptapNode).content ?? [])}
    </div>
  );
}

function renderNodes(nodes: TiptapNode[]): React.ReactNode {
  return nodes.map((n, i) => renderNode(n, i));
}

function renderNode(node: TiptapNode, i: number): React.ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={i}>{renderNodes(node.content ?? [])}</p>;
    case 'bulletList':
      return <ul key={i} className="list-disc pl-5">{renderNodes(node.content ?? [])}</ul>;
    case 'orderedList':
      return <ol key={i} className="list-decimal pl-5">{renderNodes(node.content ?? [])}</ol>;
    case 'listItem':
      return <li key={i}>{renderNodes(node.content ?? [])}</li>;
    case 'mention': {
      const label = (node.attrs?.label as string) ?? (node.attrs?.id as string) ?? '?';
      return (
        <span
          key={i}
          className="inline-flex items-center rounded-full bg-sysde-red-light px-2 py-0.5 text-xs font-medium text-sysde-red"
        >
          @{label}
        </span>
      );
    }
    case 'text': {
      let text: React.ReactNode = node.text ?? '';
      if (node.marks?.some((m) => m.type === 'bold')) text = <strong key={`b-${i}`}>{text}</strong>;
      if (node.marks?.some((m) => m.type === 'italic')) text = <em key={`i-${i}`}>{text}</em>;
      return <span key={i}>{text}</span>;
    }
    default:
      return <span key={i}>{renderNodes(node.content ?? [])}</span>;
  }
}
