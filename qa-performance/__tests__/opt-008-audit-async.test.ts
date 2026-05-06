// OPT-008: writeAuditLog tiene que ser fire-and-forget (no bloquear
// el JWT callback). Como NextAuth corre en server-side y mockear
// la transformación de NextAuth es complicado, este test sólo
// verifica el patrón estático: que el código fuente NO use
// `await writeAuditLog(...)` en los callbacks de auth.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const authPath = resolve(here, '../../src/lib/auth.ts');
const source = readFileSync(authPath, 'utf8');

describe('OPT-008: writeAuditLog NO bloquea login/logout', () => {
  it('No hay `await writeAuditLog(` en src/lib/auth.ts', () => {
    expect(source).not.toMatch(/await\s+writeAuditLog\s*\(/);
  });

  it('Los call sites usan void/.catch para fire-and-forget', () => {
    // Cada CALL (no la definición) debe estar precedida por `void`
    // o seguida por `.catch(`. Para excluir la definición, ignoramos
    // matches precedidos por `function ` o `async function `.
    const callRe = /(\b(?:async\s+function|function)\s+)?writeAuditLog\s*\(/g;
    let count = 0;
    for (const m of source.matchAll(callRe)) {
      // skip the function declaration
      if (m[1]) continue;
      const idx = m.index ?? 0;
      const before = source.slice(Math.max(0, idx - 6), idx);
      const after = source.slice(idx, Math.min(source.length, idx + 200));
      const isFireForget = /void\s*$/.test(before) || /\.catch\s*\(/.test(after);
      expect(isFireForget, `Call en idx ${idx} no es fire-and-forget. before="${before}" after="${after.slice(0, 80)}"`).toBe(true);
      count++;
    }
    expect(count, 'No se encontraron call sites de writeAuditLog').toBeGreaterThan(0);
  });
});
