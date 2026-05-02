import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { runFullSync } from '@/lib/integrations/hubspot/sync';

export const maxDuration = 300; // Vercel Pro: up to 5min for the sync run

/// POST → kicks off a full HubSpot sync. Returns once finished. For 100K-row
/// portals this will time out — future work: queue + worker.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !can(session, 'settings:update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as { integrationId?: string };
  let integrationId = body.integrationId;
  if (!integrationId) {
    const integ = await prisma.integration.findFirst({ where: { provider: 'hubspot', status: 'CONNECTED' }, select: { id: true } });
    integrationId = integ?.id;
  }
  if (!integrationId) {
    return NextResponse.json({ error: 'No connected HubSpot integration found' }, { status: 404 });
  }
  // Resolve to a real DB user (demo session uses synthetic id).
  let triggeredById: string | null = null;
  if (session.user.email) {
    const real = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (real) triggeredById = real.id;
  }
  try {
    const { runId, stats } = await runFullSync(integrationId, triggeredById);
    return NextResponse.json({ ok: true, runId, stats });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
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
