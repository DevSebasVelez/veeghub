-- AlterTable
ALTER TABLE "MetaAdAccount" ADD COLUMN     "lastBackfillAt" TIMESTAMP(3),
ADD COLUMN     "lastFullSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastQuickSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT;

-- AlterTable
ALTER TABLE "MetaCampaignInsight" ADD COLUMN     "conversations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "linkClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metaLeads" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MetaCampaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "objective" TEXT,
    "buyingType" TEXT,
    "bidStrategy" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "createdTime" TIMESTAMP(3),
    "updatedTime" TIMESTAMP(3),
    "issues" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdSet" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "optimizationGoal" TEXT,
    "destinationType" TEXT,
    "billingEvent" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "audience" TEXT,
    "learningStatus" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effectiveStatus" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "title" TEXT,
    "body" TEXT,
    "reviewFeedback" JSONB,
    "issues" JSONB,
    "createdTime" TIMESTAMP(3),
    "alertedStatus" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdInsight" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "metaLeads" INTEGER NOT NULL DEFAULT 0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaAdInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaPeriodStat" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "since" DATE NOT NULL,
    "until" DATE NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaPeriodStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaBreakdown" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "dimension" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "spend" DECIMAL(12,2) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "metaLeads" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaCampaign_effectiveStatus_idx" ON "MetaCampaign"("effectiveStatus");

-- CreateIndex
CREATE INDEX "MetaAdSet_campaignId_idx" ON "MetaAdSet"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAd_campaignId_idx" ON "MetaAd"("campaignId");

-- CreateIndex
CREATE INDEX "MetaAd_adSetId_idx" ON "MetaAd"("adSetId");

-- CreateIndex
CREATE INDEX "MetaAdInsight_campaignId_date_idx" ON "MetaAdInsight"("campaignId", "date");

-- CreateIndex
CREATE INDEX "MetaAdInsight_date_idx" ON "MetaAdInsight"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaAdInsight_adId_date_key" ON "MetaAdInsight"("adId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetaPeriodStat_kind_campaignId_since_key" ON "MetaPeriodStat"("kind", "campaignId", "since");

-- CreateIndex
CREATE UNIQUE INDEX "MetaBreakdown_month_dimension_key_key" ON "MetaBreakdown"("month", "dimension", "key");

-- AddForeignKey
ALTER TABLE "MetaAdSet" ADD CONSTRAINT "MetaAdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "MetaAdSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
