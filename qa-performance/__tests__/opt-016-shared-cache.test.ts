// OPT-016: cache compartido vía tabla Postgres.
// Este test valida el contrato del helper:
//   1. miss → ejecuta fn() y guarda en cache
//   2. hit → devuelve el valor cacheado sin volver a llamar fn()
//   3. expirada → vuelve a llamar fn() y refresca
//   4. invalidateCache() borra entradas
//   5. wildcard prefix funciona

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('OPT-016: shared-cache helper', () => {
  it('schema.prisma tiene model Cache', () => {
    const src = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    expect(src).toMatch(/model\s+Cache\s*\{/);
    expect(src).toMatch(/expiresAt\s+DateTime/);
    expect(src).toMatch(/@@index\(\[expiresAt\]\)/);
  });

  it('migración SQL para Cache existe', () => {
    const sql = readFileSync(
      resolve(
        root,
        'prisma/migrations/20260505200000_opt016_cache_table/migration.sql'
      ),
      'utf8'
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "Cache"/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS "Cache_expiresAt_idx"/);
  });

  it('helper exporta cached, invalidateCache, sweepExpiredCache', () => {
    const src = readFileSync(resolve(root, 'src/lib/shared/shared-cache.ts'), 'utf8');
    expect(src).toMatch(/export\s+async\s+function\s+cached\b/);
    expect(src).toMatch(/export\s+async\s+function\s+invalidateCache\b/);
    expect(src).toMatch(/export\s+async\s+function\s+sweepExpiredCache\b/);
  });

  it('dashboard usa shared-cache layered (L2 sobre unstable_cache)', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/page.tsx'),
      'utf8'
    );
    expect(src).toMatch(/from\s+'@\/lib\/shared\/shared-cache'/);
    expect(src).toMatch(/cached\s*\(/);
    expect(src).toMatch(/dashboard:\$\{userId\}/);
  });
});

describe('OPT-016: contrato del helper (runtime, requiere DB)', () => {
  // Importamos dinámicamente para no romper el import si la DB no
  // está disponible en el setup (para tests más livianos).
  let cached: typeof import('../../src/lib/shared/shared-cache').cached;
  let invalidateCache: typeof import('../../src/lib/shared/shared-cache').invalidateCache;
  let prisma: typeof import('../../src/lib/db').prisma;

  beforeAll(async () => {
    const helper = await import('../../src/lib/shared/shared-cache');
    cached = helper.cached;
    invalidateCache = helper.invalidateCache;
    prisma = (await import('../../src/lib/db')).prisma;
    // Limpiar entradas de tests previos
    await prisma.cache.deleteMany({ where: { key: { startsWith: 'test:opt016:' } } });
  });

  afterAll(async () => {
    await prisma.cache.deleteMany({ where: { key: { startsWith: 'test:opt016:' } } });
  });

  it('miss llama fn() y guarda; hit devuelve sin llamar fn()', async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { n: 42, when: Date.now() };
    };

    const a = await cached('test:opt016:basic', 30_000, fn);
    expect(a.n).toBe(42);
    expect(calls).toBe(1);

    // Esperar un tick para que el upsert async del primer cached llegue.
    await new Promise((r) => setTimeout(r, 200));

    const b = await cached('test:opt016:basic', 30_000, fn);
    expect(b.n).toBe(42);
    // El hit no debe llamar fn() de nuevo:
    expect(calls).toBe(1);
    // Y debe ser literalmente el mismo payload (mismo `when`):
    expect(b.when).toBe(a.when);
  }, 15_000);

  it('TTL expirado obliga a recalcular', async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      return { call: calls };
    };

    const a = await cached('test:opt016:ttl', 50, fn);
    expect(a.call).toBe(1);

    await new Promise((r) => setTimeout(r, 300));

    const b = await cached('test:opt016:ttl', 50, fn);
    // 50ms TTL ya expiró → recálculo
    expect(b.call).toBe(2);
    expect(calls).toBe(2);
  }, 15_000);

  it('invalidateCache borra entrada exacta', async () => {
    await cached('test:opt016:inval', 30_000, async () => 1);
    await new Promise((r) => setTimeout(r, 200));

    const removed = await invalidateCache('test:opt016:inval');
    expect(removed).toBeGreaterThanOrEqual(1);

    const row = await prisma.cache.findUnique({ where: { key: 'test:opt016:inval' } });
    expect(row).toBeNull();
  }, 15_000);

  it('invalidateCache con wildcard prefix borra varias', async () => {
    await cached('test:opt016:wild:a', 30_000, async () => 'a');
    await cached('test:opt016:wild:b', 30_000, async () => 'b');
    await cached('test:opt016:wild:c', 30_000, async () => 'c');
    await new Promise((r) => setTimeout(r, 300));

    const removed = await invalidateCache('test:opt016:wild:*');
    expect(removed).toBeGreaterThanOrEqual(3);
  }, 15_000);
});
