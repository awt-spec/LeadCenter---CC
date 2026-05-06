import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  getExecKPIs,
  getTopWonDeals,
  getDealsAtRisk,
  getTopPerformers,
  periodRange,
  type ExecPeriod,
} from '@/lib/reports/exec-queries';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `Sos analista comercial senior de LeadCenter, el CRM B2B de SYSDE Internacional (proveedor de software financiero/core bancario en Latam).

Recibís métricas de cierre de un período y generás un BRIEF EJECUTIVO en español neutro, profesional, accionable.

Salida: SOLO JSON, sin code fences, con esta estructura:
{
  "headline": "1 frase corta (max 90 chars) que captura el período. Ej: 'Cuarta semana fuerte: USD 1.2M cerrados, win-rate 62%'.",
  "summary": "2-3 párrafos (250-400 palabras total). Hablá del volumen cerrado, win-rate, qué stages traccionaron, riesgos del pipeline. NO repetir números crudos; transmitir patrón. Si vino delta vs período anterior, contextualizá.",
  "wins": [
    "3-5 bullets cortos: top deals ganados, performers destacados, milestones."
  ],
  "risks": [
    "0-4 bullets: deals at-risk, win-rate cayendo, performers fuera de patrón, pipeline débil para próximo período. Vacío [] si no hay nada serio."
  ],
  "recommendations": [
    "2-4 bullets ACCIONABLES: 'Acelerar deal X', 'Revisar pipeline de Juan', 'Reforzar etapa NEGOCIATION'. Concretos, dirigidos a un líder comercial."
  ]
}

Reglas:
- Tono profesional, directo. Sin emojis, sin alarmismo.
- Si dataset es chico (<3 deals cerrados), reconocelo: "Período de bajo volumen…".
- NO inventes nombres ni montos: usá los que te paso.
- Pesos en MILES o MILLONES con 1 decimal ("USD 1.2M", "USD 47k"). NO escribir "1234567".`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'reports:read:all') && !can(session, 'reports:read:own')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY no configurada en este entorno.' },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { period?: ExecPeriod };
  const period: ExecPeriod = (body.period as ExecPeriod) || 'week';
  const range = periodRange(period);

  const [kpis, topWon, atRisk, performers] = await Promise.all([
    getExecKPIs(range),
    getTopWonDeals(range, 5),
    getDealsAtRisk(14, 5),
    getTopPerformers(range, 5),
  ]);

  const fmtUSD = (n: number) =>
    n >= 1_000_000 ? `USD ${(n / 1_000_000).toFixed(2)}M` : `USD ${(n / 1000).toFixed(1)}k`;

  const promptData = {
    period: { kind: period, label: range.label, start: range.start, end: range.end },
    kpis: {
      pipelineTotal: fmtUSD(kpis.pipelineTotal),
      pipelineWeighted: fmtUSD(kpis.pipelineWeighted),
      openCount: kpis.openCount,
      wonValue: fmtUSD(kpis.wonValue),
      wonCount: kpis.wonCount,
      lostValue: fmtUSD(kpis.lostValue),
      lostCount: kpis.lostCount,
      newDeals: kpis.newDealsCount,
      winRate: `${kpis.winRate.toFixed(1)}%`,
      avgDealSize: fmtUSD(kpis.avgDealSize),
      avgCycleDays: Math.round(kpis.avgCycleDays),
      activities: kpis.activitiesCount,
      delta_pct: {
        wonValue: kpis.deltaWonValue,
        wonCount: kpis.deltaWonCount,
        winRate: kpis.deltaWinRate,
        newDeals: kpis.deltaNewDeals,
        activities: kpis.deltaActivities,
      },
    },
    topWonDeals: topWon.map((d) => ({
      account: d.account.name,
      name: d.name,
      value: d.value ? fmtUSD(d.value) : null,
      owner: d.owner?.name ?? null,
      closedAt: d.closedAt?.toISOString().slice(0, 10),
    })),
    dealsAtRisk: atRisk.map((d) => ({
      account: d.account.name,
      name: d.name,
      stage: d.stage,
      daysInStage: d.daysInStage,
      value: d.value ? fmtUSD(d.value) : null,
      owner: d.owner?.name ?? null,
    })),
    topPerformers: performers.map((p) => ({
      name: p.name,
      wonValue: fmtUSD(p.wonValue),
      wonCount: p.wonCount,
      pipelineValue: fmtUSD(p.pipelineValue),
      activities: p.activities,
    })),
  };

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Métricas del período:\n\n${JSON.stringify(promptData, null, 2)}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  let parsed: {
    headline: string;
    summary: string;
    wins: string[];
    risks: string[];
    recommendations: string[];
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Claude devolvió JSON inválido.', raw: cleaned.slice(0, 200) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    period,
    range: { start: range.start.toISOString(), end: range.end.toISOString(), label: range.label },
    headline: String(parsed.headline ?? ''),
    summary: String(parsed.summary ?? ''),
    wins: Array.isArray(parsed.wins) ? parsed.wins.map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : [],
    generatedAt: new Date().toISOString(),
  });
}
