-- Audit v3 (Batch C): vistas guardadas de la sección /audit.

CREATE TABLE IF NOT EXISTS "AuditView" (
  "id"        TEXT          NOT NULL,
  "ownerId"   TEXT          NOT NULL,
  "name"      TEXT          NOT NULL,
  "filters"   JSONB         NOT NULL,
  "isShared"  BOOLEAN       NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "AuditView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditView_ownerId_idx" ON "AuditView" ("ownerId");

ALTER TABLE "AuditView"
  ADD CONSTRAINT "AuditView_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
