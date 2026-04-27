import { auth } from '@/lib/auth';
import { Forbidden } from '@/components/shared/forbidden';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ActivityCard } from '@/components/activities/activity-card';
import {
  getInboxMentions,
  getAssignedNextActions,
  getMyCreatedActivities,
} from '@/lib/activities/queries';
import { isPast, isToday, isThisWeek } from 'date-fns';

export const metadata = { title: 'Inbox' };

export default async function InboxPage() {
  const session = await auth();
  if (!session?.user?.id) return <Forbidden />;

  const [mentions, assigned, mine] = await Promise.all([
    getInboxMentions(session, false),
    getAssignedNextActions(session),
    getMyCreatedActivities(session),
  ]);

  const unreadMentions = mentions.filter((m) => !m.readAt);

  type AssignedItem = (typeof assigned)[number];
  const overdue: AssignedItem[] = [];
  const today: AssignedItem[] = [];
  const thisWeek: AssignedItem[] = [];
  const future: AssignedItem[] = [];
  const now = new Date();
  for (const a of assigned) {
    if (!a.nextActionDate) continue;
    if (isToday(a.nextActionDate)) today.push(a);
    else if (isPast(a.nextActionDate)) overdue.push(a);
    else if (isThisWeek(a.nextActionDate, { weekStartsOn: 1 })) thisWeek.push(a);
    else future.push(a);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-[24px] font-semibold text-sysde-gray">Inbox</h2>
        <p className="mt-1 text-sm text-sysde-mid">
          Tus menciones, próximas acciones asignadas y actividades creadas.
        </p>
      </div>

      <Tabs defaultValue="mentions">
        <TabsList>
          <TabsTrigger value="mentions">
            Menciones
            {unreadMentions.length > 0 && (
              <Badge variant="default" className="ml-2">
                {unreadMentions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Acciones asignadas
            {assigned.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {assigned.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="mine">Mis actividades</TabsTrigger>
        </TabsList>

        <TabsContent value="mentions" className="space-y-4">
          {mentions.length === 0 ? (
            <EmptyTab message="Nadie te ha mencionado todavía." />
          ) : (
            <div className="relative space-y-4">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-sysde-border" />
              {mentions.map((m) => (
                <ActivityCard
                  key={m.activityId}
                  activity={m.activity}
                  currentUserId={session.user.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assigned" className="space-y-6">
          {assigned.length === 0 ? (
            <EmptyTab message="Sin acciones pendientes asignadas. ¡A descansar!" />
          ) : (
            <>
              {overdue.length > 0 && (
                <Group title="Vencidas" items={overdue} userId={session.user.id} accent="danger" />
              )}
              {today.length > 0 && (
                <Group title="Hoy" items={today} userId={session.user.id} />
              )}
              {thisWeek.length > 0 && (
                <Group title="Esta semana" items={thisWeek} userId={session.user.id} />
              )}
              {future.length > 0 && (
                <Group title="Próximas" items={future} userId={session.user.id} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-4">
          {mine.length === 0 ? (
            <EmptyTab message="Aún no has creado actividades." />
          ) : (
            <div className="relative space-y-4">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-sysde-border" />
              {mine.map((a) => (
                <ActivityCard key={a.id} activity={a} currentUserId={session.user.id} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Group({
  title,
  items,
  userId,
  accent,
}: {
  title: string;
  items: Awaited<ReturnType<typeof getAssignedNextActions>>;
  userId: string;
  accent?: 'danger';
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            accent === 'danger' ? 'text-danger' : 'text-sysde-mid'
          }`}
        >
          {title}
        </span>
        <Badge variant={accent === 'danger' ? 'danger' : 'secondary'}>{items.length}</Badge>
      </div>
      <div className="relative space-y-4">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-sysde-border" />
        {items.map((a) => (
          <ActivityCard key={a.id} activity={a} currentUserId={userId} />
        ))}
      </div>
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sin novedades</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-sysde-mid">{message}</p>
      </CardContent>
    </Card>
  );
}
