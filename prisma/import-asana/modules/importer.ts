// One-shot importer that materialises an Asana data dump into LeadCenter.
// Idempotent: every Asana GID is recorded in IntegrationMapping so re-runs
// are no-ops on rows already imported. Use that to retry partial failures.

import { put } from '@vercel/blob';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { AsanaTask, AsanaStory, AsanaAttachment, AsanaUser, AsanaClient } from './asana-client';
import type { DedupPlan } from './dedup';
import {
  mapStage, mapStatus, mapRating, mapProduct, mapPriority, mapAccountStatus,
  mapCountry, extractCompanyName, SYSTEM_EVENTS_OF_INTEREST, LOVABLE_URL,
} from './mappers';

interface ImportContext {
  prisma: PrismaClient;
  asana: AsanaClient;
  integrationId: string;
  importerUserId: string;
  /// Map Asana user GID/email → LC user ID.
  userMap: Map<string, string>;
  /// Map Asana company name (normalised) → LC account ID.
  companyToAccount: Map<string, string>;
  /// Stats for reporting.
  stats: ImportStats;
}

export interface ImportStats {
  accountsCreated: number;
  accountsReused: number;
  opportunitiesCreated: number;
  opportunitiesSkipped: number;
  tasksCreated: number;
  tasksSkipped: number;
  activitiesCreated: number;
  activitiesSkipped: number;
  attachmentsUploaded: number;
  attachmentsSkipped: number;
  attachmentsFailed: number;
  cocLinksCreated: number;
  errors: string[];
}

const ATTACHMENT_KEEP_MIME = /^(application\/(pdf|vnd\.|msword|.*officedocument|zip)|image\/(png|jpeg|jpg|gif|webp))/i;
const ATTACHMENT_SIZE_LIMIT = 25 * 1024 * 1024; // 25MB — matches /api/tasks/upload cap

const OFFICE_NAME_RE = /\.(pdf|pptx?|docx?|xlsx?|csv|key|numbers|odt|ods|odp|zip)$/i;
const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const PASTED_NAME_RE = /^image\.(png|jpe?g)$/i;

/// True when this attachment is small noise we want to skip (clipboard
/// screenshots, tiny avatars, emoji etc.). Office docs always pass.
function shouldSkipAttachment(att: { name: string; size: number }): { skip: boolean; reason?: string } {
  if (OFFICE_NAME_RE.test(att.name)) return { skip: false };
  // Auto-pasted clipboard screenshots — only keep if at least 200KB
  if (PASTED_NAME_RE.test(att.name) && att.size < 200 * 1024) return { skip: true, reason: 'pasted-screenshot-small' };
  // Generic images — only keep if at least 100KB
  if (IMAGE_NAME_RE.test(att.name) && att.size < 100 * 1024) return { skip: true, reason: 'image-small' };
  if (att.size === 0) return { skip: true, reason: 'empty' };
  if (att.size > ATTACHMENT_SIZE_LIMIT) return { skip: true, reason: 'over-25mb' };
  return { skip: false };
}

/// Resolve Asana user → LC user. Falls back to importerUserId if no match.
function resolveUser(ctx: ImportContext, asanaUser: AsanaUser | null): string {
  if (!asanaUser) return ctx.importerUserId;
  const byGid = ctx.userMap.get(asanaUser.gid);
  if (byGid) return byGid;
  if (asanaUser.email) {
    const byEmail = ctx.userMap.get(asanaUser.email.toLowerCase());
    if (byEmail) return byEmail;
  }
  return ctx.importerUserId;
}

/// Get-or-create the IntegrationMapping for an Asana entity. Returns the
/// LC internal ID if it already exists; otherwise null (so the caller can
/// create the row and call recordMapping with the new id).
async function getMappedId(ctx: ImportContext, externalType: string, externalId: string): Promise<string | null> {
  const m = await ctx.prisma.integrationMapping.findUnique({
    where: { integrationId_externalType_externalId: { integrationId: ctx.integrationId, externalType, externalId } },
    select: { internalId: true },
  });
  return m?.internalId ?? null;
}

async function recordMapping(
  ctx: ImportContext,
  externalType: string,
  externalId: string,
  internalType: string,
  internalId: string
): Promise<void> {
  await ctx.prisma.integrationMapping.upsert({
    where: { integrationId_externalType_externalId: { integrationId: ctx.integrationId, externalType, externalId } },
    create: { integrationId: ctx.integrationId, externalType, externalId, internalType, internalId },
    update: { internalType, internalId, lastSeenAt: new Date(), lastSyncedAt: new Date() },
  });
}

