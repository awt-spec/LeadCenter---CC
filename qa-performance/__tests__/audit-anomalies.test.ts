// Audit v3 — Batch A: anomaly detection
//
// Tests unitarios de las heurísticas de flagAnomalies con fixtures sintéticas.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { flagAnomalies, type UserBaseline } from '../../src/lib/audit/anomalies';
import type { AuditLogRow } from '../../src/lib/audit/queries';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

function row(input: Partial<AuditLogRow> & { id: string; createdAt: Date }): AuditLogRow {
  return {
    id: input.id,
    userId: input.userId ?? null,
    action: input.action ?? 'update',
    resource: input.resource ?? 'accounts',
    resourceId: input.resourceId ?? null,
    changes: input.changes ?? null,
    metadata: input.metadata ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: input.createdAt,
    reviewedAt: input.reviewedAt ?? null,
    reviewedById: input.reviewedById ?? null,
    reviewNote: input.reviewNote ?? null,
    user: input.user ?? null,
    reviewedBy: input.reviewedBy ?? null,
  };
}

const baseline: UserBaseline = {
  userId: 'u1',
  dailyAvg: 10,
  activeHours: new Set([9, 10, 11, 14, 15, 16]),
  knownResources: new Set(['accounts', 'contacts']),
};

describe('flagAnomalies', () => {
  it('marca admin_action en delete', () => {
    const events = [
      row({ id: 'e1', userId: 'u1', action: 'delete', createdAt: new Date('2026-05-06T10:00:00Z') }),
    ];
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 5]]));
    const f = flags.get('e1');
    expect(f).toBeDefined();
    expect(f!.some((x) => x.kind === 'admin_action')).toBe(true);
  });

  it('marca after_hours en acción a las 02:00 UTC', () => {
    const events = [
      row({ id: 'e1', userId: 'u1', action: 'update', createdAt: new Date('2026-05-06T02:00:00Z') }),
    ];
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 5]]));
    const f = flags.get('e1');
    expect(f!.some((x) => x.kind === 'after_hours')).toBe(true);
  });

  it('marca unusual_hour si el user nunca actuó a esa hora', () => {
    const events = [
      // 21:00 UTC, no está en activeHours del baseline
      row({ id: 'e1', userId: 'u1', action: 'update', createdAt: new Date('2026-05-06T21:00:00Z') }),
    ];
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 5]]));
    const f = flags.get('e1');
    expect(f!.some((x) => x.kind === 'unusual_hour')).toBe(true);
  });

  it('NO marca unusual_hour si la hora está en el baseline', () => {
    const events = [
      row({ id: 'e1', userId: 'u1', action: 'update', createdAt: new Date('2026-05-06T10:00:00Z') }),
    ];
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 5]]));
    const f = flags.get('e1') ?? [];
    expect(f.some((x) => x.kind === 'unusual_hour')).toBe(false);
  });

  it('marca new_resource_type al tocar un resource desconocido', () => {
    const events = [
      row({
        id: 'e1',
        userId: 'u1',
        action: 'update',
        resource: 'opportunities',
        createdAt: new Date('2026-05-06T10:00:00Z'),
      }),
    ];
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 5]]));
    const f = flags.get('e1');
    expect(f!.some((x) => x.kind === 'new_resource_type')).toBe(true);
  });

  it('marca high_volume si hoy >3× promedio', () => {
    const events = [
      row({ id: 'e1', userId: 'u1', action: 'update', createdAt: new Date('2026-05-06T10:00:00Z') }),
    ];
    // baseline.dailyAvg = 10; today = 50 → 5x
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 50]]));
    const f = flags.get('e1');
    expect(f!.some((x) => x.kind === 'high_volume')).toBe(true);
  });

  it('marca mass_delete con ráfaga de ≥10 deletes en <60s', () => {
    const start = new Date('2026-05-06T10:00:00Z').getTime();
    const events: AuditLogRow[] = [];
    for (let i = 0; i < 12; i++) {
      events.push(
        row({
          id: `del-${i}`,
          userId: 'u1',
          action: 'delete',
          resource: 'contacts',
          createdAt: new Date(start + i * 2_000), // cada 2s
        })
      );
    }
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 12]]));
    // El último debe estar marcado (10+ deletes en su ventana)
    const last = flags.get('del-11');
    expect(last!.some((x) => x.kind === 'mass_delete')).toBe(true);
  });

  it('NO marca mass_delete con deletes espaciados', () => {
    const start = new Date('2026-05-06T10:00:00Z').getTime();
    const events: AuditLogRow[] = [];
    for (let i = 0; i < 12; i++) {
      events.push(
        row({
          id: `del-${i}`,
          userId: 'u1',
          action: 'delete',
          resource: 'contacts',
          createdAt: new Date(start + i * 30_000), // cada 30s = 10 en 5min, no en 60s
        })
      );
    }
    const flags = flagAnomalies(events, new Map([['u1', baseline]]), new Map([['u1', 12]]));
    const massDeletes = [...flags.values()]
      .flat()
      .filter((f) => f.kind === 'mass_delete');
    expect(massDeletes.length).toBe(0);
  });
});

describe('Batch A: AI summary endpoint', () => {
  it('endpoint existe y referencia anomalies + extractor pattern', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/audit/ai-summary/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/from\s+['"]@anthropic-ai\/sdk['"]/);
    expect(src).toMatch(/audit:read/);
    expect(src).toMatch(/flagAnomalies/);
    expect(src).toMatch(/claude-sonnet-4-5/);
  });

  it('AISummaryCard renderiza botón y llama POST /api/audit/ai-summary', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/ai-summary-card.tsx'),
      'utf8'
    );
    expect(src).toMatch(/'use client'/);
    expect(src).toMatch(/\/api\/audit\/ai-summary/);
    expect(src).toMatch(/Generar resumen/);
  });
});
