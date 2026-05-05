// AI-driven C.O.C. drafter. Pulls the same comprehensive context as the
// account summary (tasks, emails, opportunities, contacts, activities) PLUS
// the existing C.O.C. content, and asks Claude to produce a draft for one of:
//
// - 'strategy' → { headline, strategy, goals, risks, nextSteps }
// - 'version'  → { body } for a specific audience
//
// Output is JSON validated against the requested shape so the UI can drop it
// straight into the form fields.

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import type { Audience } from './schemas';
import { AUDIENCE_LABELS, AUDIENCE_DESCRIPTIONS } from './schemas';

export type DraftTarget = 'strategy' | 'version';

export interface StrategyDraft {
  headline: string | null;
  strategy: string | null;
  goals: string | null;
  risks: string | null;
  nextSteps: string | null;
}

export interface VersionDraft {
  body: string;
}

async function buildAccountContext(accountId: string): Promise<string> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      id: true, name: true, domain: true, status: true, priority: true,
      country: true, segment: true, industry: true, size: true,
      description: true, internalNotes: true, offlineResearch: true,
      annualRevenue: true, currency: true, employeeCount: true,
      owner: { select: { name: true, email: true } },
      _count: { select: { contacts: true, opportunities: true, activities: true } },
    },
  });
  if (!account) throw new Error('Cuenta no encontrada');

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  const [activities, openOpps, closedOpps, contacts, openTasks, doneTasks, sharedCtx] = await Promise.all([
    prisma.activity.findMany({
      where: { accountId, occurredAt: { gte: since180 } },
      select: {
        type: true, subject: true, bodyText: true, occurredAt: true,
        outcome: true,
        contact: { select: { fullName: true, jobTitle: true } },
        bodyJson: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    }),
    prisma.opportunity.findMany({
      where: { accountId, status: 'OPEN' },
      select: {
        name: true, stage: true, probability: true, estimatedValue: true,
        currency: true, expectedCloseDate: true, product: true, rating: true,
        nextActionDate: true, stageChangedAt: true, description: true,
      },
      orderBy: { estimatedValue: 'desc' },
      take: 8,
    }),
    prisma.opportunity.findMany({
      where: { accountId, status: { in: ['WON', 'LOST'] } },
      select: {
        name: true, status: true, estimatedValue: true, currency: true,
        closedAt: true, lostReason: true, product: true,
      },
      orderBy: { closedAt: 'desc' },
      take: 8,
    }),
    prisma.contact.findMany({
      where: { accountId },
      select: {
        fullName: true, email: true, jobTitle: true,
        seniorityLevel: true, engagementScore: true,
      },
      orderBy: { engagementScore: 'desc' },
      take: 10,
    }),
    prisma.task.findMany({
      where: { accountId, status: { notIn: ['DONE', 'CANCELLED'] } },
      select: { title: true, description: true, status: true, priority: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 15,
    }),
    prisma.task.findMany({
      where: { accountId, status: 'DONE' },
      select: { title: true, description: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    prisma.sharedContext.findUnique({
      where: { accountId },
      include: {
        versions: {
          select: { audience: true, body: true, updatedAt: true },
        },
        links: {
          select: { title: true, url: true, type: true, audience: true, description: true },
          orderBy: { position: 'asc' },
        },
      },
    }),
  ]);

  const lines: string[] = [];
  lines.push(`# CUENTA: ${account.name}`);
  lines.push(`Owner: ${account.owner?.name ?? '—'} (${account.owner?.email ?? '—'})`);
  lines.push(`Status: ${account.status} · Priority: ${account.priority}`);
  lines.push(`Segment: ${account.segment ?? '—'} · Country: ${account.country ?? '—'} · Industry: ${account.industry ?? '—'}`);
  if (account.annualRevenue) lines.push(`Revenue anual: ${account.currency} ${Number(account.annualRevenue).toLocaleString('es-MX')}`);
  if (account.employeeCount) lines.push(`Empleados: ${account.employeeCount.toLocaleString('es-MX')}`);
  lines.push(`Counts: ${account._count.contacts} contactos · ${account._count.opportunities} opps · ${account._count.activities} activities`);
  if (account.description) lines.push(`\nDescripción: ${account.description.slice(0, 800)}`);
  if (account.offlineResearch) lines.push(`\nIndagaciones offline: ${account.offlineResearch.slice(0, 800)}`);
  if (account.internalNotes) lines.push(`\nNotas internas: ${account.internalNotes.slice(0, 600)}`);

  if (openOpps.length > 0) {
    lines.push(`\n## OPORTUNIDADES ABIERTAS`);
    for (const o of openOpps) {
      const v = o.estimatedValue ? `${o.currency} ${Number(o.estimatedValue).toLocaleString('es-MX')}` : 'sin valor';
      const close = o.expectedCloseDate ? new Date(o.expectedCloseDate).toISOString().slice(0, 10) : '—';
      const since = o.stageChangedAt ? Math.floor((Date.now() - o.stageChangedAt.getTime()) / 86_400_000) : null;
      lines.push(`- ${o.name} · stage=${o.stage} (${o.probability}%) · ${v} · cierre=${close} · producto=${o.product}${since !== null ? ` · ${since}d en stage` : ''}`);
      if (o.description) lines.push(`    descripción: ${o.description.slice(0, 200)}`);
    }
  }

  if (closedOpps.length > 0) {
    lines.push(`\n## OPORTUNIDADES PASADAS (cerradas, hasta 8 más recientes)`);
    for (const o of closedOpps) {
      const v = o.estimatedValue ? `${o.currency} ${Number(o.estimatedValue).toLocaleString('es-MX')}` : '—';
      const closed = o.closedAt ? new Date(o.closedAt).toISOString().slice(0, 10) : '—';
      lines.push(`- ${o.name} · ${o.status} · ${v} · cerrada=${closed} · producto=${o.product}${o.lostReason ? ` · razón=${o.lostReason}` : ''}`);
    }
  }

  if (contacts.length > 0) {
    lines.push(`\n## CONTACTOS CLAVE (top engagement)`);
    for (const c of contacts) {
      lines.push(`- ${c.fullName} · ${c.jobTitle ?? '—'} · ${c.seniorityLevel} · score=${c.engagementScore}/100`);
    }
  }

  if (openTasks.length > 0) {
    lines.push(`\n## TAREAS PENDIENTES`);
    for (const t of openTasks) {
      const d = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : 'sin fecha';
      const overdue = t.dueDate && t.dueDate < new Date() ? ' [VENCIDA]' : '';
      lines.push(`- ${t.title} · ${t.priority} · vence=${d}${overdue}`);
      if (t.description) lines.push(`    ${t.description.slice(0, 160)}`);
    }
  }

  if (doneTasks.length > 0) {
    lines.push(`\n## TAREAS COMPLETADAS (recientes)`);
    for (const t of doneTasks) {
      const d = t.completedAt ? new Date(t.completedAt).toISOString().slice(0, 10) : '—';
      lines.push(`- [${d}] ${t.title}${t.description ? ` — ${t.description.slice(0, 120)}` : ''}`);
    }
  }

  if (activities.length > 0) {
    lines.push(`\n## ACTIVIDADES Y EMAILS (últimos 180d, hasta 50)`);
    for (const a of activities) {
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
      const snippet = (a.bodyText ?? '').slice(0, 200).replace(/\s+/g, ' ').trim();
      lines.push(`[${d}] ${a.type}${who}: ${a.subject}${tracking}${outcome}${snippet ? ` — ${snippet}` : ''}`);
    }
  }

  // Volume signal — last 30 days.
  const last30 = activities.filter((a) => a.occurredAt >= since30);
  const emailsSent = last30.filter((a) => a.type === 'EMAIL_SENT').length;
  const emailsReceived = last30.filter((a) => a.type === 'EMAIL_RECEIVED').length;
  const calls = last30.filter((a) => a.type === 'CALL').length;
  const meetings = last30.filter((a) => a.type === 'MEETING' || a.type === 'DEMO').length;
  lines.push(`\n## VOLUMEN ÚLTIMOS 30 DÍAS`);
  lines.push(`emails_enviados=${emailsSent} · emails_recibidos=${emailsReceived} · llamadas=${calls} · reuniones=${meetings}`);

  if (sharedCtx) {
    lines.push(`\n## C.O.C. EXISTENTE (no la repitas, expandí o ajustá)`);
    if (sharedCtx.headline) lines.push(`Headline: ${sharedCtx.headline}`);
    if (sharedCtx.strategy) lines.push(`\nEstrategia actual:\n${sharedCtx.strategy.slice(0, 1500)}`);
    if (sharedCtx.goals) lines.push(`\nGoals:\n${sharedCtx.goals.slice(0, 800)}`);
    if (sharedCtx.risks) lines.push(`\nRiesgos:\n${sharedCtx.risks.slice(0, 800)}`);
    if (sharedCtx.nextSteps) lines.push(`\nPróximos pasos:\n${sharedCtx.nextSteps.slice(0, 800)}`);
    if (sharedCtx.versions.length > 0) {
      lines.push(`\nVersiones por audiencia ya escritas:`);
      for (const v of sharedCtx.versions) {
        if (v.body) lines.push(`- ${v.audience}: ${v.body.slice(0, 400).replace(/\s+/g, ' ')}`);
      }
    }
    if (sharedCtx.links.length > 0) {
      lines.push(`\nRecursos vinculados:`);
      for (const l of sharedCtx.links.slice(0, 10)) {
        lines.push(`- ${l.type} · ${l.title}${l.audience ? ` (${l.audience})` : ''}: ${l.url}`);
      }
    }
  }

  return lines.join('\n');
}

const SYSTEM_STRATEGY = `Sos un VP de Ventas senior de SYSDE Internacional (B2B fintech LATAM, productos SAF+, FileMaster, Factoraje OnCloud, SYSDE Pensión, Sentinel/PLD). Te paso el contexto crudo de UNA cuenta: tareas, emails, oportunidades pasadas y abiertas, actividades, notas. Tu trabajo es producir una ESTRATEGIA COMPARTIDA accionable para que todo el equipo de LeadCenter sepa cómo ganar la cuenta.

Reglas:
- Lenguaje: español de negocios LATAM, conciso, accionable, sin floritura.
- Basate sólo en los datos del input. NO inventes.
- "headline" = 1 frase potente que sintetiza el play (max 200 chars).
- "strategy" = 3-6 párrafos cortos. Por qué entramos por X, quién es nuestro aliado interno, qué palancas usamos, cómo vencemos al incumbente si lo hay.
- "goals" = bullets con KPIs concretos y fechas (basate en cierres esperados de las opps).
- "risks" = bullets de riesgos REALES (compettencia, presupuesto, churn, política interna).
- "nextSteps" = 3-6 acciones priorizadas con owner si está claro y horizonte.
- Si los datos no dan para una sección, devolvé null en ese campo (no inventes).

Devolvé SÓLO JSON con esta forma exacta:
{
  "headline": "string o null",
  "strategy": "string multilínea o null",
  "goals": "string multilínea o null",
  "risks": "string multilínea o null",
  "nextSteps": "string multilínea o null"
}

Sin texto antes ni después, sin code fences.`;

const SYSTEM_VERSION = (audience: Audience) => `Sos un comercial senior de SYSDE Internacional (B2B fintech LATAM). Te paso el contexto crudo de UNA cuenta y la estrategia interna actual. Tu trabajo es producir el cuerpo de la "versión ${AUDIENCE_LABELS[audience]}" de la C.O.C. (Contexto Organizacional Compartido).

Audiencia objetivo: ${AUDIENCE_LABELS[audience]} — ${AUDIENCE_DESCRIPTIONS[audience]}

Reglas según audiencia:
- INTERNAL: máxima riqueza, incluí política interna, players, lo que NO contamos al cliente, supuestos, hipótesis no validadas. 250-600 palabras.
- PROSPECT: lo que le mostramos al cliente. Cero pricing interno, cero notas confidenciales. Tono profesional, propositivo. 200-400 palabras.
- FINANCE: pricing, modelo comercial, ROI esperado, condiciones, riesgo crediticio del cliente. 150-350 palabras.
- TECHNICAL: stack actual del cliente, integraciones, supuestos de migración, dependencias técnicas. 150-400 palabras.
- EXECUTIVE: 1-pager para leadership. Por qué vale la pena, cuánto, cuándo, riesgo, qué necesitamos. Máximo 250 palabras.

Reglas generales:
- Lenguaje español de negocios LATAM.
- Basate SOLO en los datos del input. NO inventes hechos, números, ni nombres.
- Si no hay info suficiente para esta audiencia, devolvé un body honesto que diga qué falta.
- Markdown ligero (negritas, bullets) está permitido.

Devolvé SÓLO JSON con esta forma:
{ "body": "string multilínea con el contenido completo" }

Sin texto antes ni después, sin code fences.`;

function parseJsonStrict<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error('Claude devolvió JSON inválido. Texto inicial: ' + cleaned.slice(0, 200));
  }
}

async function callClaude(system: string, userMessage: string, maxTokens: number): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada.');
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

export async function draftStrategy(accountId: string): Promise<StrategyDraft> {
  const context = await buildAccountContext(accountId);
  const text = await callClaude(
    SYSTEM_STRATEGY,
    `Generá la estrategia compartida para esta cuenta basándote en los datos crudos:\n\n${context}`,
    2500
  );
  const parsed = parseJsonStrict<Partial<StrategyDraft>>(text);
  return {
    headline: trimOrNull(parsed.headline),
    strategy: trimOrNull(parsed.strategy),
    goals: trimOrNull(parsed.goals),
    risks: trimOrNull(parsed.risks),
    nextSteps: trimOrNull(parsed.nextSteps),
  };
}

export async function draftVersion(accountId: string, audience: Audience): Promise<VersionDraft> {
  const context = await buildAccountContext(accountId);
  const text = await callClaude(
    SYSTEM_VERSION(audience),
    `Generá el cuerpo de la versión "${AUDIENCE_LABELS[audience]}" de la C.O.C. basándote en estos datos crudos:\n\n${context}`,
    2500
  );
  const parsed = parseJsonStrict<Partial<VersionDraft>>(text);
  return { body: typeof parsed.body === 'string' ? parsed.body.trim() : '' };
}

function trimOrNull(s: string | null | undefined): string | null {
  if (typeof s !== 'string') return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}
