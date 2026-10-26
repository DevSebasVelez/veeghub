-- CreateEnum
CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'WEB_CHAT';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "aiInsights" JSONB,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "chatSessionId" TEXT,
ADD COLUMN     "conversation" JSONB,
ADD COLUMN     "temperature" "LeadTemperature";

-- CreateIndex
CREATE UNIQUE INDEX "Lead_chatSessionId_key" ON "Lead"("chatSessionId");

-- CreateIndex
CREATE INDEX "Lead_temperature_createdAt_idx" ON "Lead"("temperature", "createdAt");

