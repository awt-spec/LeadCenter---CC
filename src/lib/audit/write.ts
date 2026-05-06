import 'server-only';
import { headers } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

/**
 * Helper centralizado para escribir entradas de AuditLog.
 *
 * Captura automáticamente `ipAddress` y `userAgent` del request en curso
 * (vía `next/headers`). En contextos sin request (cron, seed, scripts)
 * los headers tiran error → caemos a null y seguimos.
 *
 * Reglas:
 *   - Nunca tirar excepción que pueda romper la mutation real. El caller
 *     debe poder ignorar el resultado: `void writeAuditLog(...).catch(...)`.
 *   - `userId` puede ser null para acciones de sistema o pre-login.
 *   - `changes` y `metadata` son JSON arbitrario; pasamos como están.
 */

export type AuditWriteInput = {
  userId: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
};

async function getRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    // Vercel pone la IP del cliente en x-forwarded-for con la cadena de
    // proxies; el primer entry es el real. Como fallback, x-real-ip.
    const fwd = h.get('x-forwarded-for');
    const ipAddress = fwd?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
    const userAgent = h.get('user-agent');
    return { ipAddress, userAgent };
  } catch {
    // headers() throw fuera de un request scope (cron, seed). Es esperado.
    return { ipAddress: null, userAgent: null };
  }
}

export async function writeAuditLog(input: AuditWriteInput): Promise<void> {
  const { ipAddress, userAgent } = await getRequestContext();
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      changes: input.changes ?? undefined,
      metadata: input.metadata ?? undefined,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Variante fire-and-forget — para hot paths donde no queremos
 * bloquear la respuesta del usuario por escribir el log.
 * Errores se loggean a console pero no propagan.
 */
export function writeAuditLogAsync(input: AuditWriteInput): void {
  void writeAuditLog(input).catch((err) => {
    console.error('[audit] writeAuditLog failed:', err);
  });
}
