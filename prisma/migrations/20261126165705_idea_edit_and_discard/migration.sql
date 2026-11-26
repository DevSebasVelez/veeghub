-- AlterEnum
ALTER TYPE "IdeaStage" ADD VALUE 'DESCARTADO';

-- AlterTable
ALTER TABLE "ContentIdea" ADD COLUMN     "editedAt" TIMESTAMP(3);
