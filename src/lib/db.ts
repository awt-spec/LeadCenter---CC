import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * HOTFIX post-batch3: forzar connection_limit=15 y pool_timeout=20s
 * en el DATABASE_URL si el operador no los puso explícitos.
 *
 * Default de Prisma 5 en Vercel serverless = `num_physical_cpus * 2 + 1`
 * que en una function de 2 CPUs da pool=5. Páginas como /pipeline
 * disparan 6+ queries en Promise.all + el layout (notifications) + auth
 * suman ~9 connections concurrentes → P2024 "Timed out fetching a new
 * connection from the connection pool".
 *
 * El pgbouncer de Supabase tiene pool size 200 por defecto, así que
 * subir a 15 connections desde cada Vercel function es seguro.
 */
function buildDatabaseUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return base;
  // Si el operador ya tiene parámetros propios, respetarlos.
  if (base.includes('connection_limit=')) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}connection_limit=15&pool_timeout=20`;
}

const databaseUrl = buildDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
