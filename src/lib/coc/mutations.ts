'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import {
  cocStrategySchema,
  cocVersionSchema,
  cocLinkCreateSchema,
  cocLinkUpdateSchema,
  type CocStrategyInput,
  type CocVersionInput,
  type CocLinkCreateInput,
  type CocLinkUpdateInput,
} from './schemas';
import { detectLinkType, getDomain, fetchUrlPreview } from './url-preview';

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/// Resolve the session user ID to a real DB user. NextAuth may surface a
/// "demo-user" ID in dev mode that doesn't exist in the User table — using
/// it as an FK would 23503. We look up by email and fall back to NULL so
/// the row still saves (createdById is nullable on these models).
async function requireUserId(): Promise<string | null> {
  const s = await auth();
  if (!s?.user?.id) throw new Error('Sesión requerida');
  // Fast path: id matches a real user.
  const direct = await prisma.user.findUnique({ where: { id: s.user.id }, select: { id: true } });
  if (direct) return direct.id;
  // Fallback: resolve by email.
  if (s.user.email) {
    const byEmail = await prisma.user.findUnique({ where: { email: s.user.email }, select: { id: true } });
    if (byEmail) return byEmail.id;
  }
  return null;
}

/// Returns the Account-bound SharedContext, creating a row on first call.
/// We avoid creating empty rows from queries — only mutations materialize.
async function ensureContext(accountId: string, userId: string | null) {
  const existing = await prisma.sharedContext.findUnique({
    where: { accountId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!acc) throw new Error('Cuenta no encontrada');

  const created = await prisma.sharedContext.create({
    data: {
      accountId,
      createdById: userId,
      updatedById: userId,
    },
    select: { id: true },
  });
  return created.id;
}

export async function saveCocStrategy(input: CocStrategyInput): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = cocStrategySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  const v = parsed.data;
  try {
    const id = await ensureContext(v.accountId, userId);
    await prisma.sharedContext.update({
      where: { id },
      data: {
        headline: v.headline ?? null,
        strategy: v.strategy ?? null,
        goals: v.goals ?? null,
        risks: v.risks ?? null,
        nextSteps: v.nextSteps ?? null,
        updatedById: userId,
      },
    });
    revalidatePath(`/accounts/${v.accountId}`);
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveCocVersion(input: CocVersionInput): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = cocVersionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  const v = parsed.data;
  try {
    const ctxId = await ensureContext(v.accountId, userId);
    // upsert by [contextId, audience]
    const upserted = await prisma.sharedContextVersion.upsert({
      where: { contextId_audience: { contextId: ctxId, audience: v.audience } },
      create: {
        contextId: ctxId,
        audience: v.audience,
        body: v.body ?? null,
        updatedById: userId,
      },
      update: {
        body: v.body ?? null,
        updatedById: userId,
      },
      select: { id: true },
    });
    // Bump parent updatedAt so the header refreshes
    await prisma.sharedContext.update({
      where: { id: ctxId },
      data: { updatedById: userId, updatedAt: new Date() },
    });
    revalidatePath(`/accounts/${v.accountId}`);
    return { ok: true, data: { id: upserted.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function addCocLink(input: CocLinkCreateInput): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const parsed = cocLinkCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  const v = parsed.data;

  try {
    const ctxId = await ensureContext(v.accountId, userId);
    // If the caller didn't supply a type or thumbnail, derive them now. We
    // also opportunistically fetch OG metadata for a richer card; if it
    // fails we still save the link with what we have.
    const detectedType = v.type ?? detectLinkType(v.url);
    const domain = getDomain(v.url);
    let thumbnail: string | null = null;
    let resolvedTitle = v.title;
    let resolvedDescription = v.description ?? null;

    try {
      const preview = await fetchUrlPreview(v.url);
      if (preview.thumbnail) thumbnail = preview.thumbnail;
      // If the user pasted the raw URL as title, replace with a real one.
      if (preview.title && (resolvedTitle === v.url || resolvedTitle.length < 4)) {
        resolvedTitle = preview.title;
      }
      if (!resolvedDescription && preview.description) resolvedDescription = preview.description;
    } catch {
      // ignore — we still have a usable link
    }

    // Position = next slot
    const last = await prisma.sharedContextLink.findFirst({
      where: { contextId: ctxId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const link = await prisma.sharedContextLink.create({
      data: {
        contextId: ctxId,
        url: v.url,
        title: resolvedTitle.slice(0, 200),
        description: resolvedDescription,
        type: detectedType,
        audience: v.audience ?? null,
        domain,
        thumbnail,
        position,
        createdById: userId,
      },
      select: { id: true },
    });
    revalidatePath(`/accounts/${v.accountId}`);
    return { ok: true, data: { id: link.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateCocLink(input: CocLinkUpdateInput): Promise<Result> {
  await requireUserId();
  const parsed = cocLinkUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? 'Datos inválidos' };
  const v = parsed.data;

  try {
    const link = await prisma.sharedContextLink.findUnique({
      where: { id: v.linkId },
      select: { id: true, context: { select: { accountId: true } } },
    });
    if (!link) return { ok: false, error: 'Link no encontrado' };

    await prisma.sharedContextLink.update({
      where: { id: v.linkId },
      data: {
        ...(v.title !== undefined && { title: v.title }),
        ...(v.description !== undefined && { description: v.description }),
        ...(v.type !== undefined && { type: v.type }),
        ...(v.audience !== undefined && { audience: v.audience }),
      },
    });
    revalidatePath(`/accounts/${link.context.accountId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteCocLink(linkId: string): Promise<Result> {
  await requireUserId();
  if (!linkId) return { ok: false, error: 'linkId requerido' };
  try {
    const link = await prisma.sharedContextLink.findUnique({
      where: { id: linkId },
      select: { id: true, context: { select: { accountId: true } } },
    });
    if (!link) return { ok: false, error: 'Link no encontrado' };

    await prisma.sharedContextLink.delete({ where: { id: linkId } });
    revalidatePath(`/accounts/${link.context.accountId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
