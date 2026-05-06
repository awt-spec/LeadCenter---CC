// HOTFIX-001: Prisma connection_limit en DATABASE_URL.
// Páginas pesadas (pipeline, dashboard) abren 6-9 queries concurrentes;
// el default de pool=5 en Vercel serverless se queda corto y dispara
// P2024. Este test garantiza que el helper en db.ts inyecte los params
// si el DATABASE_URL no los trae explícitos.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('HOTFIX-001: db.ts inyecta connection_limit', () => {
  it('db.ts tiene buildDatabaseUrl con connection_limit=15', () => {
    const src = readFileSync(resolve(root, 'src/lib/db.ts'), 'utf8');
    expect(src).toMatch(/buildDatabaseUrl/);
    expect(src).toMatch(/connection_limit=15/);
    expect(src).toMatch(/pool_timeout=20/);
  });

  it('respeta connection_limit existente en DATABASE_URL del operador', () => {
    const src = readFileSync(resolve(root, 'src/lib/db.ts'), 'utf8');
    // Debe haber una guarda que evite duplicar el param si ya existe.
    expect(src).toMatch(/includes\(\s*['"`]connection_limit=['"`]\s*\)/);
  });

  it('PrismaClient usa el url construido cuando DATABASE_URL existe', () => {
    const src = readFileSync(resolve(root, 'src/lib/db.ts'), 'utf8');
    expect(src).toMatch(/datasources:\s*\{\s*db:\s*\{\s*url:\s*databaseUrl\s*\}/);
  });
});
