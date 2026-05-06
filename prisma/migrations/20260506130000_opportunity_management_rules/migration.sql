-- Reglas de gestión en oportunidades + vistas guardadas.
-- Idempotente: usa IF NOT EXISTS y guards para que se pueda re-ejecutar.

-- 1) Enum ActivityDirection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityDirection') THEN
    CREATE TYPE "ActivityDirection" AS ENUM ('OUTBOUND', 'INBOUND', 'INTERNAL');
  END IF;
END $$;

-- 2) Activity.direction
ALTER TABLE "Activity"
  ADD COLUMN IF NOT EXISTS "direction" "ActivityDirection";

-- 3) Backfill direction según el type existente:
UPDATE "Activity"
SET "direction" = CASE
  WHEN "type" = 'EMAIL_RECEIVED' THEN 'INBOUND'::"ActivityDirection"
  WHEN "type" IN ('INTERNAL_NOTE', 'STAGE_CHANGE', 'STATUS_CHANGE', 'CONTACT_LINKED') THEN 'INTERNAL'::"ActivityDirection"
  ELSE 'OUTBOUND'::"ActivityDirection"
END
WHERE "direction" IS NULL;

-- 4) Opportunity.lastActivityDirection
ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "lastActivityDirection" "ActivityDirection";

-- 5) Backfill lastActivityDirection desde la última actividad por opp:
WITH latest AS (
  SELECT DISTINCT ON ("opportunityId") "opportunityId", "direction"
  FROM "Activity"
  WHERE "opportunityId" IS NOT NULL
  ORDER BY "opportunityId", "occurredAt" DESC
)
UPDATE "Opportunity" o
SET "lastActivityDirection" = latest."direction"
FROM latest
WHERE o."id" = latest."opportunityId"
  AND o."lastActivityDirection" IS NULL;

-- 6) OpportunityView model (vistas guardadas)
CREATE TABLE IF NOT EXISTS "OpportunityView" (
  "id"        TEXT          NOT NULL,
  "ownerId"   TEXT          NOT NULL,
  "name"      TEXT          NOT NULL,
  "filters"   JSONB         NOT NULL,
  "isShared"  BOOLEAN       NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "OpportunityView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OpportunityView_ownerId_idx" ON "OpportunityView" ("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'OpportunityView_ownerId_fkey'
  ) THEN
    ALTER TABLE "OpportunityView"
      ADD CONSTRAINT "OpportunityView_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
