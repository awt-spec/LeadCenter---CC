'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityTimeline } from './activity-timeline';
import { ActivityComposer } from './activity-composer';
import type { ActivityWithRelations } from '@/lib/activities/queries';

type EntityOption = { id: string; label: string };

type Props = {
  activities: ActivityWithRelations[];
  currentUserId: string;
  hideRelations?: boolean;
  composerDefaults?: {
    contactId?: string;
    accountId?: string;
    opportunityId?: string;
  };
  contacts: EntityOption[];
  accounts: EntityOption[];
  opportunities: EntityOption[];
  users: { id: string; name: string }[];
  canCreate: boolean;
  title?: string;
};

export function TimelineWithComposer({
  activities,
  currentUserId,
  hideRelations,
  composerDefaults,
  contacts,
  accounts,
  opportunities,
  users,
  canCreate,
  title,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {title && (
          <h3 className="text-sm font-semibold text-sysde-gray">{title}</h3>
        )}
        {canCreate && (
          <Button size="sm" onClick={() => setOpen(true)} className="ml-auto">
            <Plus className="mr-1.5 h-4 w-4" />
            Actividad
          </Button>
        )}
      </div>

      <ActivityTimeline
        activities={activities}
        currentUserId={currentUserId}
        hideRelations={hideRelations}
        allUsers={users}
      />

      <ActivityComposer
        open={open}
        onOpenChange={setOpen}
        defaults={composerDefaults}
        contacts={contacts}
        accounts={accounts}
        opportunities={opportunities}
        users={users}
        currentUserId={currentUserId}
      />
    </div>
  );
}
