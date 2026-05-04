import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { previewAudience, listMatchingContactIds, type AudienceFilter } from '@/lib/campaigns/audience';
import { enrollContactsBulk } from '@/lib/campaigns/mutations';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    op: 'preview' | 'enroll';
    filter: AudienceFilter;
  };

  if (body.op === 'preview') {
    const result = await previewAudience(body.filter ?? {});
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.op === 'enroll') {
    if (!hasRole(session, 'admin') && !hasRole(session, 'senior_commercial')) {
      return NextResponse.json({ error: 'Sin permiso para inscribir.' }, { status: 403 });
    }
    const ids = await listMatchingContactIds(body.filter ?? {});
    if (!ids.length) return NextResponse.json({ error: 'Filtros no devuelven contactos.' }, { status: 400 });
    const r = await enrollContactsBulk(id, ids);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, enrolled: r.data.enrolled, requested: ids.length });
  }

  return NextResponse.json({ error: 'op inválida' }, { status: 400 });
}
