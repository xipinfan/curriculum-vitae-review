-- AlterTable
ALTER TABLE "ResumeDocument"
  ADD COLUMN "parsedData" JSONB,
  ADD COLUMN "parserVersion" TEXT,
  ADD COLUMN "parsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ResumeDocument_workspaceId_parsedAt_idx" ON "ResumeDocument"("workspaceId", "parsedAt");
