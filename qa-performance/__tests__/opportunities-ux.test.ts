// UX redesign /opportunities + /sprint: stats strip, need-attention hero,
// row priority, cards view, sprint widget.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Helpers management-queries', () => {
  it('getManagementStats + getNeedAttentionOpps existen', () => {
    const src = readFileSync(
      resolve(root, 'src/lib/opportunities/management-queries.ts'),
      'utf8'
    );
    expect(src).toMatch(/export\s+async\s+function\s+getManagementStats/);
    expect(src).toMatch(/export\s+async\s+function\s+getNeedAttentionOpps/);
    expect(src).toMatch(/needsResponse/);
    expect(src).toMatch(/lastActivityDirection:\s*'INBOUND'/);
  });
});

describe('Componentes UX', () => {
  it('ManagementStatsStrip 5 tiles clickeables (responder/red/orange/yellow/fresh)', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/management-stats-strip.tsx'),
      'utf8'
    );
    expect(src).toMatch(/Necesitan respuesta/);
    expect(src).toMatch(/En rojo/);
    expect(src).toMatch(/En naranja/);
    expect(src).toMatch(/En amarillo/);
    expect(src).toMatch(/Al día/);
    expect(src).toMatch(/buildHref/);
  });

  it('NeedAttentionHero render con opps + empty state', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/need-attention-hero.tsx'),
      'utf8'
    );
    expect(src).toMatch(/Todo bajo control/);
    expect(src).toMatch(/Atención requerida/);
    expect(src).toMatch(/needs_response/);
    expect(src).toMatch(/border-l-blue-500/);
    expect(src).toMatch(/border-l-red-500/);
  });

  it('OpportunitiesCards usa border-l por prioridad', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/opportunities-cards.tsx'),
      'utf8'
    );
    expect(src).toMatch(/border-l-blue-500/);
    expect(src).toMatch(/border-l-red-500/);
    expect(src).toMatch(/border-l-orange-500/);
    expect(src).toMatch(/border-l-yellow-400/);
    expect(src).toMatch(/computeBallInCourt/);
    expect(src).toMatch(/computeStaleness/);
  });

  it('OpportunitiesTable rowClassName por prioridad', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/opportunities-table.tsx'),
      'utf8'
    );
    expect(src).toMatch(/rowClassName/);
    expect(src).toMatch(/border-l-blue-500/);
    expect(src).toMatch(/border-l-red-500/);
  });

  it('DataTable acepta rowClassName prop', () => {
    const src = readFileSync(resolve(root, 'src/components/shared/data-table.tsx'), 'utf8');
    expect(src).toMatch(/rowClassName\?:\s*\(row:\s*TData\)\s*=>\s*string/);
    expect(src).toMatch(/rowClassName\?\.\(row\.original\)/);
  });
});

describe('Page wiring /opportunities', () => {
  it('page importa y monta StatsStrip + Hero + CardsView', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/ManagementStatsStrip/);
    expect(src).toMatch(/NeedAttentionHero/);
    expect(src).toMatch(/OpportunitiesCards/);
    expect(src).toMatch(/getManagementStats/);
    expect(src).toMatch(/getNeedAttentionOpps/);
  });

  it('view toggle Tabla/Cards funcional via URL', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/sp\.view === 'cards'/);
    expect(src).toMatch(/viewMode === 'cards'/);
    expect(src).toMatch(/viewMode === 'table'/);
  });
});

describe('Sprint integration', () => {
  it('sprint page renderiza MyAttentionWidget arriba del board', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/sprint/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/MyAttentionWidget/);
    expect(src).toMatch(/NeedAttentionHero/);
    expect(src).toMatch(/getManagementStats/);
    expect(src).toMatch(/getNeedAttentionOpps/);
  });
});
