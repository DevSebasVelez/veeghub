-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('MONTHLY', 'YEARLY');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "recurrencePeriod" TEXT,
ADD COLUMN     "recurringExpenseId" TEXT;

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "payeeId" TEXT,
    "payeeKind" "PayeeKind",
    "projectId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT,
    "taxTreatment" "TaxTreatment" NOT NULL DEFAULT 'UNCLASSIFIED',
    "notes" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_active_idx" ON "RecurringExpense"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_recurringExpenseId_recurrencePeriod_key" ON "Expense"("recurringExpenseId", "recurrencePeriod");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "Payee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

