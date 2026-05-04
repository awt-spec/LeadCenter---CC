// Account-level AI summary via Claude. Pulls the most useful signals from
// the DB (recent activities, open/closed deals, contacts, tasks) and asks
// Claude to produce a structured executive briefing.
//
// Output is JSON validated against AccountSummary so the UI can render
// reliable sections (no free-form blob).

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';

export interface AccountSummary {
  /// 1-2 sentence headline a busy CMO would read first.
  headline: string;
  /// 'positivo' | 'neutro' | 'riesgo' — drives the badge color in the UI.
  momentum: 'positivo' | 'neutro' | 'riesgo';
  /// Concrete signals (each ≤ 80 chars).
  signals: string[];
  /// Risks / blockers.
  risks: string[];
  /// Suggested next steps with optional owner + horizon.
  nextSteps: Array<{ action: string; owner?: string; horizon?: string }>;
  /// 'A' | 'B+' | 'B' | ... rough deal qualification grade based on signals.
  rating: string;
  /// Generated timestamp (set server-side).
  generatedAt: string;
}

interface BuildContextResult {
  context: string;
  bytes: number;
}

async function buildContext(accountId: string): Promise<BuildContextResult> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true, name: true, domain: true, status: true, priority: true,
      country: true, segment: true, industry: true, size: true,
      description: true, internalNotes: true, offlineResearch: true,
      owner: { select: { name: true } },
      _count: { select: { contacts: true, opportunities: true, activities: true } },
    },
  });
  if (!account) throw new Error('Cuenta no encontrada');

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [recentActivities, openOpps, closedOpps, contacts, openTasks] = await Promise.all([
    prisma.activity.findMany({
      where: { accountId, occurredAt: { gte: since90 } },
      select: {
        type: true, subject: true, bodyText: true, occurredAt: true,
        outcome: true, contact: { select: { fullName: true, jobTitle: true } },
        bodyJson: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 30,
    }),
    prisma.opportunity.findMany({
      where: { accountId, status: 'OPEN' },
      select: {
        name: true, stage: true, probability: true, estimatedValue: true,
        currency: true, expectedCloseDate: true, product: true, rating: true,
        nextActionDate: true, stageChangedAt: true,
      },
      orderBy: { estimatedValue: 'desc' },
      take: 5,
    }),
    prisma.opportunity.findMany({
      where: { accountId, status: { in: ['WON', 'LOST'] }, closedAt: { gte: since90 } },
      select: { name: true, status: true, estimatedValue: true, closedAt: true, lostReason: true },
      take: 5,
    }),
    prisma.contact.findMany({
      where: { accountId },
      select: {
        fullName: true, email: true, jobTitle: true,
        seniorityLevel: true, engagementScore: true,
      },
      orderBy: { engagementScore: 'desc' },
      take: 6,
    }),
    prisma.task.findMany({
      where: {
        accountId,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { title: true, status: true, priority: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 10,
    }),
  ]);

  const lines: string[] = [];
  lines.push(`# CUENTA: ${account.name}`);
  lines.push(`Owner: ${account.owner?.name ?? '—'}`);
  lines.push(`Status: ${account.status} · Priority: ${account.priority}`);
  lines.push(`Segment: ${account.segment ?? '—'} · Country: ${account.country ?? '—'} · Industry: ${account.industry ?? '—'}`);
  lines.push(`Counts: ${account._count.contacts} contactos · ${account._count.opportunities} opps · ${account._count.activities} activities`);
  if (account.description) lines.push(`Descripción: ${account.description.slice(0, 500)}`);
  if (account.offlineResearch) lines.push(`Indagaciones offline: ${account.offlineResearch.slice(0, 600)}`);
  if (account.internalNotes) lines.push(`Notas internas: ${account.internalNotes.slice(0, 400)}`);

  if (openOpps.length > 0) {
    lines.push(`\n## OPORTUNIDADES ABIERTAS`);
    for (const o of openOpps) {
      const v = o.estimatedValue ? `${o.currency} ${Number(o.estimatedValue).toLocaleString('es-MX')}` : 'sin valor';
      const close = o.expectedCloseDate ? new Date(o.expectedCloseDate).toISOString().slice(0, 10) : '—';
      const since = o.stageChangedAt ? Math.floor((Date.now() - o.stageChangedAt.getTime()) / (1000 * 60 * 60 * 24)) : null;
      lines.push(`- ${o.name} · stage=${o.stage} (${o.probability}%) · ${v} · cierre=${close} · producto=${o.product}${since !== null ? ` · ${since}d en stage` : ''}`);
    }
  }

  if (closedOpps.length > 0) {
    lines.push(`\n## CERRADAS (90d)`);
    for (const o of closedOpps) {
      const v = o.estimatedValue ? Number(o.estimatedValue).toLocaleString('es-MX') : '—';
      lines.push(`- ${o.name} · ${o.status}${o.lostReason ? ` (${o.lostReason})` : ''} · valor=${v}`);
    }
  }

  if (contacts.length > 0) {
    lines.push(`\n## CONTACTOS (top engagement)`);
    for (const c of contacts) {
      lines.push(`- ${c.fullName} · ${c.jobTitle ?? '—'} · ${c.seniorityLevel} · score=${c.engagementScore}/100`);
    }
  }

  if (openTasks.length > 0) {
    lines.push(`\n## TAREAS PENDIENTES`);
    for (const t of openTasks) {
      const d = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '—';
      const overdue = t.dueDate && t.dueDate < new Date() ? ' (VENCIDA)' : '';
      lines.push(`- ${t.title} · ${t.priority} · vence=${d}${overdue}`);
    }
  }

  if (recentActivities.length > 0) {
    lines.push(`\n## ACTIVIDADES RECIENTES (últimos 90d)`);
    for (const a of recentActivities) {
      const d = a.occurredAt.toISOString().slice(0, 10);
      const tracking = (() => {
        const j = a.bodyJson as { type?: string; tracking?: { openCount?: number; clickCount?: number; replyCount?: number } } | null;
        if (j?.type !== 'hs_email' || !j.tracking) return '';
        const t = j.tracking;
        const bits: string[] = [];
        if (t.openCount) bits.push(`opens=${t.openCount}`);
        if (t.clickCount) bits.push(`clicks=${t.clickCount}`);
        if (t.replyCount) bits.push(`replies=${t.replyCount}`);
        return bits.length ? ` [${bits.join(', ')}]` : '';
      })();
      const who = a.contact ? ` con ${a.contact.fullName}` : '';
      const outcome = a.outcome ? ` · outcome=${a.outcome}` : '';
      const snippet = (a.bodyText ?? '').slice(0, 120).replace(/\n/g, ' ');
      lines.push(`[${d}] ${a.type}${who}: ${a.subject}${tracking}${outcome}${snippet ? ` — ${snippet}` : ''}`);
    }
  }

  // Activity volume signal: emails sent/received last 30d.
  const last30 = recentActivities.filter((a) => a.occurredAt >= since30);
  const emailsSent = last30.filter((a) => a.type === 'EMAIL_SENT').length;
  const emailsReceived = last30.filter((a) => a.type === 'EMAIL_RECEIVED').length;
  const calls = last30.filter((a) => a.type === 'CALL').length;
  const meetings = last30.filter((a) => a.type === 'MEETING' || a.type === 'DEMO').length;
  lines.push(`\n## VOLUMEN ÚLTIMOS 30 DÍAS`);
  lines.push(`emails_enviados=${emailsSent} · emails_recibidos=${emailsReceived} · llamadas=${calls} · reuniones=${meetings}`);

  const context = lines.join('\n');
  return { context, bytes: context.length };
}

const SYSTEM = `Sos un analista comercial senior de SYSDE Internacional (B2B fintech, productos SAF+, FileMaster, Factoraje OnCloud, SYSDE Pensión, Sentinel/PLD). Te paso datos crudos de UNA cuenta y tenés que producir un briefing ejecutivo estructurado.

Reglas:
- Lenguaje: español de negocios, conciso, sin floritura.
- "headline" = 1-2 frases. Específico al status real, no genérico.
- "momentum" estricto: 'positivo' (señales claras de avance), 'neutro' (sin movimiento reciente), 'riesgo' (señales malas).
- "signals" = bullets de 5-7 items concretos (datos del input, no inventes).
- "risks" = problemas reales identificables. Si no hay, []
- "nextSteps" = 3-5 acciones accionables. Cada una con owner si está claro y horizonte ("esta semana" / "este mes").
- "rating" = grade de qualification: A (hot, listo para cierre), A- (avanzado), B+ (en juego), B (medio), B- (frío), C (improbable).
- NUNCA inventes hechos. Si los datos no alcanzan, decilo en headline.

Devolvé SÓLO JSON válido con la forma del schema. Sin texto antes ni después, sin code fences.`;

export async function generateAccountSummary(accountId: string): Promise<AccountSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY no está configurada. Agregala en Vercel env vars.');
  }
  const { context } = await buildContext(accountId);

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Analizá esta cuenta y devolveme JSON con: headline, momentum, signals, risks, nextSteps, rating.\n\n${context}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  // Strip code fences if Claude returned them anyway.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  let parsed: Partial<AccountSummary>;
  try {
    parsed = JSON.parse(cleaned) as Partial<AccountSummary>;
  } catch {
    throw new Error('Claude devolvió JSON inválido. Texto: ' + cleaned.slice(0, 200));
  }

  return {
    headline: parsed.headline ?? 'Sin contexto suficiente para resumir.',
    momentum:
      parsed.momentum === 'positivo' || parsed.momentum === 'riesgo'
        ? parsed.momentum
        : 'neutro',
    signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 8) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 6) : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.slice(0, 6) : [],
    rating: parsed.rating ?? 'B',
    generatedAt: new Date().toISOString(),
  };
}
