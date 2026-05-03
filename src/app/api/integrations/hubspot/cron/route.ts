// Vercel Cron entrypoint — runs the full HubSpot sync periodically as a
// safety net for missed webhooks. Schedule defined in vercel.json.
//
// Auth: Vercel signs cron requests with the CRON_SECRET env var via the
// `Authorization: Bearer <secret>` header. We reject anything else.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { runFullSync } from '@/lib/integrations/hubspot/sync';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Self-heal: any SyncRun stuck in 'running' for > 5 min is orphaned
  // (lambda died mid-flight). Mark it as error so the integration unlocks.
  await prisma.syncRun.updateMany({
    where: { status: 'running', startedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { status: 'error', finishedAt: new Date(), error: 'Stuck > 5min, freed by cron' },
  });
  await prisma.integration.updateMany({
    where: { provider: 'hubspot', status: 'SYNCING', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } },
    data: { status: 'CONNECTED' },
  });

  // Pick up CONNECTED + ERROR — ERROR is recoverable, we just retry.
  const integrations = await prisma.integration.findMany({
    where: { provider: 'hubspot', status: { in: ['CONNECTED', 'ERROR'] } },
    select: { id: true, connectedById: true },
  });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const integ of integrations) {
    try {
      await runFullSync(integ.id, integ.connectedById, 'cron');
      results.push({ id: integ.id, ok: true });
    } catch (e) {
      results.push({ id: integ.id, ok: false, error: (e as Error).message.slice(0, 200) });
    }
  }
  return NextResponse.json({ ok: true, results });
}
