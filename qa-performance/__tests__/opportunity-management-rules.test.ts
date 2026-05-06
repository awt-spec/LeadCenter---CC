// Reglas de gestión + vistas guardadas en oportunidades

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeStaleness,
  computeBallInCourt,
  deriveDirectionFromType,
  stalenessRanges,
} from '../../src/lib/opportunities/management-rules';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('computeStaleness', () => {
  const now = new Date('2026-05-06T18:00:00.000Z');

  it('null → never (badge rojo)', () => {
    const r = computeStaleness(null, now);
    expect(r.level).toBe('never');
    expect(r.label).toBe('Sin gestión');
  });

  it('hace 5h → fresh', () => {
    const r = computeStaleness(new Date('2026-05-06T13:00:00.000Z'), now);
    expect(r.level).toBe('fresh');
  });

  it('hace 30h → yellow', () => {
    const r = computeStaleness(new Date('2026-05-05T12:00:00.000Z'), now);
    expect(r.level).toBe('yellow');
    expect(r.label).toBe('24h sin gestión');
  });

  it('hace 60h → orange', () => {
    const r = computeStaleness(new Date('2026-05-04T06:00:00.000Z'), now);
    expect(r.level).toBe('orange');
  });

  it('hace 80h → red (72h+)', () => {
    const r = computeStaleness(new Date('2026-05-03T10:00:00.000Z'), now);
    expect(r.level).toBe('red');
  });

  it('hace 10 días → red con label de días', () => {
    const r = computeStaleness(new Date('2026-04-26T18:00:00.000Z'), now);
    expect(r.level).toBe('red');
    expect(r.label).toMatch(/d sin gestión/);
  });
});

describe('computeBallInCourt', () => {
  const now = new Date('2026-05-06T18:00:00.000Z');

  it('última gestión OUTBOUND → no necesita respuesta', () => {
    const r = computeBallInCourt(new Date('2026-05-06T10:00:00.000Z'), 'OUTBOUND', now);
    expect(r.needsResponse).toBe(false);
  });

  it('última gestión INBOUND → necesita respuesta', () => {
    const r = computeBallInCourt(new Date('2026-05-06T10:00:00.000Z'), 'INBOUND', now);
    expect(r.needsResponse).toBe(true);
    expect(r.hoursWaiting).toBeGreaterThan(7);
  });

  it('última gestión INTERNAL → no necesita respuesta', () => {
    const r = computeBallInCourt(new Date('2026-05-06T10:00:00.000Z'), 'INTERNAL', now);
    expect(r.needsResponse).toBe(false);
  });

  it('null direction → no necesita respuesta', () => {
    const r = computeBallInCourt(new Date('2026-05-06T10:00:00.000Z'), null, now);
    expect(r.needsResponse).toBe(false);
  });
});

describe('deriveDirectionFromType', () => {
  it('EMAIL_RECEIVED → INBOUND', () => {
    expect(deriveDirectionFromType('EMAIL_RECEIVED')).toBe('INBOUND');
  });
  it('INTERNAL_NOTE → INTERNAL', () => {
    expect(deriveDirectionFromType('INTERNAL_NOTE')).toBe('INTERNAL');
  });
  it('STAGE_CHANGE → INTERNAL', () => {
    expect(deriveDirectionFromType('STAGE_CHANGE')).toBe('INTERNAL');
  });
  it('CALL → OUTBOUND', () => {
    expect(deriveDirectionFromType('CALL')).toBe('OUTBOUND');
  });
  it('EMAIL_SENT → OUTBOUND', () => {
    expect(deriveDirectionFromType('EMAIL_SENT')).toBe('OUTBOUND');
  });
});

describe('stalenessRanges', () => {
  const now = new Date('2026-05-06T18:00:00.000Z');

  it('all → null (sin filtro)', () => {
    expect(stalenessRanges('all', now)).toBeNull();
  });

  it('needs_response → null (se filtra por direction, no tiempo)', () => {
    expect(stalenessRanges('needs_response', now)).toBeNull();
  });

  it('fresh → desde -24h', () => {
    const r = stalenessRanges('fresh', now);
    expect(r?.gte).toBeDefined();
    expect(r?.gte?.getTime()).toBe(now.getTime() - 24 * 60 * 60 * 1000);
  });

  it('red → hasta -72h', () => {
    const r = stalenessRanges('red', now);
    expect(r?.lte).toBeDefined();
    expect(r?.lte?.getTime()).toBe(now.getTime() - 72 * 60 * 60 * 1000);
  });
});

describe('Schema + migration files', () => {
  it('schema.prisma define ActivityDirection + Activity.direction + Opp.lastActivityDirection + OpportunityView', () => {
    const src = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    expect(src).toMatch(/enum\s+ActivityDirection\s*\{/);
    expect(src).toMatch(/OUTBOUND/);
    expect(src).toMatch(/INBOUND/);
    expect(src).toMatch(/INTERNAL/);
    expect(src).toMatch(/^\s+direction\s+ActivityDirection\?/m);
    expect(src).toMatch(/lastActivityDirection\s+ActivityDirection\?/);
    expect(src).toMatch(/model\s+OpportunityView\s*\{/);
  });

  it('migration SQL idempotente', () => {
    const sql = readFileSync(
      resolve(root, 'prisma/migrations/20260506130000_opportunity_management_rules/migration.sql'),
      'utf8'
    );
    expect(sql).toMatch(/CREATE TYPE "ActivityDirection"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "direction"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "lastActivityDirection"/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "OpportunityView"/);
  });
});

describe('UI integration', () => {
  it('management-badges component existe con StalenessBadge + BallInCourtBadge', () => {
    const src = readFileSync(
      resolve(root, 'src/components/opportunities/management-badges.tsx'),
      'utf8'
    );
    expect(src).toMatch(/export\s+function\s+StalenessBadge/);
    expect(src).toMatch(/export\s+function\s+BallInCourtBadge/);
    expect(src).toMatch(/export\s+function\s+ManagementBadges/);
  });

  it('opportunity-card usa ManagementBadges', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/pipeline/components/opportunity-card.tsx'),
      'utf8'
    );
    expect(src).toMatch(/ManagementBadges/);
    expect(src).toMatch(/lastActivityDirection/);
  });

  it('opportunities-table usa ManagementBadges', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/opportunities-table.tsx'),
      'utf8'
    );
    expect(src).toMatch(/ManagementBadges/);
    expect(src).toMatch(/lastActivityDirection/);
  });

  it('pipeline-filters tiene chips de staleness + responder', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/pipeline/components/pipeline-filters.tsx'),
      'utf8'
    );
    expect(src).toMatch(/staleness/);
    expect(src).toMatch(/needsResponse/);
    expect(src).toMatch(/Responder/);
    expect(src).toMatch(/PipelineSavedViews/);
  });

  it('createActivity sincroniza direction + lastActivityDirection en Opportunity', () => {
    const src = readFileSync(
      resolve(root, 'src/lib/activities/mutations.ts'),
      'utf8'
    );
    expect(src).toMatch(/deriveDirectionFromType/);
    expect(src).toMatch(/lastActivityDirection/);
  });
});

describe('Endpoints opportunities/views', () => {
  it('GET/POST /api/opportunities/views existe', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/opportunities/views/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/opportunities:read/);
    expect(src).toMatch(/prisma\.opportunityView/);
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
  });

  it('DELETE /api/opportunities/views/[id] valida ownership', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/opportunities/views/[id]/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/ownerId\s*!==\s*session\.user\.id/);
  });
});
