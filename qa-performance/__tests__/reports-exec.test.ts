// Reports v2: exec landing + AI brief + live mode

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { periodRange } from '../../src/lib/reports/exec-queries';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Reports v2: periodRange computa rangos coherentes', () => {
  const ref = new Date('2026-05-15T12:00:00.000Z'); // viernes
  it('week — 7 días hasta hoy + previo no se solapa', () => {
    const r = periodRange('week', ref);
    const span = r.end.getTime() - r.start.getTime();
    // ~7 días en ms (margen por hours boundary)
    expect(span).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(span).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    // prev no se solapa
    expect(r.prevEnd.getTime()).toBeLessThan(r.start.getTime());
  });

  it('month — desde día 1 + previo es mes anterior', () => {
    const r = periodRange('month', ref);
    expect(r.start.getDate()).toBe(1);
    expect(r.prevStart.getMonth()).not.toBe(r.start.getMonth());
  });

  it('quarter — empieza en mes múltiplo de 3', () => {
    const r = periodRange('quarter', ref);
    expect(r.start.getMonth() % 3).toBe(0);
  });

  it('year — empieza el 1 de enero', () => {
    const r = periodRange('year', ref);
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
  });
});

describe('Reports v2: archivos clave existen y se referencian', () => {
  const expectedFiles = [
    'src/lib/reports/exec-queries.ts',
    'src/app/api/reports/ai-exec-summary/route.ts',
    'src/app/(dashboard)/reports/exec/page.tsx',
    'src/app/(dashboard)/reports/exec/components/period-selector.tsx',
    'src/app/(dashboard)/reports/exec/components/exec-toolbar.tsx',
    'src/app/(dashboard)/reports/exec/components/exec-kpis.tsx',
    'src/app/(dashboard)/reports/exec/components/ai-exec-summary.tsx',
    'src/app/(dashboard)/reports/exec/components/top-deals.tsx',
    'src/app/(dashboard)/reports/exec/components/top-performers.tsx',
    'src/app/(dashboard)/reports/exec/components/funnel-viz.tsx',
    'src/app/(dashboard)/reports/exec/components/weekly-trend.tsx',
  ];
  for (const f of expectedFiles) {
    it(`existe: ${f}`, () => {
      const src = readFileSync(resolve(root, f), 'utf8');
      expect(src.length).toBeGreaterThan(40);
    });
  }
});

describe('Reports v2: endpoint AI exec gateado por reports:read', () => {
  it('ai-exec-summary chequea reports:read y llama Claude', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/reports/ai-exec-summary/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/reports:read:all|reports:read:own/);
    expect(src).toMatch(/from\s+'@anthropic-ai\/sdk'/);
    expect(src).toMatch(/claude-sonnet-4-5/);
    expect(src).toMatch(/getExecKPIs/);
    expect(src).toMatch(/getTopWonDeals/);
    expect(src).toMatch(/getDealsAtRisk/);
    expect(src).toMatch(/recommendations/);
  });
});

describe('Reports v2: page ejecutiva usa todos los componentes', () => {
  it('exec/page importa componentes esperados y AIExecSummary', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/reports/exec/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/import\s+\{[^}]*PeriodSelector/);
    expect(src).toMatch(/import\s+\{[^}]*ExecToolbar/);
    expect(src).toMatch(/import\s+\{[^}]*AIExecSummary/);
    expect(src).toMatch(/import\s+\{[^}]*ExecKPIs/);
    expect(src).toMatch(/import\s+\{[^}]*TopWonDeals/);
    expect(src).toMatch(/FunnelViz/);
    expect(src).toMatch(/WeeklyTrendChart/);
  });
});

describe('Reports v2: nav + link en /reports', () => {
  it('sidebar tiene link Brief ejecutivo', () => {
    const src = readFileSync(resolve(root, 'src/components/layout/sidebar.tsx'), 'utf8');
    expect(src).toMatch(/Brief ejecutivo/);
    expect(src).toMatch(/href:\s*'\/reports\/exec'/);
  });

  it('reports/page.tsx tiene CTA al brief', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/reports/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/\/reports\/exec/);
    expect(src).toMatch(/Brief ejecutivo IA/);
  });
});

describe('Reports v2: live + share + print', () => {
  it('exec-toolbar tiene Live, Refrescar, Compartir, Imprimir', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/reports/exec/components/exec-toolbar.tsx'),
      'utf8'
    );
    expect(src).toMatch(/setInterval/);
    expect(src).toMatch(/30_000|30000/); // refresh 30s
    expect(src).toMatch(/clipboard\.writeText/);
    expect(src).toMatch(/window\.print/);
  });

  it('globals.css tiene @media print rules para el exec', () => {
    const src = readFileSync(resolve(root, 'src/app/globals.css'), 'utf8');
    expect(src).toMatch(/@media print/);
    expect(src).toMatch(/print\\:hidden|print:hidden/);
    expect(src).toMatch(/page-break-inside/);
  });
});
