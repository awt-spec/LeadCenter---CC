// Lite contacts of a single account — used by the activity composer to
// show "contactos de esta cuenta" as participant chips. Fast endpoint:
// no joins, just the fields the picker needs to render + classify health.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'contacts:read:all') && !can(session, 'contacts:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await ctx.params;

  const rows = await prisma.contact.findMany({
    where: { accountId: id, status: { not: 'ARCHIVED' } },
    select: {
      id: true, fullName: true, email: true, jobTitle: true,
      seniorityLevel: true, status: true,
    },
    orderBy: [{ engagementScore: 'desc' }, { fullName: 'asc' }],
    take: 100,
  });
  return NextResponse.json({ contacts: rows });
}
