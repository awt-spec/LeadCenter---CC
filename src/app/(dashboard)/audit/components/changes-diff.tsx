import type { Prisma } from '@prisma/client';

/**
 * Renderiza `changes` JSON como un diff before/after legible.
 *
 * Formatos soportados:
 *   1. `{ field: { before: X, after: Y } }`           (formato estándar)
 *   2. `{ field: { from: X, to: Y } }`                (alias frecuente)
 *   3. `{ field: [oldVal, newVal] }`                  (formato par)
 *   4. `{ before: {...}, after: {...} }`              (snapshot completo)
 *   5. Cualquier otro JSON                           → fallback raw
 *
 * Si no se reconoce el formato cae a `<pre>` con el JSON crudo.
 */

type Change = { field: string; before: unknown; after: unknown };

function parseChanges(changes: Prisma.JsonValue | null): Change[] | null {
  if (changes === null || typeof changes !== 'object' || Array.isArray(changes)) return null;

  const obj = changes as Record<string, unknown>;

  // Formato 4: snapshot completo
  if (
    Object.keys(obj).length === 2 &&
    'before' in obj &&
    'after' in obj &&
    typeof obj.before === 'object' &&
    typeof obj.after === 'object'
  ) {
    const before = obj.before as Record<string, unknown>;
    const after = obj.after as Record<string, unknown>;
    const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    const out: Change[] = [];
    for (const f of fields) {
      if (JSON.stringify(before?.[f]) !== JSON.stringify(after?.[f])) {
        out.push({ field: f, before: before?.[f], after: after?.[f] });
      }
    }
    return out.length ? out : null;
  }

  // Formatos 1-3: por campo
  const out: Change[] = [];
  for (const [field, val] of Object.entries(obj)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const v = val as Record<string, unknown>;
      if ('before' in v && 'after' in v) {
        out.push({ field, before: v.before, after: v.after });
        continue;
      }
      if ('from' in v && 'to' in v) {
        out.push({ field, before: v.from, after: v.to });
        continue;
      }
    }
    if (Array.isArray(val) && val.length === 2) {
      out.push({ field, before: val[0], after: val[1] });
      continue;
    }
    return null; // formato no reconocido → caer a raw
  }
  return out.length ? out : null;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function ChangesDiff({ changes }: { changes: Prisma.JsonValue | null }) {
  if (!changes) return null;
  const parsed = parseChanges(changes);

  if (!parsed) {
    return (
      <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-sysde-gray bg-sysde-bg p-2 rounded">
        {JSON.stringify(changes, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-1.5">
      {parsed.map((c) => (
        <div key={c.field} className="text-[11px] grid grid-cols-[100px_1fr] gap-2 items-start">
          <div className="font-mono text-sysde-mid truncate" title={c.field}>
            {c.field}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-start gap-1">
              <span className="text-red-500 font-mono shrink-0">−</span>
              <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded line-through opacity-70 break-words">
                {formatValue(c.before)}
              </span>
            </div>
            <div className="flex items-start gap-1">
              <span className="text-green-600 font-mono shrink-0">+</span>
              <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded break-words">
                {formatValue(c.after)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
