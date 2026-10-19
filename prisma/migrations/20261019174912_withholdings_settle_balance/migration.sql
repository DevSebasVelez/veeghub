-- AlterTable
ALTER TABLE "Receivable" ADD COLUMN     "withheldAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Withholding" ADD COLUMN     "appliesToBalance" BOOLEAN NOT NULL DEFAULT false;
