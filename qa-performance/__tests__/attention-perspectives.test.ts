// Atención requerida v2: perspectivas + smart scoring + by_owner

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeAttentionScore } from '../../src/lib/opportunities/management-queries';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('computeAttentionScore', () => {
  const now = new Date('2026-05-06T18:00:00.000Z');

  it('fresh + sin gestión → score 0', () => {
    const s = computeAttentionScore({
      estimatedValue: 100_000,
      stage: 'PROPOSAL',
      lastActivityAt: new Date('2026-05-06T10:00:00.000Z'), // 8h ago
      lastActivityDirection: 'OUTBOUND',
      owner: { id: 'u1' },
      now,
    });
    expect(s).toBe(0);
  });

  it('INBOUND + alto valor + NEGOTIATION → score alto', () => {
    const s = computeAttentionScore({
      estimatedValue: 1_000_000,
      stage: 'NEGOTIATION',
      lastActivityAt: new Date('2026-05-06T16:00:00.000Z'),
      lastActivityDirection: 'INBOUND',
      owner: { id: 'u1' },
      now,
    });
    expect(s).toBeGreaterThan(50);
  });

  it('72h+ sin owner → con penalización', () => {
    const a = computeAttentionScore({
      estimatedValue: 100_000,
      stage: 'PROPOSAL',
      lastActivityAt: new Date('2026-05-02T10:00:00.000Z'), // 4 días
      lastActivityDirection: 'OUTBOUND',
      owner: { id: 'u1' },
      now,
    });
    const b = computeAttentionScore({
      estimatedValue: 100_000,
      stage: 'PROPOSAL',
      lastActivityAt: new Date('2026-05-02T10:00:00.000Z'),
      lastActivityDirection: 'OUTBOUND',
      owner: null,
      now,
    });
    expect(b).toBeLessThan(a);
  });

  it('valor 0 → score bajo (factor 0.3)', () => {
    const s = computeAttentionScore({
      estimatedValue: null,
      stage: 'NEGOTIATION',
      lastActivityAt: null,
      lastActivityDirection: null,
      owner: { id: 'u1' },
      now,
    });
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(20);
  });

  it('NEGOTIATION pesa más que LEAD', () => {
    const neg = computeAttentionScore({
      estimatedValue: 100_000,
      stage: 'NEGOTIATION',
      lastActivityAt: null,
      lastActivityDirection: null,
      owner: { id: 'u1' },
      now,
    });
    const lead = computeAttentionScore({
      estimatedValue: 100_000,
      stage: 'LEAD',
      lastActivityAt: null,
      lastActivityDirection: null,
      owner: { id: 'u1' },
      now,
    });
    expect(neg).toBeGreaterThan(lead);
  });

  it('score capeado a 100', () => {
    const s = computeAttentionScore({
      estimatedValue: 100_000_000_000, // $100B fantasía
      stage: 'CLOSING',
      lastActivityAt: null,
      lastActivityDirection: 'INBOUND',
      owner: { id: 'u1' },
      now,
    });
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('PerspectiveTabs component', () => {
  it('5 tabs (smart/urgency/value/unassigned/by_owner)', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/perspective-tabs.tsx'),
      'utf8'
    );
    expect(src).toMatch(/'smart'/);
    expect(src).toMatch(/'urgency'/);
    expect(src).toMatch(/'value'/);
    expect(src).toMatch(/'unassigned'/);
    expect(src).toMatch(/'by_owner'/);
    expect(src).toMatch(/Smart/);
    expect(src).toMatch(/Por owner/);
  });
});

describe('NeedAttentionHero v2', () => {
  it('soporta perspectivas + by_owner + score chip', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/components/need-attention-hero.tsx'),
      'utf8'
    );
    expect(src).toMatch(/PerspectiveTabs/);
    expect(src).toMatch(/byOwner/);
    expect(src).toMatch(/showScore/);
    expect(src).toMatch(/Sin owner/);
    expect(src).toMatch(/whenLabel/);
    expect(src).toMatch(/high_value/);
    expect(src).toMatch(/unassigned/);
  });
});

describe('Pages wire-up de perspectivas', () => {
  it('/opportunities lee ?attention= y selecciona perspectiva', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/opportunities/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/getNeedAttentionOppsByPerspective/);
    expect(src).toMatch(/getNeedAttentionByOwner/);
    expect(src).toMatch(/AttentionPerspective/);
    expect(src).toMatch(/sp\.attention/);
  });

  it('/sprint MyAttentionWidget recibe sp y respeta perspectiva', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/sprint/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/getNeedAttentionOppsByPerspective/);
    expect(src).toMatch(/perspective:\s*AttentionPerspective/);
    expect(src).toMatch(/basePath="\/sprint"/);
  });
});
