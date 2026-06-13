-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByAgentId" TEXT;
