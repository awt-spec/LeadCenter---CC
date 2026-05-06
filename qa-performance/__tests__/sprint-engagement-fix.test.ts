// Regression: prisma:error en /sprint Marketing por stale enum values
// en campaignContact engagement count.
//
// Bug original: el helper loadMarketingSprint pasaba
//   status: { in: ['ENGAGED', 'OPENED', 'CLICKED', 'REPLIED'] } as never
// Tres de esos valores no existen en `enum CampaignContactStatus`. Prisma
// loggeaba `Invalid value for argument 'in'` en cada GET /sprint.
//
// Este test previene la regresión: el código no debe nunca usar valores
// fuera del enum, y `as never` no debe estar en el archivo.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Sprint engagement count usa solo valores válidos del enum', () => {
  it('schema.prisma define exactamente 7 valores de CampaignContactStatus', () => {
    const src = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
    const match = src.match(/enum\s+CampaignContactStatus\s*\{([^}]+)\}/);
    expect(match).not.toBeNull();
    const values = (match![1].match(/[A-Z_]+/g) ?? []).filter((v) => v.length > 0);
    expect(values.sort()).toEqual(
      ['ACTIVE', 'BOUNCED', 'COMPLETED', 'CONVERTED', 'PAUSED', 'REPLIED', 'UNSUBSCRIBED'].sort()
    );
  });

  it('sprint/queries.ts NO usa valores stale (ENGAGED/OPENED/CLICKED)', () => {
    const src = readFileSync(resolve(root, 'src/lib/sprint/queries.ts'), 'utf8');
    expect(src).not.toMatch(/'ENGAGED'/);
    expect(src).not.toMatch(/'OPENED'/);
    expect(src).not.toMatch(/'CLICKED'/);
  });

  it('sprint/queries.ts NO tiene `as never` casts (eran el bypass del typecheck)', () => {
    const src = readFileSync(resolve(root, 'src/lib/sprint/queries.ts'), 'utf8');
    expect(src).not.toMatch(/as\s+never/);
  });

  it('engagement count en sprint usa REPLIED + CONVERTED', () => {
    const src = readFileSync(resolve(root, 'src/lib/sprint/queries.ts'), 'utf8');
    // El bloque del engaged count
    const engagedBlock = src.match(/const\s+engaged[\s\S]{0,400}/);
    expect(engagedBlock).not.toBeNull();
    expect(engagedBlock![0]).toMatch(/'REPLIED'/);
    expect(engagedBlock![0]).toMatch(/'CONVERTED'/);
  });

  it('NINGÚN archivo en src/ usa los valores stale en strings', () => {
    // Comprobamos los principales callers que vimos en el grep inicial.
    const filesToCheck = [
      'src/lib/sprint/queries.ts',
      'src/lib/campaigns/mutations.ts',
      'src/lib/campaigns/labels.ts',
      'src/app/(dashboard)/campaigns/[id]/page.tsx',
    ];
    for (const f of filesToCheck) {
      const src = readFileSync(resolve(root, f), 'utf8');
      expect(src, `${f} contiene 'ENGAGED'`).not.toMatch(/'ENGAGED'/);
      expect(src, `${f} contiene 'OPENED'`).not.toMatch(/'OPENED'/);
      expect(src, `${f} contiene 'CLICKED'`).not.toMatch(/'CLICKED'/);
    }
  });
});
