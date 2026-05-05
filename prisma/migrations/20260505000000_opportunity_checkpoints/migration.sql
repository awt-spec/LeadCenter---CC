-- Puntos de control / Checkpoints en oportunidades

-- CreateEnum
CREATE TYPE "CheckpointType" AS ENUM ('MILESTONE', 'REVIEW', 'CLIENT_TOUCH', 'DECISION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CheckpointPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "OpportunityCheckpoint" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "CheckpointType" NOT NULL DEFAULT 'MILESTONE',
    "priority" "CheckpointPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "OpportunityCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpportunityCheckpoint_opportunityId_idx" ON "OpportunityCheckpoint"("opportunityId");
CREATE INDEX "OpportunityCheckpoint_dueDate_idx" ON "OpportunityCheckpoint"("dueDate");
CREATE INDEX "OpportunityCheckpoint_assigneeId_completedAt_idx" ON "OpportunityCheckpoint"("assigneeId", "completedAt");

-- AddForeignKey
ALTER TABLE "OpportunityCheckpoint" ADD CONSTRAINT "OpportunityCheckpoint_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpportunityCheckpoint" ADD CONSTRAINT "OpportunityCheckpoint_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityCheckpoint" ADD CONSTRAINT "OpportunityCheckpoint_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpportunityCheckpoint" ADD CONSTRAINT "OpportunityCheckpoint_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
