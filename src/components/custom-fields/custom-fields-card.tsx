import { Card } from '@/components/ui/card';
import { Settings2 } from 'lucide-react';
import Link from 'next/link';
import {
  getCustomFieldsForRecord,
} from '@/lib/custom-fields/queries';
import type { CustomFieldEntity } from '@/lib/custom-fields/schemas';

function formatValue(raw: unknown, type: string): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  switch (type) {
    case 'BOOLEAN':
      return raw ? 'Sí' : 'No';
    case 'NUMBER': {
      const n = Number(raw);
      if (!isFinite(n)) return null;
      return n.toLocaleString('es-CR');
    }
    case 'DATE':
      try {
        const d = new Date(raw as string);
        if (isNaN(d.getTime())) return String(raw);
        return d.toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch {
        return String(raw);
      }
    case 'MULTI_SELECT':
      return Array.isArray(raw) ? (raw as string[]).join(', ') : String(raw);
    case 'URL':
      return String(raw);
    default:
      return String(raw);
  }
}

export async function CustomFieldsCard({
  entity,
  recordId,
}: {
  entity: CustomFieldEntity;
  recordId: string;
}) {
  const { definitions, values } = await getCustomFieldsForRecord(entity, recordId);
  if (definitions.length === 0) return null;

  const valueByField = new Map(values.map((v) => [v.fieldId, v.value]));

  // Only show populated fields + always show all if record has none populated
  const populated = definitions
    .map((def) => {
      const raw = valueByField.get(def.id) as { v: unknown } | undefined;
      const formatted = formatValue(raw?.v, def.type);
      return { def, raw: raw?.v, formatted };
    })
    .filter((row) => row.formatted !== null);

  if (populated.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[11px] font-semibold uppercase tracking-wider text-sysde-mid">
          Campos personalizados
        </h3>
        <Link
          href="/settings/custom-fields"
          className="inline-flex items-center gap-1 text-[11px] text-sysde-mid hover:text-sysde-red"
          title="Editar campos"
        >
          <Settings2 className="h-3 w-3" />
          Editar
        </Link>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {populated.map(({ def, formatted, raw }) => (
          <div key={def.id}>
            <dt className="text-[10px] uppercase tracking-wide text-sysde-mid">
              {def.label}
            </dt>
            <dd className="mt-0.5 text-sm font-medium text-sysde-gray">
              {def.type === 'URL' && typeof raw === 'string' ? (
                <a
                  href={raw}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sysde-red hover:underline break-all"
                >
                  {formatted}
                </a>
              ) : def.type === 'LONG_TEXT' ? (
                <p className="whitespace-pre-wrap text-sm">{formatted}</p>
              ) : (
                <span className="break-words">{formatted}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
