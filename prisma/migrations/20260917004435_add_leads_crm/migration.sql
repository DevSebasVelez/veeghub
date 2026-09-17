-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('META_ADS', 'INSTAGRAM', 'WHATSAPP', 'REFERRAL', 'WEBSITE', 'MANUAL', 'CSV_IMPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'STAGE_CHANGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MetaEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneRaw" TEXT,
    "company" TEXT,
    "message" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'META_ADS',
    "serviceTag" TEXT,
    "estimatedValue" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "lostReason" TEXT,
    "metaLeadId" TEXT,
    "metaFormId" TEXT,
    "metaFormName" TEXT,
    "metaPageId" TEXT,
    "metaAdId" TEXT,
    "metaAdName" TEXT,
    "metaAdsetId" TEXT,
    "metaAdsetName" TEXT,
    "metaCampaignId" TEXT,
    "metaCampaignName" TEXT,
    "metaCreatedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "firstContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "convertedClientId" TEXT,
    "convertedProjectId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "body" TEXT,
    "fromStage" "LeadStage",
    "toStage" "LeadStage",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPage" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "encryptedToken" TEXT,
    "tokenIv" TEXT,
    "tokenTag" TEXT,
    "tokenPreview" TEXT,
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "subscribedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3),
    "lastBackfillAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaWebhookEvent" (
    "id" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "pageId" TEXT,
    "formId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "MetaEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "MetaWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_metaLeadId_key" ON "Lead"("metaLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedClientId_key" ON "Lead"("convertedClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedProjectId_key" ON "Lead"("convertedProjectId");

-- CreateIndex
CREATE INDEX "lead_stage_created_idx" ON "Lead"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "lead_stage_followup_idx" ON "Lead"("stage", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "lead_source_created_idx" ON "Lead"("source", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_metaCampaignId_idx" ON "Lead"("metaCampaignId");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "lead_activity_lead_occurred_idx" ON "LeadActivity"("leadId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaPage_pageId_key" ON "MetaPage"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "MetaWebhookEvent_leadgenId_key" ON "MetaWebhookEvent"("leadgenId");

-- CreateIndex
CREATE INDEX "meta_event_status_received_idx" ON "MetaWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedClientId_fkey" FOREIGN KEY ("convertedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedProjectId_fkey" FOREIGN KEY ("convertedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
