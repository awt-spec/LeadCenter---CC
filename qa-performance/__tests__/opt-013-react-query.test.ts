// OPT-013: React Query (TanStack Query) integrado para client-side cache.
// Tests estáticos: verifica que el provider está montado y que los hooks
// principales existen. Beneficio en runtime se mide manualmente abriendo
// 2 task drawers seguidos del mismo task — debería hacer 1 request en vez
// de 2.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('OPT-013: React Query montado', () => {
  it('package.json tiene @tanstack/react-query', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@tanstack/react-query']).toBeDefined();
  });

  it('QueryProvider existe y exporta el componente', () => {
    const src = readFileSync(resolve(root, 'src/components/query-provider.tsx'), 'utf8');
    expect(src).toMatch(/'use client'/);
    expect(src).toMatch(/import\s+\{[^}]*QueryClient[^}]*\}\s+from\s+'@tanstack\/react-query'/);
    expect(src).toMatch(/export\s+function\s+QueryProvider/);
  });

  it('Dashboard layout monta el QueryProvider', () => {
    const src = readFileSync(resolve(root, 'src/app/(dashboard)/layout.tsx'), 'utf8');
    expect(src).toMatch(/import\s+\{\s*QueryProvider\s*\}/);
    expect(src).toMatch(/<QueryProvider>/);
  });

  it('Hook useAccountContacts existe', () => {
    const src = readFileSync(resolve(root, 'src/lib/hooks/use-account-contacts.ts'), 'utf8');
    expect(src).toMatch(/export\s+function\s+useAccountContacts/);
    expect(src).toMatch(/useQuery/);
  });

  it('activity-composer usa useAccountContacts (no fetch manual)', () => {
    const src = readFileSync(resolve(root, 'src/components/activities/activity-composer.tsx'), 'utf8');
    expect(src).toMatch(/useAccountContacts/);
    // Y NO debe tener fetch directo a contacts-mini
    expect(src).not.toMatch(/fetch\s*\(\s*[`'"]\/api\/accounts\/\$\{accountId\}\/contacts-mini/);
  });
});
