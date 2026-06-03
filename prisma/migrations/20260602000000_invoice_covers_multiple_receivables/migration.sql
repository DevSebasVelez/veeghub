-- Flip Invoice<->Receivable from 1:1 to 1:N (one invoice covers many receivables).
-- The FK moves from Invoice.receivableId to Receivable.invoiceId.

-- DropForeignKey (old 1:1 owner side on Invoice)
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_receivableId_fkey";

-- AlterTable: add new owning FK column on Receivable
ALTER TABLE "Receivable" ADD COLUMN "invoiceId" TEXT;

-- Backfill: preserve existing links before dropping the old column
UPDATE "Receivable" r
SET "invoiceId" = i."id"
FROM "Invoice" i
WHERE i."receivableId" = r."id";

-- DropIndex + DropColumn on Invoice (old 1:1 column)
DROP INDEX "Invoice_receivableId_key";
ALTER TABLE "Invoice" DROP COLUMN "receivableId";

-- CreateIndex
CREATE INDEX "Receivable_invoiceId_idx" ON "Receivable"("invoiceId");

-- AddForeignKey
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
