// OPT-007: loadUserPermissions tiene que estar wrappeado con
// unstable_cache. Test estático sobre el código fuente porque
// unstable_cache es server-only y mockearlo en vitest es overkill.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../src/lib/auth.ts'), 'utf8');

describe('OPT-007: loadUserPermissions con unstable_cache', () => {
  it('Importa unstable_cache de next/cache', () => {
    expect(source).toMatch(/import\s+\{[^}]*unstable_cache[^}]*\}\s+from\s+'next\/cache'/);
  });

  it('loadUserPermissions está wrappeado con unstable_cache', () => {
    // Esperamos que `loadUserPermissions` se asigne a unstable_cache(...).
    expect(source).toMatch(
      /loadUserPermissions\s*=\s*unstable_cache\s*\(/
    );
  });

  it('El cache tiene revalidate y tags configurados', () => {
    expect(source).toMatch(/revalidate:\s*\d+/);
    expect(source).toMatch(/tags:\s*\[\s*['"]user-permissions['"]\s*\]/);
  });
});
