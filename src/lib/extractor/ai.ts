// AI bridge — translate natural language into an ExtractorConfig using
// Claude. The schema is passed as the system prompt so the model can only
// produce field names that actually exist in our data model.

import Anthropic from '@anthropic-ai/sdk';
import { ENTITIES, OPS_BY_TYPE, type ExtractorConfig } from './schema';

function buildSchemaPrompt(): string {
  const lines: string[] = [];
  for (const [key, entity] of Object.entries(ENTITIES)) {
    lines.push(`\n### Entidad: ${key} (${entity.label})`);
    for (const [fieldKey, def] of Object.entries(entity.fields)) {
      const ops = OPS_BY_TYPE[def.type].join(', ');
      const opts = def.options ? ` · valores: ${def.options.map((o) => o.value).join(', ')}` : '';
      lines.push(`- ${fieldKey} · ${def.label} · type=${def.type}${opts} · ops permitidos: ${ops}`);
    }
  }
  return lines.join('\n');
}

const SYSTEM = `Sos el motor de extracción de LeadCenter (CRM B2B fintech para SYSDE Internacional).
Recibís una descripción en lenguaje natural y devolvés un JSON con la configuración exacta del extractor.

Schema disponible (usá SOLAMENTE entidades, fields y operadores listados):
${buildSchemaPrompt()}

Reglas:
- Devolvé SÓLO JSON válido con esta forma:
  {
    "entity": "<key>",
    "filters": [{ "field": "<key>", "op": "<op>", "value": <scalar | array> }],
    "columns": ["<key>", ...],
    "orderBy": { "field": "<key>", "dir": "asc" | "desc" },
    "limit": <number>
  }
- "entity" debe ser una de las claves de entidades.
- "field" en filters/columns/orderBy debe ser una clave existente de la entidad elegida.
- "op" debe estar en la lista de ops permitidos del tipo del campo.
- Para fechas relativas como "este año", "últimos 90 días", "este trimestre",
  resolvé a fechas concretas en formato ISO YYYY-MM-DD usando "today" como
  referencia. La fecha de hoy te la paso al final del prompt.
- Para enums, usá el VALUE técnico (ej. "WON" no "Ganado").
- "limit" por default 200, máximo 1000.
- "columns" no debe estar vacío — incluí los más relevantes para la consulta
  (mínimo 4, máximo 10).
- Si la consulta es ambigua, asumí lo más razonable y dejá una nota — pero
  el output sigue siendo SÓLO JSON.

Sin texto antes ni después del JSON. Sin code fences.`;

export async function buildConfigFromPrompt(prompt: string): Promise<ExtractorConfig> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada');
  const today = new Date().toISOString().slice(0, 10);

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      { role: 'user', content: `Hoy es ${today}.\n\nConsulta: ${prompt}` },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  let parsed: ExtractorConfig;
  try {
    parsed = JSON.parse(cleaned) as ExtractorConfig;
  } catch {
    throw new Error('Claude devolvió JSON inválido. Texto: ' + cleaned.slice(0, 200));
  }

  // Basic validation against the schema — drop anything not in the entity.
  const entity = ENTITIES[parsed.entity];
  if (!entity) throw new Error(`Entidad desconocida: ${parsed.entity}`);
  parsed.filters = (parsed.filters ?? []).filter((f) => f.field in entity.fields && OPS_BY_TYPE[entity.fields[f.field].type].includes(f.op));
  parsed.columns = (parsed.columns ?? []).filter((c) => c in entity.fields);
  if (parsed.columns.length === 0) parsed.columns = entity.defaultColumns;
  if (!parsed.orderBy || !(parsed.orderBy.field in entity.fields)) {
    parsed.orderBy = entity.defaultOrder;
  }
  parsed.limit = Math.min(Math.max(parsed.limit ?? 200, 1), 1000);
  return parsed;
}

export interface AIInsights {
  headline: string;
  bullets: string[];
}

/// Optional AI summary of result rows. Sends a sample to Claude and asks
/// for 3-5 takeaways relevant to the query.
export async function summariseResults(
  prompt: string,
  rows: Record<string, unknown>[],
  columns: string[]
): Promise<AIInsights> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada');
  const sample = rows.slice(0, 80);
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 700,
    system: `Sos un analista comercial senior B2B fintech. Te paso una consulta del usuario y un sample (hasta 80 filas) del resultado. Devolvé JSON con:
{
  "headline": "1 frase con el insight principal (max 200 chars)",
  "bullets": ["3-5 bullets de takeaways concretos basados en los datos"]
}
- Lenguaje español de negocios LATAM, conciso.
- Basate sólo en los datos del input. NO inventes.
- Sin texto fuera del JSON. Sin code fences.`,
    messages: [
      { role: 'user', content: `Consulta: ${prompt}\n\nColumnas: ${columns.join(', ')}\n\nDatos (sample de ${sample.length} filas):\n${JSON.stringify(sample, null, 2).slice(0, 12000)}` },
    ],
  });
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text).join('').trim();
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return JSON.parse(cleaned) as AIInsights;
}
