// Audit v3 — Batch D: review + hash chain + cron digest + inactive users

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeHash } from '../../src/lib/audit/hash-chain';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Batch D: schema + migration', () => {
  it('AuditLog tiene reviewed* + hash + previousHash', () => {
    const src = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    expect(src).toMatch(/reviewedAt\s+DateTime\?/);
    expect(src).toMatch(/reviewedById\s+String\?/);
    expect(src).toMatch(/reviewNote\s+String\?/);
    expect(src).toMatch(/previousHash\s+String\?/);
    expect(src).toMatch(/^\s+hash\s+String\?/m);
    expect(src).toMatch(/AuditLogReviewer/);
    expect(src).toMatch(/@@index\(\[reviewedAt\]\)/);
  });

  it('migración SQL existe y es idempotente', () => {
    const sql = readFileSync(
      resolve(root, 'prisma/migrations/20260506110000_audit_review_chain/migration.sql'),
      'utf8'
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "reviewedAt"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "hash"/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "previousHash"/);
    expect(sql).toMatch(/AuditLog_reviewedById_fkey/);
    expect(sql).toMatch(/AuditLog_reviewedAt_idx/);
  });
});

describe('Batch D: hash chain', () => {
  const r1 = {
    id: 'r1',
    userId: 'u1',
    action: 'create',
    resource: 'accounts',
    resourceId: 'a1',
    changes: { name: 'X' },
    metadata: null,
    createdAt: new Date('2026-05-06T10:00:00.000Z'),
  };
  const r2 = {
    id: 'r2',
    userId: 'u1',
    action: 'update',
    resource: 'accounts',
    resourceId: 'a1',
    changes: { name: 'Y' },
    metadata: null,
    createdAt: new Date('2026-05-06T10:01:00.000Z'),
  };

  it('computeHash es determinístico', () => {
    const h1a = computeHash(r1, null);
    const h1b = computeHash(r1, null);
    expect(h1a).toBe(h1b);
    expect(h1a).toMatch(/^[a-f0-9]{64}$/); // sha256 hex
  });

  it('previousHash distinto cambia el hash', () => {
    const h1 = computeHash(r2, 'aaaa');
    const h2 = computeHash(r2, 'bbbb');
    expect(h1).not.toBe(h2);
  });

  it('cualquier campo distinto cambia el hash', () => {
    const h0 = computeHash(r1, null);
    const tampered = { ...r1, action: 'delete' };
    const h1 = computeHash(tampered, null);
    expect(h0).not.toBe(h1);
  });
});

describe('Batch D: endpoints', () => {
  it('POST /api/audit/review valida ids + audit:read', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/audit/review/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/audit:read/);
    expect(src).toMatch(/ids:\s*z\.array/);
    expect(src).toMatch(/reviewedAt/);
    expect(src).toMatch(/reviewedById/);
  });

  it('POST /api/audit/verify gateado + invoca verifyChain', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/audit/verify/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/verifyChain/);
    expect(src).toMatch(/audit:read/);
  });

  it('cron digest gateado por CRON_SECRET y manda via Resend', () => {
    const src = readFileSync(
      resolve(root, 'src/app/api/cron/audit-digest/route.ts'),
      'utf8'
    );
    expect(src).toMatch(/CRON_SECRET/);
    expect(src).toMatch(/RESEND_API_KEY/);
    expect(src).toMatch(/Resend/);
    expect(src).toMatch(/verifyChain/);
  });
});

describe('Batch D: vercel.json cron', () => {
  it('vercel.json tiene cron audit-digest semanal', () => {
    const src = readFileSync(resolve(root, 'vercel.json'), 'utf8');
    expect(src).toMatch(/\/api\/cron\/audit-digest/);
    expect(src).toMatch(/0 13 \* \* 1/);
  });
});

describe('Batch D: writeAuditLog extiende con hash chain', () => {
  it('write.ts importa y usa computeHash + getLastHash', () => {
    const src = readFileSync(resolve(root, 'src/lib/audit/write.ts'), 'utf8');
    expect(src).toMatch(/from\s+'\.\/hash-chain'/);
    expect(src).toMatch(/getLastHash/);
    expect(src).toMatch(/computeHash/);
  });
});

describe('Batch D: UI components', () => {
  it('ReviewBar es client + cuenta checkboxes data-audit-review', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/review-bar.tsx'),
      'utf8'
    );
    expect(src).toMatch(/'use client'/);
    expect(src).toMatch(/data-audit-review/);
    expect(src).toMatch(/\/api\/audit\/review/);
  });

  it('VerifyChainButton invoca /api/audit/verify', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/verify-chain-button.tsx'),
      'utf8'
    );
    expect(src).toMatch(/'use client'/);
    expect(src).toMatch(/\/api\/audit\/verify/);
  });

  it('audit-table tiene checkbox + columna Reviewed', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/audit-table.tsx'),
      'utf8'
    );
    expect(src).toMatch(/data-audit-review/);
    expect(src).toMatch(/<TableHead[^>]*>Rev\./);
    expect(src).toMatch(/row\.reviewedAt/);
  });

  it('audit-filters tiene chips reviewState', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/audit-filters.tsx'),
      'utf8'
    );
    expect(src).toMatch(/reviewState/);
    expect(src).toMatch(/'unreviewed'.*'reviewed'.*'all'|'reviewed'.*'unreviewed'/s);
  });
});
