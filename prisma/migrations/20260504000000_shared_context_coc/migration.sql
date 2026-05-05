-- C.O.C. — Contexto Organizacional Compartido
-- Vista 360 colaborativa por cuenta. Cualquier participante de LeadCenter puede
-- leer/editar. Una sola SharedContext por Account; múltiples versiones por
-- audiencia y un repositorio de recursos externos (Lovable, Slides, Figma…).

-- CreateEnum
CREATE TYPE "SharedContextStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContextAudience" AS ENUM ('PROSPECT', 'INTERNAL', 'FINANCE', 'TECHNICAL', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "ContextLinkType" AS ENUM ('PRESENTATION', 'DOCUMENT', 'SPREADSHEET', 'LOVABLE', 'FIGMA', 'VIDEO', 'WEBSITE', 'REPO', 'OTHER');

-- CreateTable
CREATE TABLE "SharedContext" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "headline" TEXT,
    "strategy" TEXT,
    "goals" TEXT,
    "risks" TEXT,
    "nextSteps" TEXT,
    "status" "SharedContextStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "SharedContext_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedContext_accountId_key" ON "SharedContext"("accountId");
CREATE INDEX "SharedContext_accountId_idx" ON "SharedContext"("accountId");

-- AddForeignKey
ALTER TABLE "SharedContext" ADD CONSTRAINT "SharedContext_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedContext" ADD CONSTRAINT "SharedContext_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedContext" ADD CONSTRAINT "SharedContext_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SharedContextVersion" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "audience" "ContextAudience" NOT NULL,
    "body" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,
    CONSTRAINT "SharedContextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedContextVersion_contextId_audience_key" ON "SharedContextVersion"("contextId", "audience");
CREATE INDEX "SharedContextVersion_contextId_idx" ON "SharedContextVersion"("contextId");

-- AddForeignKey
ALTER TABLE "SharedContextVersion" ADD CONSTRAINT "SharedContextVersion_contextId_fkey"
    FOREIGN KEY ("contextId") REFERENCES "SharedContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedContextVersion" ADD CONSTRAINT "SharedContextVersion_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SharedContextLink" (
    "id" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ContextLinkType" NOT NULL DEFAULT 'OTHER',
    "audience" "ContextAudience",
    "domain" TEXT,
    "thumbnail" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "SharedContextLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SharedContextLink_contextId_idx" ON "SharedContextLink"("contextId");

-- AddForeignKey
ALTER TABLE "SharedContextLink" ADD CONSTRAINT "SharedContextLink_contextId_fkey"
    FOREIGN KEY ("contextId") REFERENCES "SharedContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedContextLink" ADD CONSTRAINT "SharedContextLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
