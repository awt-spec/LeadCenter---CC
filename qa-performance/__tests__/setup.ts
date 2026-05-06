// Vitest setup — usa DIRECT_URL para tests (sin pgbouncer pooling, mejor
// para asserts deterministas sobre EXPLAIN). El test runner se conecta a la
// MISMA DB de prod en modo lectura.
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const envLocal = resolve(here, '../../.env.local');
const envDefault = resolve(here, '../../.env');
config({ path: envLocal });
config({ path: envDefault });

// Si la app usa DIRECT_URL para Prisma migrations pero DATABASE_URL para
// runtime, copiamos DIRECT_URL → DATABASE_URL si esta última no está set.
if (!process.env.DATABASE_URL && process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const directUrl = process.env.DIRECT_URL ?? '';
if (!process.env.DATABASE_URL && directUrl) {
  process.env.DATABASE_URL = directUrl;
}

if (!process.env.DATABASE_URL) {
  console.warn('[vitest setup] DATABASE_URL/DIRECT_URL no definidas — los tests fallarán.');
}
