-- Audit v3 (Batch D): review humano + tamper-evident hash chain.
-- Todas las columnas son nullable; rows existentes se quedan con null.

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewNote"   TEXT,
  ADD COLUMN IF NOT EXISTS "hash"         TEXT,
  ADD COLUMN IF NOT EXISTS "previousHash" TEXT;

-- FK del reviewer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AuditLog_reviewedById_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index de reviewedAt para queries "no revisados"
CREATE INDEX IF NOT EXISTS "AuditLog_reviewedAt_idx" ON "AuditLog" ("reviewedAt");