/// Find or create the Account that an Asana task belongs to. Skips return null;
/// generic-bucket returns the shared "Asana - Tareas internas" account.
async function ensureAccount(ctx: ImportContext, planEntry: DedupPlan): Promise<string | null> {
  if (planEntry.action.type === 'reuse') {
    ctx.stats.accountsReused++;
    return planEntry.action.accountId;
  }
  if (planEntry.action.type === 'skip') return null;

  // Generic bucket — single shared account for template/internal tasks.
  // Reuse from in-memory cache or look it up / create on demand.
  const cached = ctx.companyToAccount.get('__generic__');
  if (cached) return cached;

  const existing = await ctx.prisma.account.findFirst({
    where: { name: 'Asana - Tareas internas' },
    select: { id: true },
  });
  if (existing) {
    ctx.companyToAccount.set('__generic__', existing.id);
    return existing.id;
  }

  const created = await ctx.prisma.account.create({
    data: {
      name: 'Asana - Tareas internas',
      status: 'INACTIVE',
      priority: 'LOW',
      description: 'Bucket compartido para tareas internas/template de Asana sin un prospecto identificable.',
      createdById: ctx.importerUserId,
      ownerId: ctx.importerUserId,
      needsDomainReview: false,
    },
    select: { id: true },
  });
  ctx.companyToAccount.set('__generic__', created.id);
  ctx.stats.accountsCreated++;
  return created.id;
}

async function ensureOpportunity(
  ctx: ImportContext,
  task: AsanaTask,
  accountId: string
): Promise<string> {
  const existing = await getMappedId(ctx, 'asana_task', task.gid);
  if (existing) {
    ctx.stats.opportunitiesSkipped++;
    return existing;
  }
  const stage = mapStage(task);
  const status = mapStatus(stage, task.completed);
  const { product, subProduct } = mapProduct(task);
  const rating = mapRating(task);

  // Bring the account up to speed if the imported deal is more advanced.
  await maybePromoteAccount(ctx, accountId, stage, status);

  const close = task.due_at ? new Date(task.due_at) : task.due_on ? new Date(task.due_on) : null;
  const completed = task.completed_at ? new Date(task.completed_at) : null;

  const ownerId = resolveUser(ctx, task.assignee);
  const code = `ASANA-${task.gid.slice(-8).toUpperCase()}`;

  const opp = await ctx.prisma.opportunity.create({
    data: {
      code,
      name: task.name.trim().slice(0, 200) || 'Oportunidad sin nombre',
      description: task.notes?.slice(0, 5000) || null,
      accountId,
      ownerId,
      stage,
      status,
      product,
      subProduct,
      rating,
      probability: probabilityForStage(stage),
      currency: 'USD',
      commercialModel: 'UNDEFINED',
      source: 'UNKNOWN',
      isDirectProspecting: false,
      expectedCloseDate: close,
      closedAt: status === 'WON' || status === 'LOST' ? completed ?? close : null,
      createdById: ctx.importerUserId,
      createdAt: new Date(task.created_at),
    },
    select: { id: true },
  });
  await recordMapping(ctx, 'asana_task', task.gid, 'Opportunity', opp.id);
  ctx.stats.opportunitiesCreated++;
  return opp.id;
}

function probabilityForStage(stage: ReturnType<typeof mapStage>): number {
  switch (stage) {
    case 'WON': return 100;
    case 'LOST': return 0;
    case 'CLOSING': return 90;
    case 'NEGOTIATION': return 75;
    case 'PROPOSAL': return 60;
    case 'DEMO': return 40;
    case 'SIZING': return 25;
    case 'DISCOVERY': return 15;
    default: return 5;
  }
}

async function maybePromoteAccount(
  ctx: ImportContext,
  accountId: string,
  stage: ReturnType<typeof mapStage>,
  status: ReturnType<typeof mapStatus>
): Promise<void> {
  const newStatus = mapAccountStatus(stage, status);
  // Only escalate. Don't downgrade an existing CUSTOMER to PROSPECT.
  const order = { LOST: -1, INACTIVE: 0, BLOCKED: 0, PROSPECT: 1, ACTIVE: 2, PARTNER: 3, CUSTOMER: 4 } as const;
  const acc = await ctx.prisma.account.findUnique({
    where: { id: accountId },
    select: { status: true },
  });
  if (!acc) return;
  if (order[newStatus] > order[acc.status]) {
    await ctx.prisma.account.update({
      where: { id: accountId },
      data: { status: newStatus },
    });
  }
}

