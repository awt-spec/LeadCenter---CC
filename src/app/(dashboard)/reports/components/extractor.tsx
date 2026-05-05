'use client';

import { useState } from 'react';
import {
  Sparkles, Play, Plus, X, Download, Loader2, Database, Filter, Columns3, ArrowDown, ArrowUp, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ENTITIES, OPS_BY_TYPE, OP_LABELS, makeDefaultConfig,
  type ExtractorConfig, type FilterRow, type Operator,
} from '@/lib/extractor/schema';

interface AIInsights { headline: string; bullets: string[] }

export function Extractor() {
  const [config, setConfig] = useState<ExtractorConfig>(makeDefaultConfig('opportunities'));
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiBuilding, setAiBuilding] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const entity = ENTITIES[config.entity];

  function setEntity(key: string) {
    setConfig(makeDefaultConfig(key as never));
    setRows(null);
    setInsights(null);
  }

  function addFilter() {
    const firstField = Object.keys(entity.fields)[0];
    const def = entity.fields[firstField];
    setConfig({
      ...config,
      filters: [...config.filters, { field: firstField, op: OPS_BY_TYPE[def.type][0], value: '' }],
    });
  }

  function updateFilter(i: number, patch: Partial<FilterRow>) {
    const next = [...config.filters];
    next[i] = { ...next[i], ...patch };
    // If field changed, default the op to a valid one for the new type.
    if ('field' in patch && patch.field) {
      const def = entity.fields[patch.field];
      if (def && !OPS_BY_TYPE[def.type].includes(next[i].op)) {
        next[i].op = OPS_BY_TYPE[def.type][0];
        next[i].value = '';
      }
    }
    setConfig({ ...config, filters: next });
  }

  function removeFilter(i: number) {
    setConfig({ ...config, filters: config.filters.filter((_, j) => j !== i) });
  }

  function toggleColumn(col: string) {
    const has = config.columns.includes(col);
    setConfig({
      ...config,
      columns: has ? config.columns.filter((c) => c !== col) : [...config.columns, col],
    });
  }

  async function runAi() {
    if (!aiPrompt.trim()) return;
    setAiBuilding(true);
    setInsights(null);
    try {
      const res = await fetch('/api/extractor/ai-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; config?: ExtractorConfig; error?: string };
      if (!res.ok || !json.ok || !json.config) {
        toast.error(json.error ?? 'No se pudo armar la consulta');
        return;
      }
      setConfig(json.config);
      toast.success('Configuración generada por IA');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBuilding(false);
    }
  }

  async function run() {
    setRunning(true);
    setInsights(null);
    try {
      const res = await fetch('/api/extractor/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const json = (await res.json()) as {
        ok?: boolean; rows?: Record<string, unknown>[]; total?: number; truncated?: boolean; error?: string;
      };
      if (!res.ok || !json.ok || !json.rows) {
        toast.error(json.error ?? 'Error al correr el extractor');
        setRows(null);
        return;
      }
      setRows(json.rows);
      setTotal(json.total ?? 0);
      setTruncated(json.truncated ?? false);
      toast.success(`${json.rows.length.toLocaleString('es-MX')} filas`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function exportCsv() {
    const res = await fetch('/api/extractor/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, format: 'csv' }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extractor-${config.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateInsights() {
    if (!rows || rows.length === 0) return;
    setInsightsLoading(true);
    try {
      const res = await fetch('/api/extractor/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt || `Análisis de ${entity.label}`, rows: rows.slice(0, 80), columns: config.columns }),
      });
      const json = (await res.json()) as { ok?: boolean; insights?: AIInsights; error?: string };
      if (!res.ok || !json.ok || !json.insights) {
        toast.error(json.error ?? 'No se pudieron generar insights');
        return;
      }
      setInsights(json.insights);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setInsightsLoading(false);
    }
  }

  const inputCls = 'h-8 rounded-md border border-sysde-border bg-white px-2 text-sm focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red';

  return (
    <div className="space-y-6">
      {/* AI prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-sysde-red" />
            Describí qué querés en lenguaje natural
          </CardTitle>
          <p className="text-xs text-sysde-mid">
            Ejemplos: "oportunidades cerradas en Costa Rica este año con valor mayor a 50K",
            "actividades de email con CMI en los últimos 30 días", "contactos C-level de bancos en Perú"
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ej: muéstrame las oportunidades abiertas con rating A+ y valor > 100K, ordenadas por fecha de cierre"
              rows={2}
              className="flex-1"
            />
            <Button onClick={runAi} disabled={aiBuilding || !aiPrompt.trim()} size="sm" className="self-end">
              {aiBuilding ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              Generar config
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manual builder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><Database className="h-4 w-4 text-sysde-red" />Configuración</span>
            <div className="flex gap-2">
              <Button onClick={run} disabled={running} size="sm">
                {running ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                Ejecutar
              </Button>
              {rows !== null && rows.length > 0 && (
                <Button onClick={exportCsv} size="sm" variant="outline">
                  <Download className="mr-1 h-3.5 w-3.5" />
                  CSV
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entity + limit */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-sysde-mid">Entidad</span>
              <select className={inputCls} value={config.entity} onChange={(e) => setEntity(e.target.value)}>
                {Object.entries(ENTITIES).map(([key, def]) => (
                  <option key={key} value={key}>{def.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-sysde-mid">Limit</span>
              <input
                type="number"
                className={inputCls}
                value={config.limit ?? 200}
                onChange={(e) => setConfig({ ...config, limit: Number(e.target.value) })}
                min={1} max={1000}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-sysde-mid">Ordenar por</span>
              <div className="flex gap-1">
                <select
                  className={inputCls}
                  value={config.orderBy?.field ?? entity.defaultOrder.field}
                  onChange={(e) => setConfig({ ...config, orderBy: { field: e.target.value, dir: config.orderBy?.dir ?? 'desc' } })}
                >
                  {Object.entries(entity.fields).map(([key, f]) => (
                    <option key={key} value={key}>{f.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setConfig({ ...config, orderBy: { field: config.orderBy?.field ?? entity.defaultOrder.field, dir: config.orderBy?.dir === 'asc' ? 'desc' : 'asc' } })}
                  className="h-8 w-8 p-0"
                >
                  {config.orderBy?.dir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </label>
          </div>

          {/* Filters */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sysde-mid">
                <Filter className="h-3 w-3" /> Filtros
              </span>
              <Button onClick={addFilter} size="sm" variant="ghost" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Agregar filtro
              </Button>
            </div>
            {config.filters.length === 0 ? (
              <p className="text-xs text-sysde-mid">Sin filtros — devolverá todas las filas (limitado a {config.limit ?? 200}).</p>
            ) : (
              <div className="space-y-1.5">
                {config.filters.map((f, i) => (
                  <FilterRowUI key={i} entity={entity} filter={f} onChange={(p) => updateFilter(i, p)} onRemove={() => removeFilter(i)} />
                ))}
              </div>
            )}
          </div>

          {/* Columns */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sysde-mid">
                <Columns3 className="h-3 w-3" /> Columnas ({config.columns.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(entity.fields)
                .filter(([, f]) => f.selectable !== false)
                .map(([key, f]) => {
                  const on = config.columns.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleColumn(key)}
                      className={`rounded-md border px-2 py-1 text-xs transition ${
                        on
                          ? 'border-sysde-red bg-sysde-red text-white'
                          : 'border-sysde-border bg-white text-sysde-gray hover:border-sysde-red/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {rows !== null && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Resultados <span className="ml-2 font-normal text-sysde-mid">{rows.length} de {total.toLocaleString('es-MX')}</span></span>
              <div className="flex gap-2">
                <Button onClick={generateInsights} disabled={insightsLoading || rows.length === 0} size="sm" variant="outline" className="border-sysde-red/30 text-sysde-red hover:bg-sysde-red/5 hover:text-sysde-red">
                  {insightsLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  Insights con IA
                </Button>
              </div>
            </CardTitle>
            {truncated && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
                <AlertCircle className="h-3 w-3" /> Resultado truncado al limit. Hay más datos disponibles.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {insights && (
              <div className="mb-4 rounded-md border border-sysde-red/20 bg-sysde-red/5 p-3">
                <p className="font-semibold text-sysde-gray">{insights.headline}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-sysde-gray">
                  {insights.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
            <ResultsTable rows={rows} columns={config.columns} entityKey={config.entity} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterRowUI({
  entity,
  filter,
  onChange,
  onRemove,
}: {
  entity: typeof ENTITIES[string];
  filter: FilterRow;
  onChange: (patch: Partial<FilterRow>) => void;
  onRemove: () => void;
}) {
  const def = entity.fields[filter.field];
  const ops = def ? OPS_BY_TYPE[def.type] : [];
  const inputCls = 'h-8 rounded-md border border-sysde-border bg-white px-2 text-sm focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red';
  const showValueInput = filter.op !== 'is_null' && filter.op !== 'is_not_null';

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-sysde-border bg-white p-1.5">
      <select className={inputCls} value={filter.field} onChange={(e) => onChange({ field: e.target.value })}>
        {Object.entries(entity.fields).map(([key, f]) => (
          <option key={key} value={key}>{f.label}</option>
        ))}
      </select>
      <select className={inputCls} value={filter.op} onChange={(e) => onChange({ op: e.target.value as Operator })}>
        {ops.map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
      </select>
      {showValueInput && (
        <ValueInput def={def} op={filter.op} value={filter.value} onChange={(v) => onChange({ value: v })} />
      )}
      <Button type="button" size="sm" variant="ghost" onClick={onRemove} className="ml-auto h-7 w-7 p-0">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ValueInput({
  def,
  op,
  value,
  onChange,
}: {
  def: typeof ENTITIES[string]['fields'][string];
  op: Operator;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const inputCls = 'h-8 min-w-[140px] rounded-md border border-sysde-border bg-white px-2 text-sm focus:border-sysde-red focus:outline-none focus:ring-1 focus:ring-sysde-red';

  if (def.type === 'enum' && def.options) {
    if (op === 'in' || op === 'not_in') {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {def.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                const has = arr.includes(o.value);
                onChange(has ? arr.filter((v) => v !== o.value) : [...arr, o.value]);
              }}
              className={`rounded px-1.5 py-0.5 text-[11px] ${arr.includes(o.value) ? 'bg-sysde-red text-white' : 'border border-sysde-border bg-white text-sysde-gray'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      );
    }
    return (
      <select className={inputCls} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (op === 'between') {
    const arr = Array.isArray(value) ? (value as [string, string]) : ['', ''];
    const inputType = def.type === 'date' ? 'date' : 'number';
    return (
      <div className="flex items-center gap-1">
        <input type={inputType} className={inputCls} value={arr[0]} onChange={(e) => onChange([e.target.value, arr[1]])} />
        <span className="text-xs text-sysde-mid">y</span>
        <input type={inputType} className={inputCls} value={arr[1]} onChange={(e) => onChange([arr[0], e.target.value])} />
      </div>
    );
  }
  if (def.type === 'date') {
    return <input type="date" className={inputCls} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  if (def.type === 'number') {
    return <input type="number" className={inputCls} value={(value as string | number) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
  return <Input className={`h-8 ${inputCls.includes('min-w-') ? '' : ''}`} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
}

function ResultsTable({
  rows,
  columns,
  entityKey,
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  entityKey: string;
}) {
  const entity = ENTITIES[entityKey];
  if (rows.length === 0) {
    return <p className="text-sm text-sysde-mid">Sin resultados.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-sysde-border">
      <table className="min-w-full text-xs">
        <thead className="bg-sysde-bg">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-sysde-mid">
                {entity.fields[c]?.label ?? c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.__id)} className="border-t border-sysde-border hover:bg-sysde-bg/50">
              {columns.map((c) => (
                <td key={c} className="px-3 py-1.5">
                  <CellValue value={r[c]} field={entity.fields[c]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellValue({ value, field }: { value: unknown; field?: { type: string; options?: Array<{ value: string; label: string }> } }) {
  if (value === null || value === undefined || value === '') return <span className="text-sysde-mid">—</span>;
  if (field?.type === 'date') {
    return <span className="tabular-nums">{new Date(value as string).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>;
  }
  if (field?.type === 'enum' && field.options) {
    const opt = field.options.find((o) => o.value === value);
    if (opt) return <Badge variant="outline" className="text-[10px]">{opt.label}</Badge>;
  }
  if (field?.type === 'number') {
    const n = Number(value);
    if (!Number.isNaN(n) && n >= 1000) return <span className="tabular-nums font-medium">{n.toLocaleString('es-MX')}</span>;
    return <span className="tabular-nums">{String(value)}</span>;
  }
  const s = String(value);
  return <span className={s.length > 50 ? 'block max-w-[300px] truncate' : ''} title={s.length > 50 ? s : undefined}>{s}</span>;
}
