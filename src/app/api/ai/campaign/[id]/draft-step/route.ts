import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM = `Sos un copy writer senior B2B fintech para SYSDE Internacional.
Te paso el contexto de UNA campaña outbound y un PROMPT del usuario sobre qué tipo de paso quiere.
Devolvé SOLO JSON con { subject: string, body: string }.

Reglas para el body:
* 80-180 palabras max. Pareja con CTA claro al final.
* Tono profesional, directo, en español de negocios.
* Variables permitidas en el copy: {{firstName}}, {{company}}, {{country}}, {{senderName}}, {{product}}.
  Usá las que aporten — no fuerces todas.
* Evitá clichés ("Espero que esté bien", "ayudar a su empresa a crecer").
* Mencioná un beneficio específico al producto/segmento, no genérico.
* No uses bullets de markdown ni emojis.

Reglas para el subject:
* 30-60 caracteres.
* Sin emojis.
* No clickbait. Específico al beneficio o pregunta.

Respondé sólo el JSON, sin code fences, sin texto adicional.`;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY no configurada en Vercel.' },
      { status: 503 }
    );
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    intent?: string;
    stepName?: string;
    targetSeniority?: string[];
  };
  const intent = (body.intent ?? 'introducción').toString().slice(0, 200);
  const stepName = (body.stepName ?? '').toString().slice(0, 100);
  const targetSeniority = Array.isArray(body.targetSeniority) ? body.targetSeniority : [];

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: {
      name: true, code: true, description: true, type: true, goal: true,
      targetSegment: true, targetProduct: true, targetCountry: true,
    },
  });
  if (!campaign) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });

  const seniorityLabel: Record<string, string> = {
    OWNER: 'dueños / fundadores',
    C_LEVEL: 'C-level (CEO/CFO/CTO/COO)',
    VP: 'VPs',
    DIRECTOR: 'directores',
    MANAGER: 'gerentes',
    ANALYST: 'analistas / staff',
    UNKNOWN: 'audiencia mixta',
  };
  const audience = targetSeniority.length
    ? targetSeniority.map((s) => seniorityLabel[s] ?? s).join(', ')
    : 'todos los inscritos (mixto)';

  const ctxLines = [
    `Campaña: ${campaign.name}${campaign.code ? ` (${campaign.code})` : ''}`,
    `Tipo: ${campaign.type} · Goal: ${campaign.goal}`,
    `Target: ${campaign.targetSegment ?? 'sin segmento'}${
      campaign.targetCountry ? ' · ' + campaign.targetCountry : ''
    }${campaign.targetProduct?.length ? ' · ' + campaign.targetProduct.join(', ') : ''}`,
    `Audiencia del paso: ${audience}`,
    campaign.description ? `Descripción: ${campaign.description.slice(0, 500)}` : '',
    '',
    `Tipo de paso solicitado: ${intent}${stepName ? ` ("${stepName}")` : ''}`,
    targetSeniority.length
      ? `Adaptá el copy específicamente al perfil ${audience}: tono, ángulo de valor, jerga.`
      : '',
  ].filter(Boolean).join('\n');

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: SYSTEM,
    messages: [
      { role: 'user', content: ctxLines },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');

  let parsed: { subject?: string; body?: string };
  try {
    parsed = JSON.parse(text) as { subject?: string; body?: string };
  } catch {
    return NextResponse.json({ error: 'Respuesta IA inválida', raw: text.slice(0, 200) }, { status: 502 });
  }
  return NextResponse.json({ ok: true, subject: parsed.subject ?? '', body: parsed.body ?? '' });
}