async function ensureTask(
  ctx: ImportContext,
  asanaTask: AsanaTask,
  parentLcTaskId: string | null,
  accountId: string,
  opportunityId: string | null
): Promise<string> {
  const existing = await getMappedId(ctx, 'asana_subtask', asanaTask.gid);
  if (existing) {
    ctx.stats.tasksSkipped++;
    return existing;
  }
  const status = asanaTask.completed ? 'DONE' : 'TODO';
  const due = asanaTask.due_at ? new Date(asanaTask.due_at) : asanaTask.due_on ? new Date(asanaTask.due_on) : null;
  const completed = asanaTask.completed_at ? new Date(asanaTask.completed_at) : null;
  const createdById = resolveUser(ctx, asanaTask.assignee);

  const task = await ctx.prisma.task.create({
    data: {
      title: asanaTask.name.trim().slice(0, 250) || 'Subtarea sin título',
      description: asanaTask.notes?.slice(0, 5000) || null,
      status,
      priority: 'NORMAL',
      dueDate: due,
      completedAt: completed,
      accountId,
      opportunityId: opportunityId ?? undefined,
      parentTaskId: parentLcTaskId ?? undefined,
      createdById,
      createdAt: new Date(asanaTask.created_at),
      tags: ['asana'],
    },
    select: { id: true },
  });

  if (asanaTask.assignee) {
    await ctx.prisma.taskAssignee.create({
      data: {
        taskId: task.id,
        userId: resolveUser(ctx, asanaTask.assignee),
      },
    }).catch(() => {
      // ignore — duplicate or user-not-found races are non-fatal
    });
  }

  await recordMapping(ctx, 'asana_subtask', asanaTask.gid, 'Task', task.id);
  ctx.stats.tasksCreated++;
  return task.id;
}

