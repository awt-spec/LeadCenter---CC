-- OPT-001: drop single-col indexes redundantes en Activity para forzar al
-- planner a usar los composites. Recrear los composites sin partial WHERE
-- (el planner los descartaba con WHERE accountId IS NOT NULL).
--
-- Antes: timeline de cuenta hot = 1.5-19s p99 (Index Scan Backward sobre
-- Activity_occurredAt_idx + Filter que descartaba 94K filas).
-- Después: timeline = <50ms (Index Scan sobre composite, walks index ordenado
-- y para en LIMIT).
--
-- También recrearemos los composites SIN `WHERE accountId IS NOT NULL`
-- porque cuando se borraron los single-col, el planner empezó a hacer
-- Seq Scan en lugar de usar el partial. Postgres a veces evita partial
-- indexes cuando la cláusula WHERE no es exactamente la misma del query.

DROP INDEX IF EXISTS "Activity_occurredAt_idx";
DROP INDEX IF EXISTS "Activity_accountId_idx";
DROP INDEX IF EXISTS "Activity_contactId_idx";
DROP INDEX IF EXISTS "Activity_opportunityId_idx";

DROP INDEX IF EXISTS "Activity_accountId_occurredAt_idx";
DROP INDEX IF EXISTS "Activity_opportunityId_occurredAt_idx";
DROP INDEX IF EXISTS "Activity_contactId_occurredAt_idx";

CREATE INDEX "Activity_accountId_occurredAt_idx" ON "Activity" ("accountId", "occurredAt" DESC);
CREATE INDEX "Activity_opportunityId_occurredAt_idx" ON "Activity" ("opportunityId", "occurredAt" DESC);
CREATE INDEX "Activity_contactId_occurredAt_idx" ON "Activity" ("contactId", "occurredAt" DESC);

ANALYZE "Activity";
