-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "issueRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_issueRequestId_key" ON "Invoice"("issueRequestId");
