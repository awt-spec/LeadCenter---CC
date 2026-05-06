import 'server-only';
import { prisma } from '@/lib/db';

/**
 * OPT-016 — cache compartido cross-instance.
 *
 * `unstable_cache` de Next.js es per-Vercel-function: en cold start
 * desaparece y el cómputo se vuelve a hacer. Esta capa L2 vive en
 * Postgres (tabla `Cache`) y persiste a través de cold starts y entre
 * regiones.
 *
 * Patrón recomendado:
 *
 *   const data = await cached(
 *     `dashboard:${userId}:${canReadAll}`,
 *     60_000,             // TTL 60s
 *     () => loadFresh(userId, canReadAll)
 *   );
 *
 * Para invalidar manualmente (por ejemplo cuando se crea una opp):
 *
 *   await invalidateCache('dashboard:*');   // wildcard prefix
 *
 * Notas:
 *   - El read es 1 round-trip a Postgres (5-15ms vs el cómputo de
 *     200-2000ms que se ahorra).
 *   - Si el SET falla, NO rompemos la request — devolvemos el valor
 *     fresh igual.
 *   - Limpieza lazy: cada miss aprovecha y borra rows expiradas.
 */

const SHARED_CACHE_DEBUG = process.env.SHARED_CACHE_DEBUG === '1';

function debug(...args: unknown[]): void {
  if (SHARED_CACHE_DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[shared-cache]', ...args);
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = new Date();

  // ── L2 read ──
  let row: { value: unknown; expiresAt: Date } | null = null;
  try {
    row = await prisma.cache.findUnique({
      where: { key },
      select: { value: true, expiresAt: true },
    });
  } catch (err) {
    // DB hiccup: degradamos sin bloquear la request.
    debug('read error', key, err);
    return fn();
  }

  if (row && row.expiresAt > now) {
    debug('hit', key);
    return row.value as T;
  }

  if (row) {
    // expirada → borrarla async (lazy sweep)
    void prisma.cache.delete({ where: { key } }).catch(() => undefined);
  }

  // ── L2 miss → compute + store ──
  debug('miss', key);
  const value = await fn();
  const expiresAt = new Date(now.getTime() + ttlMs);

  // upsert async — no esperamos el write para devolver al usuario.
  // Si dos requests caen al miss simultáneas el upsert resuelve la
  // race (el último gana, ambos resultados son equivalentes a este TTL).
  void prisma.cache
    .upsert({
      where: { key },
      create: { key, value: value as object, expiresAt },
      update: { value: value as object, expiresAt },
    })
    .catch((err) => debug('write error', key, err));

  return value;
}

/**
 * Invalida una entrada exacta o todas las que matchean un prefix.
 *
 *   invalidateCache('dashboard:user-123')   // exact
 *   invalidateCache('dashboard:*')          // todas las dashboard:*
 */
export async function invalidateCache(keyOrPrefix: string): Promise<number> {
  if (keyOrPrefix.endsWith('*')) {
    const prefix = keyOrPrefix.slice(0, -1);
    const result = await prisma.cache.deleteMany({
      where: { key: { startsWith: prefix } },
    });
    return result.count;
  }
  const result = await prisma.cache.deleteMany({ where: { key: keyOrPrefix } });
  return result.count;
}

/**
 * Sweep manual de filas expiradas. Útil en cron periódico.
 * En la práctica el lazy sweep de `cached()` cubre el 99%, esto es
 * para que la tabla no crezca con keys que dejaron de ser consultadas.
 */
export async function sweepExpiredCache(): Promise<number> {
  const result = await prisma.cache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
