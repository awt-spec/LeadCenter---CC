import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

const createSchema = z.object({
  name: z.string().min(1).max(80),
  filters: z.record(z.string(), z.unknown()),
  isShared: z.boolean().optional().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const views = await prisma.opportunityView.findMany({
    where: {
      OR: [{ ownerId: session.user.id }, { isShared: true }],
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ ownerId: 'asc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({
    ok: true,
    views: views.map((v) => ({
      id: v.id,
      name: v.name,
      filters: v.filters,
      isShared: v.isShared,
      isOwn: v.ownerId === session.user.id,
      ownerName: v.owner.name ?? v.owner.email,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'opportunities:read:all') && !can(session, 'opportunities:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const view = await prisma.opportunityView.create({
    data: {
      ownerId: session.user.id,
      name: parsed.data.name,
      filters: parsed.data.filters as Prisma.InputJsonValue,
      isShared: parsed.data.isShared,
    },
  });

  return NextResponse.json({
    ok: true,
    view: {
      id: view.id,
      name: view.name,
      filters: view.filters,
      isShared: view.isShared,
      isOwn: true,
      createdAt: view.createdAt.toISOString(),
    },
  });
}
