-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "sriAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sriAuthorizedXml" TEXT,
ADD COLUMN     "sriLastError" TEXT,
ADD COLUMN     "sriLeaseUntil" TIMESTAMP(3),
ADD COLUMN     "sriNextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "sriXml" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_sriStatus_sriNextAttemptAt_idx" ON "Invoice"("sriStatus", "sriNextAttemptAt");

