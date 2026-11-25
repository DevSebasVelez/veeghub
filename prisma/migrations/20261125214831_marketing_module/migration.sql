-- CreateEnum
CREATE TYPE "ContentChannel" AS ENUM ('LINKEDIN_PERSONAL', 'LINKEDIN_COMPANY', 'GBP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'BLOG');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('IDEA', 'BORRADOR', 'EN_REVISION', 'APROBADO', 'PROGRAMADO', 'PUBLICADO', 'FALLIDO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "IdeaStage" AS ENUM ('IDEA', 'GUION', 'GRABADO', 'EDITADO', 'PUBLICADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGEN', 'VIDEO', 'RENDER_3D', 'CAPTURA', 'LOGO', 'PLANTILLA', 'OTRO');

-- CreateTable
CREATE TABLE "ContentCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "objective" TEXT,
    "startsOn" DATE,
    "endsOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT,
    "ideaId" TEXT,
    "channel" "ContentChannel" NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'BORRADOR',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "firstComment" TEXT,
    "linkUrl" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "aiGenerationId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "dueNotifiedAt" TIMESTAMP(3),
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "legacyId" INTEGER,
    "source" TEXT,
    "title" TEXT NOT NULL,
    "sector" TEXT,
    "category" TEXT,
    "format" TEXT,
    "stage" "IdeaStage" NOT NULL DEFAULT 'IDEA',
    "priority" INTEGER,
    "audience" TEXT,
    "beats" JSONB NOT NULL,
    "visualPrompt" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "words" INTEGER,
    "seconds" INTEGER,
    "tags" TEXT[],
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "tags" TEXT[],
    "alt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPostAsset" (
    "postId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ContentPostAsset_pkey" PRIMARY KEY ("postId","assetId")
);

-- CreateTable
CREATE TABLE "BrandGuideline" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandGuideline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiGeneration" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER,
    "costUsd" DECIMAL(10,5) NOT NULL,
    "validatorFlags" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" "ContentChannel" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentCampaign_slug_key" ON "ContentCampaign"("slug");

-- CreateIndex
CREATE INDEX "ContentPost_status_scheduledAt_idx" ON "ContentPost"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContentPost_channel_scheduledAt_idx" ON "ContentPost"("channel", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContentPost_campaignId_idx" ON "ContentPost"("campaignId");

-- CreateIndex
CREATE INDEX "ContentIdea_stage_idx" ON "ContentIdea"("stage");

-- CreateIndex
CREATE INDEX "ContentIdea_sector_idx" ON "ContentIdea"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "ContentIdea_source_legacyId_key" ON "ContentIdea"("source", "legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentAsset_r2Key_key" ON "ContentAsset"("r2Key");

-- CreateIndex
CREATE INDEX "ContentAsset_kind_createdAt_idx" ON "ContentAsset"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ContentPostAsset_assetId_idx" ON "ContentPostAsset"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandGuideline_key_key" ON "BrandGuideline"("key");

-- CreateIndex
CREATE INDEX "AiGeneration_createdAt_idx" ON "AiGeneration"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_channel_key" ON "ChannelConnection"("channel");

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ContentCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPost" ADD CONSTRAINT "ContentPost_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "ContentIdea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPostAsset" ADD CONSTRAINT "ContentPostAsset_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ContentPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPostAsset" ADD CONSTRAINT "ContentPostAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
