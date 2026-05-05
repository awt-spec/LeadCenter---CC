import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { draftStrategy, draftVersion } from '@/lib/coc/ai-draft';
import { AUDIENCES } from '@/lib/coc/schemas';

export const runtime = 'nodejs';
// Claude calls take 5-20s on a fat 50-activity context. Give breathing room.
export const maxDuration = 60;

/// POST /api/coc/[accountId]/draft
/// Body: { target: 'strategy' } or { target: 'version', audience: Audience }
/// Returns: for strategy → { headline, strategy, goals, risks, nextSteps }
///          for version  → { body }
export async function POST(req: NextRequest, ctx: { params: Promise<{ accountId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!can(session, 'accounts:read:all') && !can(session, 'accounts:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { accountId } = await ctx.params;
  let body: { target?: string; audience?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.target === 'strategy') {
      const draft = await draftStrategy(accountId);
      return NextResponse.json({ ok: true, draft });
    }
    if (body.target === 'version') {
      if (!body.audience || !AUDIENCES.includes(body.audience as (typeof AUDIENCES)[number])) {
        return NextResponse.json({ error: 'audience inválida o faltante' }, { status: 400 });
      }
      const draft = await draftVersion(accountId, body.audience as (typeof AUDIENCES)[number]);
      return NextResponse.json({ ok: true, draft });
    }
    return NextResponse.json({ error: 'target inválido (usá "strategy" o "version")' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
