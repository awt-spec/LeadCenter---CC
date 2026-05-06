// OPT-010: endpoints idempotentes deben retornar Cache-Control header
// para que el browser pueda reutilizar el JSON en navegación
// back/forward. Test estático sobre el código.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

interface Endpoint {
  path: string;
  shouldCache: boolean;
}

const ENDPOINTS: Endpoint[] = [
  { path: 'src/app/api/accounts/[id]/contacts-mini/route.ts', shouldCache: true },
  { path: 'src/app/api/tasks/[id]/route.ts', shouldCache: true },
];

describe('OPT-010: Cache-Control headers en endpoints idempotentes', () => {
  for (const ep of ENDPOINTS) {
    it(`${ep.path} ${ep.shouldCache ? 'envía' : 'no envía'} Cache-Control`, () => {
      const source = readFileSync(resolve(root, ep.path), 'utf8');
      if (ep.shouldCache) {
        expect(source).toMatch(/['"]Cache-Control['"]:\s*['"][^'"]*max-age/);
        // private (no shared cache) recommendable para responses con datos
        // user-specific. Permitimos public si el endpoint no tiene RBAC.
        const hasPrivate = /['"]Cache-Control['"]:\s*['"][^'"]*private/.test(source);
        const hasPublic = /['"]Cache-Control['"]:\s*['"][^'"]*public/.test(source);
        expect(hasPrivate || hasPublic, 'Cache-Control debe declarar private o public').toBe(true);
      } else {
        expect(source).not.toMatch(/['"]Cache-Control['"]/);
      }
    });
  }
});
