'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import type { Session } from 'next-auth';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { hasRole } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit/write';
import {
  campaignFormSchema,
  campaignStepFormSchema,
  type CampaignFormValues,
  type CampaignStepFormValues,
} from './schemas';

type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireSession() {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  return s;
}

function fieldErrorsFromZod(error: import('zod').ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = i.path.join('.');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

async function audit(userId: string | null, action: string, resourceId?: string, changes?: unknown) {
  await writeAuditLog({
    userId,
    action,
    resource: 'campaigns',
    resourceId,
    changes: (changes ?? null) as Prisma.InputJsonValue,
  });
}

function isAdmin(s: Session) {
  return hasRole(s, 'admin') || hasRole(s, 'senior_commercial');
}

export async function createCampaign(input: CampaignFormValues): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso para crear campañas.' };

  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const v = parsed.data;

  const created = await prisma.campaign.create({
    data: {
      name: v.name,
      code: v.code || null,
      description: v.description || null,
      type: v.type,
      status: v.status,
      goal: v.goal,
      targetSegment: v.targetSegment || null,
      targetCountry: v.targetCountry || null,
      startDate: v.startDate ? new Date(v.startDate) : null,
      endDate: v.endDate ? new Date(v.endDate) : null,
      budget: v.budget ?? null,
      spent: v.spent ?? null,
      currency: v.currency,
      ownerId: v.ownerId || session.user.id,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await audit(session.user.id, 'create', created.id, v);
  revalidatePath('/campaigns');
  return { ok: true, data: { id: created.id } };
}

export async function updateCampaign(
  id: string,
  input: CampaignFormValues
): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso para editar campañas.' };

  const parsed = campaignFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const v = parsed.data;

  await prisma.campaign.update({
    where: { id },
    data: {
      name: v.name,
      code: v.code || null,
      description: v.description || null,
      type: v.type,
      status: v.status,
      goal: v.goal,
      targetSegment: v.targetSegment || null,
      targetCountry: v.targetCountry || null,
      startDate: v.startDate ? new Date(v.startDate) : null,
      endDate: v.endDate ? new Date(v.endDate) : null,
      budget: v.budget ?? null,
      spent: v.spent ?? null,
      currency: v.currency,
      ownerId: v.ownerId || session.user.id,
    },
  });

  await audit(session.user.id, 'update', id, v);
  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return { ok: true, data: undefined };
}

export async function setCampaignStatus(
  id: string,
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'
): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  await prisma.campaign.update({ where: { id }, data: { status } });
  await audit(session.user.id, 'status_change', id, { status });

  revalidatePath('/campaigns');
  revalidatePath(`/campaigns/${id}`);
  return { ok: true, data: undefined };
}

export async function deleteCampaign(id: string): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso para eliminar.' };

  await prisma.campaign.delete({ where: { id } });
  await audit(session.user.id, 'delete', id);

  revalidatePath('/campaigns');
  return { ok: true, data: undefined };
}

export async function addCampaignStep(input: CampaignStepFormValues): Promise<Result<{ id: string }>> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  const parsed = campaignStepFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const v = parsed.data;

  const step = await prisma.campaignStep.create({
    data: {
      campaignId: v.campaignId,
      order: v.order,
      type: v.type,
      name: v.name,
      delayDays: v.delayDays,
      emailSubject: v.emailSubject || null,
      emailBody: v.emailBody || null,
      callScript: v.callScript || null,
      taskTitle: v.taskTitle || null,
      notes: v.notes || null,
      targetSeniority: v.targetSeniority ?? [],
    },
    select: { id: true },
  });

  await audit(session.user.id, 'step_add', v.campaignId, { stepId: step.id });
  revalidatePath(`/campaigns/${v.campaignId}`);
  return { ok: true, data: { id: step.id } };
}

export async function deleteCampaignStep(campaignId: string, stepId: string): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  await prisma.campaignStep.delete({ where: { id: stepId } });
  await audit(session.user.id, 'step_delete', campaignId, { stepId });

  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, data: undefined };
}

export async function enrollContactsBulk(
  campaignId: string,
  contactIds: string[]
): Promise<Result<{ enrolled: number }>> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };
  if (!contactIds.length) return { ok: true, data: { enrolled: 0 } };

  const result = await prisma.campaignContact.createMany({
    data: contactIds.map((contactId) => ({
      campaignId,
      contactId,
      status: 'ACTIVE' as const,
    })),
    skipDuplicates: true,
  });

  await audit(session.user.id, 'enroll_bulk', campaignId, {
    count: result.count,
    requested: contactIds.length,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, data: { enrolled: result.count } };
}

export async function enrollContact(campaignId: string, contactId: string): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  await prisma.campaignContact.upsert({
    where: { campaignId_contactId: { campaignId, contactId } },
    update: { status: 'ACTIVE' },
    create: { campaignId, contactId, status: 'ACTIVE' },
  });

  await audit(session.user.id, 'enroll', campaignId, { contactId });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, data: undefined };
}

export async function unenrollContact(campaignId: string, contactId: string): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  await prisma.campaignContact.delete({
    where: { campaignId_contactId: { campaignId, contactId } },
  });

  await audit(session.user.id, 'unenroll', campaignId, { contactId });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, data: undefined };
}

export async function searchContactsForEnroll(
  campaignId: string,
  q: string
): Promise<{
  ok: true;
  data: {
    id: string;
    fullName: string;
    email: string;
    companyName: string | null;
    enrolled: boolean;
  }[];
}> {
  const session = await requireSession();
  if (!session?.user?.id) return { ok: true, data: [] };

  const trimmed = q.trim();
  const where = trimmed.length > 0
    ? {
        OR: [
          { fullName: { contains: trimmed, mode: 'insensitive' as const } },
          { email: { contains: trimmed, mode: 'insensitive' as const } },
          { companyName: { contains: trimmed, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [contacts, alreadyEnrolled] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: { id: true, fullName: true, email: true, companyName: true },
      orderBy: { fullName: 'asc' },
      take: 30,
    }),
    prisma.campaignContact.findMany({
      where: { campaignId },
      select: { contactId: true },
    }),
  ]);

  const enrolledSet = new Set(alreadyEnrolled.map((e) => e.contactId));
  return {
    ok: true,
    data: contacts.map((c) => ({ ...c, enrolled: enrolledSet.has(c.id) })),
  };
}

export async function setCampaignContactStatus(
  campaignId: string,
  contactId: string,
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'UNSUBSCRIBED' | 'BOUNCED' | 'REPLIED' | 'CONVERTED'
): Promise<Result> {
  const session = await requireSession();
  if (!isAdmin(session)) return { ok: false, error: 'Sin permiso.' };

  await prisma.campaignContact.update({
    where: { campaignId_contactId: { campaignId, contactId } },
    data: {
      status,
      ...(status === 'COMPLETED' && { completedAt: new Date() }),
      ...(status === 'UNSUBSCRIBED' && { unsubscribedAt: new Date() }),
      ...(status === 'BOUNCED' && { bouncedAt: new Date() }),
    },
  });

  await audit(session.user.id, 'contact_status', campaignId, { contactId, status });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: true, data: undefined };
}
