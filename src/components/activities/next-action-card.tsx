'use client';

import { useState } from 'react';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { completeNextAction } from '@/lib/activities/mutations';
import {
  NEXT_ACTION_TYPE_ICONS,
  NEXT_ACTION_TYPE_LABELS,
} from '@/lib/activities/labels';
import { cn } from '@/lib/utils';
import type { NextActionType } from '@prisma/client';

type NextActionLite = {
  id: string;
  nextActionType: NextActionType | null;
  nextActionDate: Date | null;
  nextActionNote: string | null;
  nextActionAssignee: { id: string; name: string } | null;
};

type Props = {
  activity: NextActionLite | null;
  currentUserId: string;
};

export function NextActionCard({ activity, currentUserId }: Props) {
  const router = useRouter();
  const [completing, setCompleting] = useState(false);

  if (!activity || !activity.nextActionType || !activity.nextActionDate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Próxima acción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-sysde-mid">
            Sin próxima acción. Crea una actividad para definir el siguiente paso.
          </p>
        </CardContent>
      </Card>
    );
  }

  const Icon = NEXT_ACTION_TYPE_ICONS[activity.nextActionType];
  const overdue = isPast(activity.nextActionDate);
  const isMine = activity.nextActionAssignee?.id === currentUserId;

  async function handleComplete() {
    if (!activity) return;
    setCompleting(true);
    const res = await completeNextAction(activity.id);
    setCompleting(false);
    if (res.ok) {
      toast.success('Próxima acción completada');
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <Card
      className={cn(
        'overflow-hidden',
        overdue ? 'border-danger/40' : 'border-sysde-red/30'
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Próxima acción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              overdue ? 'bg-red-50 text-danger' : 'bg-sysde-red-light text-sysde-red'
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-medium text-sysde-gray">
              {NEXT_ACTION_TYPE_LABELS[activity.nextActionType]}
              {overdue && (
                <span className="inline-flex items-center gap-1 text-xs text-danger">
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
              <p className="mt-2 whitespace-pre-wrap text-sm text-sysde-gray">
                {activity.nextActionNote}
              </p>
            )}
          </div>
        </div>
        {isMine && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={completing}
            onClick={handleComplete}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            {completing ? 'Completando…' : 'Marcar completada'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
