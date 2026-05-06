import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'audit:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await prisma.auditLog.updateMany({
    where: { id: { in: parsed.data.ids } },
    data: {
      reviewedAt: new Date(),
      reviewedById: session.user.id,
      reviewNote: parsed.data.note ?? null,
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
