// Send-on-demand email via Resend.
// Persists an Activity (type=EMAIL_SENT) so the timeline shows it
// immediately — even before any open/click tracking comes back.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

const sendSchema = z.object({
  contactId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(1).max(250),
  body: z.string().min(1).max(20000),
  // Optional context — used for the Activity row links.
  accountId: z.string().nullable().optional(),
  opportunityId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? 'LeadCenter <noreply@sysde.com>';
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Resend no está configurado. Agregá RESEND_API_KEY en Vercel env vars (creá una API key en resend.com).',
      },
      { status: 503 }
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.issues }, { status: 400 });
  }
  const { contactId, to, subject, body, accountId, opportunityId } = parsed.data;

  // Resolve real DB user (demo session has synthetic id).
  let createdById: string = session.user.id;
  if (session.user.email) {
    const real = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (real) createdById = real.id;
  }
  // If we still can't find the user, the FK on Activity.createdBy will fail.
  // Prefer to fail loudly than to silently drop the activity.
  const userExists = await prisma.user.findUnique({
    where: { id: createdById },
    select: { id: true, email: true, name: true },
  });
  if (!userExists) {
    return NextResponse.json({ error: 'Usuario no encontrado en DB' }, { status: 404 });
  }

  // Send via Resend. Reply-to = the user, From = configured sender.
  const resend = new Resend(apiKey);
  let resendId: string | undefined;
  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      replyTo: userExists.email ?? undefined,
      text: body,
      // Plain-text-only for now; add HTML rendering later if needed.
    });
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 502 });
    }
    resendId = (result as { data?: { id?: string } }).data?.id;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  // Log as Activity so it shows in the timeline immediately.
  const activity = await prisma.activity.create({
    data: {
      type: 'EMAIL_SENT',
      subject,
      bodyText: body,
      // Stash provider id + recipient for future webhook reconciliation.
      bodyJson: {
        type: 'sysde_email',
        provider: 'resend',
        providerId: resendId ?? null,
        to,
        from,
        replyTo: userExists.email,
        sentVia: 'leadcenter',
      },
      occurredAt: new Date(),
      contactId,
      accountId: accountId ?? null,
      opportunityId: opportunityId ?? null,
      createdById,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, activityId: activity.id, resendId });
}
