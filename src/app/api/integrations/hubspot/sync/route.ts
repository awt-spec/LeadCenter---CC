import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { runFullSync } from '@/lib/integrations/hubspot/sync';

export const maxDuration = 300; // Vercel Pro: up to 5min total per invocation.

/// POST → fires a HubSpot sync in the background. Returns immediately so the
/// UI can poll for progress instead of hanging the browser tab. Vercel's
/// `after()` keeps the lambda alive after the response is sent.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { integrationId?: string };
  let integrationId = body.integrationId;
  if (!integrationId) {
    const integ = await prisma.integration.findFirst({
      where: { provider: 'hubspot', status: { in: ['CONNECTED', 'SYNCING', 'ERROR'] } },
      select: { id: true },
    });
    integrationId = integ?.id;
  }
  if (!integrationId) {
    return NextResponse.json({ error: 'No HubSpot integration found' }, { status: 404 });
  }

  // Block re-triggering if a sync is already running (avoids two parallel runs).
  const inflight = await prisma.syncRun.findFirst({
    where: { integrationId, status: 'running', startedAt: { gt: new Date(Date.now() - 5 * 60 * 1000) } },
    select: { id: true },
  });
  if (inflight) {
    return NextResponse.json({ ok: true, alreadyRunning: true, runId: inflight.id });
  }

  let triggeredById: string | null = null;
  if (session.user.email) {
    const real = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (real) triggeredById = real.id;
  }

  // Detach: sync runs in background, response returns immediately.
  after(async () => {
    try {
      await runFullSync(integrationId!, triggeredById, 'manual');
    } catch (e) {
      console.error('[hubspot-sync] failed:', e);
    }
  });

  return NextResponse.json({ ok: true, started: true });
}

/// DELETE → disconnect (clear tokens). Mappings are kept so re-connect picks
/// back up where it left off without duplicating records.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const integ = await prisma.integration.findFirst({ where: { provider: 'hubspot' }, select: { id: true } });
  if (integ) {
    await prisma.integration.update({
      where: { id: integ.id },
      data: { status: 'DISCONNECTED', encAccessToken: null, encRefreshToken: null, expiresAt: null, scopes: [] },
    });
  }
  return NextResponse.json({ ok: true });
}
