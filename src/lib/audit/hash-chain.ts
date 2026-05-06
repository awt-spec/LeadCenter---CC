import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Tamper-evident hash chain sobre AuditLog.
 *
 * Cada row guarda:
 *   - `previousHash`: hash del row inmediatamente anterior por createdAt
 *   - `hash`: sha256 hex de campos canonicalizados de este row + previousHash
 *
 * Si alguien edita un row a mano (o lo borra), el `hash` recalculado
 * no coincidirá con el `previousHash` del row siguiente. `verifyChain`
 * detecta el quiebre.
 *
 * Limitación conocida (asumida): si dos requests escriben en paralelo,
 * `getLastHash` puede devolver el mismo valor a ambos → resultado: dos
 * rows con el mismo previousHash. `verifyChain` lo reportaría. Para MVP
 * aceptamos la race; un futuro fix usaría advisory_lock o secuencia.
 */

type HashableRow = {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  changes: unknown;
  metadata: unknown;
  createdAt: Date;
};

export function computeHash(row: HashableRow, previousHash: string | null): string {
  const canonical = [
    row.id,
    row.userId ?? '',
    row.action,
    row.resource,
    row.resourceId ?? '',
    JSON.stringify(row.changes ?? null),
    JSON.stringify(row.metadata ?? null),
    row.createdAt.toISOString(),
    previousHash ?? '',
  ].join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

export async function getLastHash(): Promise<string | null> {
  const last = await prisma.auditLog.findFirst({
    where: { hash: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  });
  return last?.hash ?? null;
}

export type ChainBreak = {
  id: string;
  previousId: string | null;
  expectedPrevHash: string | null;
  storedPrevHash: string | null;
  expectedHash: string;
  storedHash: string | null;
};

export type VerifyResult = {
  ok: boolean;
  totalChecked: number;
  firstBreak: ChainBreak | null;
};

/**
 * Verifica la cadena en orden cronológico ascendente sobre los últimos
 * `days` días. Para una cadena de 30d con ~10K rows tarda ~200ms.
 */
export async function verifyChain(days = 30): Promise<VerifyResult> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.auditLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      userId: true,
      action: true,
      resource: true,
      resourceId: true,
      changes: true,
      metadata: true,
      createdAt: true,
      hash: true,
      previousHash: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  let lastHash: string | null = null;
  let totalChecked = 0;
  let prevId: string | null = null;

  for (const row of rows) {
    if (row.hash === null) {
      // Row sin hash (antes de Batch D o falló el update) — saltamos.
      // No es un break per se; backfill puede correr después.
      continue;
    }

    // El previousHash del row debe coincidir con el último hash visto
    if (lastHash !== null && row.previousHash !== lastHash) {
      return {
        ok: false,
        totalChecked,
        firstBreak: {
          id: row.id,
          previousId: prevId,
          expectedPrevHash: lastHash,
          storedPrevHash: row.previousHash,
          expectedHash: computeHash(row, lastHash),
          storedHash: row.hash,
        },
      };
    }

    // Recomputar hash y comparar
    const expected = computeHash(row, row.previousHash);
    if (expected !== row.hash) {
      return {
        ok: false,
        totalChecked,
        firstBreak: {
          id: row.id,
          previousId: prevId,
          expectedPrevHash: row.previousHash,
          storedPrevHash: row.previousHash,
          expectedHash: expected,
          storedHash: row.hash,
        },
      };
    }

    lastHash = row.hash;
    prevId = row.id;
    totalChecked += 1;
  }

  return { ok: true, totalChecked, firstBreak: null };
}
