-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PayeeKind" AS ENUM ('COLLABORATOR', 'SUPPLIER', 'EMPLOYEE', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxTreatment" AS ENUM ('UNCLASSIFIED', 'DEDUCTIBLE', 'NON_DEDUCTIBLE', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "WithholdingKind" AS ENUM ('VAT', 'INCOME');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "vatRate" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PayeeKind" NOT NULL DEFAULT 'OTHER',
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "payeeId" TEXT,
    "payeeKind" "PayeeKind",
    "projectId" TEXT,
    "expenseDate" DATE NOT NULL,
    "paidAt" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "receiptNumber" TEXT,
    "receiptFileId" TEXT,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'UNCLASSIFIED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withholding" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "WithholdingKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "percentage" DECIMAL(5,2),
    "receiptNumber" TEXT,
    "issueDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withholding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "regime" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "vatRates" DECIMAL(5,2)[],
    "lastVerifiedAt" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE INDEX "Payee_name_idx" ON "Payee"("name");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_paidAt_idx" ON "Expense"("paidAt");

-- CreateIndex
CREATE INDEX "expense_project_date_idx" ON "Expense"("projectId", "expenseDate");

-- CreateIndex
CREATE INDEX "expense_status_date_idx" ON "Expense"("status", "expenseDate");

-- CreateIndex
CREATE INDEX "Expense_payeeId_idx" ON "Expense"("payeeId");

-- CreateIndex
CREATE INDEX "Expense_categoryId_idx" ON "Expense"("categoryId");

-- CreateIndex
CREATE INDEX "Withholding_invoiceId_idx" ON "Withholding"("invoiceId");

-- CreateIndex
CREATE INDEX "Withholding_issueDate_idx" ON "Withholding"("issueDate");

-- CreateIndex
CREATE INDEX "TaxProfile_validFrom_idx" ON "TaxProfile"("validFrom");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_receiptFileId_fkey" FOREIGN KEY ("receiptFileId") REFERENCES "DriveFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withholding" ADD CONSTRAINT "Withholding_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Categorías de ejemplo. Son editables y archivables desde la interfaz; no
-- imponen ninguna regla. ON CONFLICT evita duplicarlas si ya existen.
INSERT INTO "ExpenseCategory" ("id", "name", "updatedAt") VALUES
  ('seed_cat_publicidad', 'Publicidad', CURRENT_TIMESTAMP),
  ('seed_cat_software', 'Herramientas de software', CURRENT_TIMESTAMP),
  ('seed_cat_servicios', 'Servicios', CURRENT_TIMESTAMP),
  ('seed_cat_compras', 'Compras', CURRENT_TIMESTAMP),
  ('seed_cat_colaboradores', 'Pagos a colaboradores', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
