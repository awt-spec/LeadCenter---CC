import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

type Params = Promise<{ id: string }>;

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const view = await prisma.opportunityView.findUnique({ where: { id } });
  if (!view) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (view.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 });
  }

  await prisma.opportunityView.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
