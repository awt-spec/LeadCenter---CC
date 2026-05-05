// Quick-create contact endpoint — used by the activity composer when the
// rep needs to add a contact on the fly mid-call (the kind of friction you
// don't want). Takes minimal fields and creates the row directly; the user
// can always go to /contacts/<id>/edit later to fill the rest.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

interface Input {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle?: string | null;
  accountId?: string | null;
  seniorityLevel?: string | null;
  phone?: string | null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'contacts:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: Input;
  try { body = (await req.json()) as Input; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const email = (body.email ?? '').trim().toLowerCase();
  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  if (!email || !firstName) {
    return NextResponse.json({ error: 'email y firstName son obligatorios' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }

  const existing = await prisma.contact.findUnique({ where: { email }, select: { id: true, fullName: true } });
  if (existing) {
    return NextResponse.json({ ok: true, contact: existing, alreadyExisted: true });
  }

  const fullName = `${firstName} ${lastName || ''}`.trim() || email;
  try {
    const created = await prisma.contact.create({
      data: {
        email,
        firstName,
        lastName: lastName || '—',
        fullName: fullName.slice(0, 200),
        jobTitle: body.jobTitle?.slice(0, 200) || null,
        accountId: body.accountId || null,
        seniorityLevel: (body.seniorityLevel as never) || 'UNKNOWN',
        phone: body.phone?.slice(0, 50) || null,
        source: 'MANUAL',
        status: 'ACTIVE',
        ownerId: session.user.id,
        createdById: session.user.id,
      },
      select: { id: true, fullName: true, email: true, jobTitle: true, seniorityLevel: true, status: true },
    });
    return NextResponse.json({ ok: true, contact: created });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
