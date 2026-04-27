-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "ResumeSourceType" AS ENUM ('TEXT', 'MARKDOWN', 'PDF', 'DOCX');

-- CreateEnum
CREATE TYPE "DiagnosisJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DiagnosisSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DiagnosisItemStatus" AS ENUM ('OPEN', 'ADOPTED', 'IGNORED', 'MANUALLY_EDITED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceType" "ResumeSourceType" NOT NULL DEFAULT 'TEXT',
    "rawText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResumeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "resumeDocumentId" TEXT,
    "targetRole" TEXT,
    "targetLevel" TEXT,
    "techStack" TEXT,
    "businessDomain" TEXT,
    "status" "DiagnosisJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DiagnosisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosisItem" (
    "id" TEXT NOT NULL,
    "diagnosisJobId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "DiagnosisSeverity" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestion" TEXT,
    "status" "DiagnosisItemStatus" NOT NULL DEFAULT 'OPEN',
    "userNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "diagnosisJobId" TEXT,
    "title" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "overallScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRound" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "referenceAnswer" TEXT,
    "userAnswer" TEXT,
    "feedback" TEXT,
    "score" INTEGER,
    "followUpQuestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_accessKey_key" ON "Workspace"("accessKey");

-- CreateIndex
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");

-- CreateIndex
CREATE INDEX "ResumeDocument_workspaceId_createdAt_idx" ON "ResumeDocument"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosisJob_workspaceId_status_createdAt_idx" ON "DiagnosisJob"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosisJob_resumeDocumentId_idx" ON "DiagnosisJob"("resumeDocumentId");

-- CreateIndex
CREATE INDEX "DiagnosisItem_diagnosisJobId_status_idx" ON "DiagnosisItem"("diagnosisJobId", "status");

-- CreateIndex
CREATE INDEX "InterviewSession_workspaceId_status_createdAt_idx" ON "InterviewSession"("workspaceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewSession_diagnosisJobId_idx" ON "InterviewSession"("diagnosisJobId");

-- CreateIndex
CREATE INDEX "SessionRound_sessionId_createdAt_idx" ON "SessionRound"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ResumeDocument" ADD CONSTRAINT "ResumeDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisJob" ADD CONSTRAINT "DiagnosisJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisJob" ADD CONSTRAINT "DiagnosisJob_resumeDocumentId_fkey" FOREIGN KEY ("resumeDocumentId") REFERENCES "ResumeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosisItem" ADD CONSTRAINT "DiagnosisItem_diagnosisJobId_fkey" FOREIGN KEY ("diagnosisJobId") REFERENCES "DiagnosisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_diagnosisJobId_fkey" FOREIGN KEY ("diagnosisJobId") REFERENCES "DiagnosisJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRound" ADD CONSTRAINT "SessionRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

