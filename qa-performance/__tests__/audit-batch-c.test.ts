// Audit v3 — Batch C: saved views + compare + permission matrix

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSensitivePermission } from '../../src/lib/audit/queries';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Batch C: schema + migration', () => {
  it('schema.prisma define AuditView con relación a User', () => {
    const src = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    expect(src).toMatch(/model\s+AuditView\s*\{/);
    expect(src).toMatch(/ownerId\s+String/);
    expect(src).toMatch(/filters\s+Json/);
    expect(src).toMatch(/isShared\s+Boolean/);
    expect(src).toMatch(/auditViews\s+AuditView\[\]\s+@relation\("UserAuditViews"/);
  });

  it('migración SQL existe', () => {
    const sql = readFileSync(
      resolve(root, 'prisma/migrations/20260506100000_audit_views/migration.sql'),
      'utf8'
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "AuditView"/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "AuditView_ownerId_idx"/);
    expect(sql).toMatch(/AuditView_ownerId_fkey/);
  });
});

describe('Batch C: API endpoints', () => {
  it('GET/POST /api/audit/views existe y gatea por audit:read', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/audit/views/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/export\s+async\s+function\s+GET/);
    expect(src).toMatch(/export\s+async\s+function\s+POST/);
    expect(src).toMatch(/audit:read/);
    expect(src).toMatch(/prisma\.auditView/);
  });

  it('DELETE /api/audit/views/[id] valida ownership', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/audit/views/[id]/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/export\s+async\s+function\s+DELETE/);
    expect(src).toMatch(/ownerId\s*!==\s*session\.user\.id/);
  });
});

describe('Batch C: pages', () => {
  it('/audit/permissions existe y usa getRolePermissionMatrix', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/permissions/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/getRolePermissionMatrix/);
    expect(src).toMatch(/getInactiveUsers/);
    expect(src).toMatch(/audit:read/);
  });

  it('/audit/compare redirige si hay 1 sólo user', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/compare/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/redirect\(`\/audit\?userId=/);
    expect(src).toMatch(/getUserDrilldown/);
  });
});

describe('Batch C: SavedViews UI', () => {
  it('component es client + usa /api/audit/views', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/saved-views.tsx'),
      'utf8'
    );
    expect(src).toMatch(/'use client'/);
    expect(src).toMatch(/\/api\/audit\/views/);
    expect(src).toMatch(/Guardar actual/);
  });

  it('audit-toolbar incluye SavedViews', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/audit-toolbar.tsx'),
      'utf8'
    );
    expect(src).toMatch(/import\s+\{\s*SavedViews\s*\}/);
    expect(src).toMatch(/<SavedViews\s*\/?>/);
  });

  it('sidebar incluye link Permisos gateado por audit:read', () => {
    const src = readFileSync(resolve(root, 'src/components/layout/sidebar.tsx'), 'utf8');
    expect(src).toMatch(/href:\s*'\/audit\/permissions'/);
  });
});

describe('Batch C: isSensitivePermission heuristic', () => {
  it('marca delete como sensible', () => {
    expect(isSensitivePermission('contacts:delete')).toBe(true);
  });

  it('marca role_grant como sensible', () => {
    expect(isSensitivePermission('users:role_grant')).toBe(true);
  });

  it('marca audit:read como sensible', () => {
    expect(isSensitivePermission('audit:read')).toBe(true);
  });

  it('NO marca read como sensible', () => {
    expect(isSensitivePermission('contacts:read:own')).toBe(false);
  });
});
