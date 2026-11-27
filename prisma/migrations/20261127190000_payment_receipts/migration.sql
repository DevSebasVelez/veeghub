-- AlterTable
ALTER TABLE "EmailDelivery" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'INVOICE',
ADD COLUMN     "paymentId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptFolio" TEXT,
ADD COLUMN     "receiptIssuedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "EmailDelivery_paymentId_idx" ON "EmailDelivery"("paymentId");

-- CreateIndex
CREATE INDEX "EmailDelivery_clientId_idx" ON "EmailDelivery"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptFolio_key" ON "Payment"("receiptFolio");

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

