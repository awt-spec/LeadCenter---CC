-- OPT-016: Cache compartido persistente.
-- Helper en src/lib/shared/shared-cache.ts hace upsert/read.
-- Limpieza lazy: cada miss + sweep periódico via cron (futuro).

CREATE TABLE IF NOT EXISTS "Cache" (
  "key"       TEXT          NOT NULL,
  "value"     JSONB         NOT NULL,
  "expiresAt" TIMESTAMP(3)  NOT NULL,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "Cache_expiresAt_idx" ON "Cache" ("expiresAt");
