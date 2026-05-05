import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users } from 'lucide-react';
import { getSharedContextByAccount } from '@/lib/coc/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CocStrategyForm } from './coc-strategy-form';
import { CocVersionsEditor } from './coc-versions';
import { CocLinksGrid } from './coc-links';

/// Top-level C.O.C. panel rendered inside the Account detail page tab.
/// Server component — fetches the context and hands the editable bits down
/// to client components. Saves go through server actions; revalidation
/// brings the data back fresh.
export async function CocPanel({ accountId }: { accountId: string }) {
  const ctx = await getSharedContextByAccount(accountId);

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-sysde-red">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sysde-red" />
                <CardTitle className="text-base">Contexto Organizacional Compartido</CardTitle>
              </div>
              <p className="mt-1 text-xs text-sysde-mid">
                Vista 360 colaborativa. Cualquier miembro de LeadCenter puede leer y aportar — la
                estrategia compartida abajo es para todo el equipo, las versiones por audiencia
                ajustan el mensaje a quién va dirigido.
              </p>
            </div>
            {ctx.exists && ctx.updatedAt && (
              <div className="flex items-center gap-2 text-[11px] text-sysde-mid">
                {ctx.updatedBy && <span>Última edición: {ctx.updatedBy.name}</span>}
                <span>·</span>
                <span>{format(ctx.updatedAt, "d LLL 'a las' HH:mm", { locale: es })}</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <CocStrategyForm
        accountId={accountId}
        initial={{
          headline: ctx.headline,
          strategy: ctx.strategy,
          goals: ctx.goals,
          risks: ctx.risks,
          nextSteps: ctx.nextSteps,
        }}
      />

      <CocVersionsEditor accountId={accountId} versions={ctx.versions} />

      <CocLinksGrid accountId={accountId} links={ctx.links} />
    </div>
  );
}