async function importStory(
  ctx: ImportContext,
  story: AsanaStory,
  accountId: string,
  opportunityId: string | null,
  taskId: string | null
): Promise<void> {
  const existing = await getMappedId(ctx, 'asana_story', story.gid);
  if (existing) {
    ctx.stats.activitiesSkipped++;
    return;
  }

  // Skip system events that aren't interesting (avoid drowning the timeline).
  if (story.type === 'system' && !SYSTEM_EVENTS_OF_INTEREST.has(story.resource_subtype)) {
    return;
  }

  const author = resolveUser(ctx, story.created_by);
  const isComment = story.type === 'comment';
  const tags = isComment ? [] : (['INFO'] as const);

  const subjectRaw = (story.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const subject = isComment
    ? subjectRaw || 'Comentario Asana'
    : `[Asana] ${subjectRaw}` || '[Asana] System event';

  const activity = await ctx.prisma.activity.create({
    data: {
      type: isComment ? 'INTERNAL_NOTE' : 'INTERNAL_NOTE',
      subtype: isComment ? 'asana_comment' : `asana_${story.resource_subtype}`,
      subject: subject.slice(0, 250),
      bodyText: story.text || null,
      bodyJson: {
        source: 'asana',
        storyGid: story.gid,
        type: story.type,
        resourceSubtype: story.resource_subtype,
        author: story.created_by ? { name: story.created_by.name, email: story.created_by.email ?? null } : null,
        isPinned: story.is_pinned ?? false,
      } as Prisma.InputJsonValue,
      tags: [...tags],
      occurredAt: new Date(story.created_at),
      accountId,
      opportunityId: opportunityId ?? undefined,
      createdById: author,
    },
    select: { id: true },
  });

  await recordMapping(ctx, 'asana_story', story.gid, 'Activity', activity.id);
  ctx.stats.activitiesCreated++;

  // Detect any Lovable URLs inside the comment and surface them on the C.O.C.
  if (isComment && story.text) {
    await maybeAddLovableLinks(ctx, accountId, story.text, story.created_at);
  }
}

async function maybeAddLovableLinks(
  ctx: ImportContext,
  accountId: string,
  text: string,
  createdAt: string
): Promise<void> {
  const matches = [...new Set(text.match(LOVABLE_URL) ?? [])];
  if (matches.length === 0) return;

  // Ensure SharedContext exists
  const ctxRow = await ctx.prisma.sharedContext.upsert({
    where: { accountId },
    create: { accountId, createdById: ctx.importerUserId, updatedById: ctx.importerUserId },
    update: {},
    select: { id: true },
  });

  for (const url of matches) {
    // De-dup by URL within this context
    const existing = await ctx.prisma.sharedContextLink.findFirst({
      where: { contextId: ctxRow.id, url },
      select: { id: true },
    });
    if (existing) continue;
    await ctx.prisma.sharedContextLink.create({
      data: {
        contextId: ctxRow.id,
        url,
        title: 'Lovable (Asana)',
        description: 'Importado de un comentario en Asana.',
        type: 'LOVABLE',
        domain: safeHost(url),
        createdById: ctx.importerUserId,
        createdAt: new Date(createdAt),
      },
    });
    ctx.stats.cocLinksCreated++;
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function importAttachment(
  ctx: ImportContext,
  att: AsanaAttachment,
  taskLcId: string | null,
  accountId: string
): Promise<void> {
  const existing = await getMappedId(ctx, 'asana_attachment', att.gid);
  if (existing) {
    ctx.stats.attachmentsSkipped++;
    return;
  }
  const skipDecision = shouldSkipAttachment({ name: att.name, size: att.size });
  if (skipDecision.skip) {
    ctx.stats.attachmentsSkipped++;
    return;
  }

  // Decide where to host the file. If we have a Vercel Blob token we mirror
  // the file there (long-term independence from Asana). If not, we just link
  // to Asana's permanent_url — the SYSDE team is already authenticated to
  // Asana so the link works for them, and we save bandwidth + storage.
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  let fileUrl: string;
  let mimeType = inferMimeFromName(att.name);

  if (useBlob) {
    let payload: { buffer: Uint8Array; contentType: string } | null = null;
    try {
      payload = await ctx.asana.downloadAttachment(att);
    } catch (e) {
      ctx.stats.errors.push(`download ${att.gid}: ${(e as Error).message}`);
      ctx.stats.attachmentsFailed++;
      return;
    }
    if (!payload) {
      ctx.stats.attachmentsFailed++;
      return;
    }
    if (!ATTACHMENT_KEEP_MIME.test(payload.contentType) && !ATTACHMENT_KEEP_MIME.test(att.name)) {
      ctx.stats.attachmentsSkipped++;
      return;
    }
    const safeName = att.name.replace(/[^\w.\-]/g, '_').slice(0, 100);
    const key = `asana/${accountId}/${att.gid}-${safeName}`;
    try {
      const blob = await put(key, Buffer.from(payload.buffer), {
        access: 'public',
        addRandomSuffix: false,
        contentType: payload.contentType,
      });
      fileUrl = blob.url;
      mimeType = payload.contentType;
    } catch (e) {
      ctx.stats.errors.push(`blob ${att.gid}: ${(e as Error).message}`);
      ctx.stats.attachmentsFailed++;
      return;
    }
  } else {
    // Fallback: use Asana's permanent URL. Team has Asana access, so they
    // can click and view from inside LeadCenter.
    if (!att.permanent_url) {
      ctx.stats.attachmentsFailed++;
      return;
    }
    fileUrl = att.permanent_url;
  }

  if (taskLcId) {
    const created = await ctx.prisma.taskAttachment.create({
      data: {
        taskId: taskLcId,
        fileName: att.name.slice(0, 200),
        fileUrl,
        fileSize: att.size,
        mimeType,
        uploadedById: ctx.importerUserId,
        uploadedAt: new Date(att.created_at),
      },
      select: { id: true },
    });
    await recordMapping(ctx, 'asana_attachment', att.gid, 'TaskAttachment', created.id);
    ctx.stats.attachmentsUploaded++;

    // Big proposal/decks → also surface in the account C.O.C. resources.
    if (/pdf|presentation|powerpoint|spreadsheet|word|document/i.test(mimeType) && att.size > 200_000) {
      await ensureCocLinkFromAttachment(ctx, accountId, att, fileUrl, mimeType);
    }
  } else {
    // No task to attach to — fall back to a SharedContextLink.
    await ensureCocLinkFromAttachment(ctx, accountId, att, fileUrl, mimeType);
    ctx.stats.attachmentsUploaded++;
    await recordMapping(ctx, 'asana_attachment', att.gid, 'SharedContextLink', `link:${fileUrl}`);
  }
}

function inferMimeFromName(name: string): string {
  const lc = name.toLowerCase();
  if (lc.endsWith('.pdf')) return 'application/pdf';
  if (lc.endsWith('.png')) return 'image/png';
  if (lc.endsWith('.jpg') || lc.endsWith('.jpeg')) return 'image/jpeg';
  if (lc.endsWith('.gif')) return 'image/gif';
  if (lc.endsWith('.webp')) return 'image/webp';
  if (lc.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lc.endsWith('.doc')) return 'application/msword';
  if (lc.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lc.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lc.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lc.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lc.endsWith('.csv')) return 'text/csv';
  if (lc.endsWith('.zip')) return 'application/zip';
  if (lc.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

async function ensureCocLinkFromAttachment(
  ctx: ImportContext,
  accountId: string,
  att: AsanaAttachment,
  url: string,
  contentType: string
): Promise<void> {
  const ctxRow = await ctx.prisma.sharedContext.upsert({
    where: { accountId },
    create: { accountId, createdById: ctx.importerUserId, updatedById: ctx.importerUserId },
    update: {},
    select: { id: true },
  });
  const existing = await ctx.prisma.sharedContextLink.findFirst({
    where: { contextId: ctxRow.id, url },
    select: { id: true },
  });
  if (existing) return;
  const type = /pdf/i.test(contentType) || /pdf$/i.test(att.name)
    ? 'DOCUMENT'
    : /presentation|powerpoint|\.ppt/i.test(contentType + att.name)
      ? 'PRESENTATION'
      : /spreadsheet|excel|\.xls/i.test(contentType + att.name)
        ? 'SPREADSHEET'
        : /word|\.doc/i.test(contentType + att.name)
          ? 'DOCUMENT'
          : 'OTHER';
  await ctx.prisma.sharedContextLink.create({
    data: {
      contextId: ctxRow.id,
      url,
      title: att.name.slice(0, 200),
      description: 'Archivo importado de Asana.',
      type,
      domain: 'vercel-blob',
      createdById: ctx.importerUserId,
      createdAt: new Date(att.created_at),
    },
  });
  ctx.stats.cocLinksCreated++;
}

/// Top-level: import one Asana task + its subtasks + stories + attachments.
export async function importAsanaTask(
  ctx: ImportContext,
  task: AsanaTask,
  planEntry: DedupPlan
): Promise<void> {
  try {
    const accountId = await ensureAccount(ctx, planEntry);
    if (!accountId) {
      ctx.stats.opportunitiesSkipped++;
      return; // skip — no LC account match for this task
    }
    const opportunityId = await ensureOpportunity(ctx, task, accountId);

    // Stories on the parent task → activities on the Opportunity
    for (const story of task.stories ?? []) {
      await importStory(ctx, story, accountId, opportunityId, null);
    }

    // Attachments on parent task — no LC task to attach to (parent is an opp)
    // so they go to C.O.C.
    for (const att of task.attachments ?? []) {
      await importAttachment(ctx, att, null, accountId);
    }

    // Subtasks + their own stories/attachments
    for (const sub of task.subtasks ?? []) {
      const subTaskId = await ensureTask(ctx, sub, null, accountId, opportunityId);
      for (const story of sub.stories ?? []) {
        await importStory(ctx, story, accountId, opportunityId, subTaskId);
      }
      for (const att of sub.attachments ?? []) {
        await importAttachment(ctx, att, subTaskId, accountId);
      }
    }
  } catch (e) {
    ctx.stats.errors.push(`task ${task.gid} (${task.name.slice(0, 50)}): ${(e as Error).message}`);
  }
}

export function newStats(): ImportStats {
  return {
    accountsCreated: 0,
    accountsReused: 0,
    opportunitiesCreated: 0,
    opportunitiesSkipped: 0,
    tasksCreated: 0,
    tasksSkipped: 0,
    activitiesCreated: 0,
    activitiesSkipped: 0,
    attachmentsUploaded: 0,
    attachmentsSkipped: 0,
    attachmentsFailed: 0,
    cocLinksCreated: 0,
    errors: [],
  };
}

export type { ImportContext };
