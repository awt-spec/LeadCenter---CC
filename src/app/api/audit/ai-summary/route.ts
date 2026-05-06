import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import {
  getAuditStatsWithDeltas,
  getTopUsers,
  getResourceBreakdown,
  listAuditLog,
} from '@/lib/audit/queries';
import {
  getUserBaselines,
  getDayCountsForUsers,
  flagAnomalies,
  ANOMALY_LABEL,
} from '@/lib/audit/anomalies';

export const runtime = 'nodejs';
export const maxDuration = 60;

type AISummaryResponse = {
  ok: true;
  summary: string;
  highlights: string[];
  risks: string[];
  generatedAt: string;
};

const SYSTEM = `Sos un analista de seguridad y operaciones para LeadCenter, el CRM B2B de SYSDE Internacional.

Recibís stats de un audit log y producís un resumen ejecutivo CONCISO, accionable, en español neutro.

Salida estricta — JSON con esta forma:
{
  "summary": "1-2 párrafos de 80-150 palabras sobre qué pasó en el período. Hablá del volumen, los actores principales y los recursos más tocados. NO repetir números crudos; transmitir patrón.",
  "highlights": [
    "3-5 bullets cortos de cosas notables: 'Juan generó 47% del volumen', 'el lunes hubo un pico de 3x el promedio', etc."
  ],
  "risks": [
    "0-4 bullets de cosas que un admin debería revisar: ráfagas de delete, accesos a horas raras, escalamientos de permisos, usuarios fuera de patrón. Si no hay riesgos reales, dejar el array vacío []."
  ]
}

Reglas:
- Sin texto fuera del JSON. Sin code fences.
- Usá los datos reales que te paso. NO inventes nombres ni números.
- Tono profesional, directo, sin alarmismo. El admin valora cuando le decís "todo dentro de patrón".`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!can(session, 'audit:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'ANTHROPIC_API_KEY no está configurada en este entorno.' },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    dateFrom?: string;
    dateTo?: string;
  };

  // Cargamos lo necesario para el prompt en paralelo.
  const [stats, topUsers, resourceBreakdown, recentEvents] = await Promise.all([
    getAuditStatsWithDeltas(),
    getTopUsers(7, 8),
    getResourceBreakdown(7),
    listAuditLog({
      page: 1,
      pageSize: 200,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    }),
  ]);

  // Computar anomalías sobre la muestra para enriquecer el prompt.
  const userIds = [...new Set(recentEvents.rows.map((r) => r.userId).filter(Boolean) as string[])];
  const [baselines, todayCounts] = await Promise.all([
    getUserBaselines(userIds, 30),
    getDayCountsForUsers(userIds),
  ]);
  const anomalies = flagAnomalies(recentEvents.rows, baselines, todayCounts);

  const anomalyCounts: Record<string, number> = {};
  for (const flags of anomalies.values()) {
    for (const f of flags) {
      anomalyCounts[f.kind] = (anomalyCounts[f.kind] ?? 0) + 1;
    }
  }

  // Top eventos sospechosos para incluir en el prompt
  const suspicious = recentEvents.rows
    .filter((r) => (anomalies.get(r.id)?.length ?? 0) > 0)
    .slice(0, 20)
    .map((r) => ({
      when: r.createdAt.toISOString(),
      user: r.user?.name ?? r.user?.email ?? 'sistema',
      action: r.action,
      resource: r.resource,
      flags: anomalies.get(r.id)?.map((f) => ANOMALY_LABEL[f.kind]) ?? [],
    }));

  const promptData = {
    period: {
      dateFrom: body.dateFrom ?? 'últimos 7d',
      dateTo: body.dateTo ?? 'ahora',
    },
    stats: {
      total24h: stats.total24h,
      total7d: stats.total7d,
      total30d: stats.total30d,
      uniqueUsers30d: stats.uniqueUsers30d,
      delta24h_pct: stats.delta24h,
      delta7d_pct: stats.delta7d,
      delta30d_pct: stats.delta30d,
      topAction: stats.topAction,
      topResource: stats.topResource,
    },
    topUsers7d: topUsers.map((u) => ({ name: u.name, count: u.count })),
    resourceBreakdown7d: resourceBreakdown.slice(0, 10),
    anomalyCounts,
    suspicious,
  };

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Datos de auditoría:\n\n${JSON.stringify(promptData, null, 2)}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');

  let parsed: { summary: string; highlights: string[]; risks: string[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Claude devolvió JSON inválido.',
        raw: cleaned.slice(0, 200),
      },
      { status: 500 }
    );
  }

  const response: AISummaryResponse = {
    ok: true,
    summary: String(parsed.summary ?? ''),
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json(response);
}
