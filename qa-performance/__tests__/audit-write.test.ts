// Audit v3 — Batch B: forensics
//
// Verifica que:
//   1. parseUA reconoce browsers y OS comunes
//   2. el helper writeAuditLog se importa donde corresponde
//   3. ningún call site directo a prisma.auditLog.create sobrevive en mutations

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUA, browserLabel, osLabel } from '../../src/lib/audit/ua-parser';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

describe('Batch B: parseUA', () => {
  it('detecta Chrome en macOS', () => {
    const p = parseUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    expect(p.browser).toBe('chrome');
    expect(p.os).toBe('macos');
    expect(p.browserVersion).toBe('131');
    expect(p.isBot).toBe(false);
  });

  it('detecta Safari en iOS', () => {
    const p = parseUA(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    );
    expect(p.browser).toBe('safari');
    expect(p.os).toBe('ios');
    expect(p.browserVersion).toBe('17');
  });

  it('detecta Firefox en Windows', () => {
    const p = parseUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0');
    expect(p.browser).toBe('firefox');
    expect(p.os).toBe('windows');
  });

  it('detecta Edge en Windows', () => {
    const p = parseUA(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    );
    expect(p.browser).toBe('edge');
    expect(p.os).toBe('windows');
  });

  it('detecta Android Chrome', () => {
    const p = parseUA(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    );
    expect(p.browser).toBe('chrome');
    expect(p.os).toBe('android');
  });

  it('marca bots como isBot=true', () => {
    const p = parseUA('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
    expect(p.isBot).toBe(true);
    expect(p.browser).toBe('bot');
  });

  it('UA null/undefined → other/other', () => {
    expect(parseUA(null).browser).toBe('other');
    expect(parseUA(undefined).os).toBe('other');
  });

  it('labels hispanizados', () => {
    expect(browserLabel('chrome')).toBe('Chrome');
    expect(osLabel('macos')).toBe('macOS');
    expect(osLabel('other')).toBe('Desconocido');
  });
});

describe('Batch B: writeAuditLog wiring', () => {
  it('helper exporta writeAuditLog con la firma correcta', () => {
    const src = readFileSync(resolve(root, 'src/lib/audit/write.ts'), 'utf8');
    expect(src).toMatch(/export\s+async\s+function\s+writeAuditLog/);
    expect(src).toMatch(/x-forwarded-for/);
    expect(src).toMatch(/user-agent/);
    expect(src).toMatch(/from\s+'next\/headers'/);
  });

  const callSites = [
    'src/lib/auth.ts',
    'src/lib/rbac-admin.ts',
    'src/lib/tasks/mutations.ts',
    'src/lib/contacts/mutations.ts',
    'src/lib/accounts/mutations.ts',
    'src/lib/opportunities/mutations.ts',
    'src/lib/campaigns/mutations.ts',
    'src/lib/custom-fields/mutations.ts',
    'src/lib/activities/mutations.ts',
    'src/lib/activities/assignees.ts',
    'src/lib/activities/attachments.ts',
  ];

  for (const path of callSites) {
    it(`${path} importa writeAuditLog del helper central`, () => {
      const src = readFileSync(resolve(root, path), 'utf8');
      expect(src).toMatch(/from\s+'@\/lib\/audit\/write'/);
    });
  }

  it('NINGÚN archivo en src/lib/**/mutations* o src/lib/auth.ts hace prisma.auditLog.create directo', () => {
    for (const path of callSites) {
      const src = readFileSync(resolve(root, path), 'utf8');
      expect(src, `${path} tiene aún prisma.auditLog.create`).not.toMatch(
        /prisma\.auditLog\.create/
      );
    }
  });
});

describe('Batch B: UI integration', () => {
  it('audit-table.tsx renderiza UAIcon', () => {
    const src = readFileSync(
      resolve(root, 'src/app/(dashboard)/audit/components/audit-table.tsx'),
      'utf8'
    );
    expect(src).toMatch(/import\s+\{\s*UAIcon\s*\}/);
    expect(src).toMatch(/<UAIcon\s+ua=\{row\.userAgent\}/);
    expect(src).toMatch(/<TableHead[^>]*>Cliente</);
  });
});
