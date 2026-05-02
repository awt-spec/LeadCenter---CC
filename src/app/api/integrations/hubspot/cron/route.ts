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

  const integrations = await prisma.integration.findMany({
    where: { provider: 'hubspot', status: 'CONNECTED' },
    select: { id: true, connectedById: true },
  });
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const integ of integrations) {
    try {
      await runFullSync(integ.id, integ.connectedById);
      results.push({ id: integ.id, ok: true });
    } catch (e) {
      results.push({ id: integ.id, ok: false, error: (e as Error).message.slice(0, 200) });
    }
  }
  return NextResponse.json({ ok: true, results });
}
