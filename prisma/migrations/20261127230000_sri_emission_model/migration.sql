-- CreateEnum
CREATE TYPE "InvoiceSource" AS ENUM ('UPLOADED', 'ISSUED');

-- CreateEnum
CREATE TYPE "SriEnvironment" AS ENUM ('PRUEBAS', 'PRODUCCION');

-- CreateEnum
CREATE TYPE "SriStatus" AS ENUM ('DRAFT', 'SIGNED', 'RECEIVED', 'RETURNED', 'AUTHORIZED', 'NOT_AUTHORIZED');

-- CreateEnum
CREATE TYPE "SriOperation" AS ENUM ('RECEPTION', 'AUTHORIZATION');

-- CreateEnum
CREATE TYPE "SriRegime" AS ENUM ('GENERAL', 'RIMPE_EMPRENDEDOR', 'RIMPE_NEGOCIO_POPULAR');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "emissionPointId" TEXT,
ADD COLUMN     "environment" "SriEnvironment",
ADD COLUMN     "sequential" INTEGER,
ADD COLUMN     "source" "InvoiceSource" NOT NULL DEFAULT 'UPLOADED',
ADD COLUMN     "sriStatus" "SriStatus";

-- AlterTable
ALTER TABLE "TaxProfile" ADD COLUMN     "sriRegime" "SriRegime";

-- CreateTable
CREATE TABLE "EmissionPoint" (
    "id" TEXT NOT NULL,
    "establishment" CHAR(3) NOT NULL,
    "emissionPoint" CHAR(3) NOT NULL,
    "environment" "SriEnvironment" NOT NULL,
    "nextSequential" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "label" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmissionPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatCode" TEXT NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "receivableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "operation" "SriOperation" NOT NULL,
    "environment" "SriEnvironment" NOT NULL,
    "accessKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "messages" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SriSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmissionPoint_establishment_emissionPoint_environment_key" ON "EmissionPoint"("establishment", "emissionPoint", "environment");

-- CreateIndex
CREATE INDEX "InvoiceItem_receivableId_idx" ON "InvoiceItem"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_invoiceId_position_key" ON "InvoiceItem"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "SriSubmission_invoiceId_createdAt_idx" ON "SriSubmission"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_sriStatus_idx" ON "Invoice"("sriStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_emissionPointId_sequential_key" ON "Invoice"("emissionPointId", "sequential");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_emissionPointId_fkey" FOREIGN KEY ("emissionPointId") REFERENCES "EmissionPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "Receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriSubmission" ADD CONSTRAINT "SriSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An invoice VeegHub issues always says where, in which environment and
-- with which secuencial. UPLOADED invoices (all existing rows) are untouched.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_issued_complete_check" CHECK (
  "source" = 'UPLOADED'
  OR ("environment" IS NOT NULL AND "emissionPointId" IS NOT NULL
      AND "sequential" IS NOT NULL AND "sriStatus" IS NOT NULL)
);

ALTER TABLE "EmissionPoint" ADD CONSTRAINT "EmissionPoint_codes_check" CHECK (
  "establishment" ~ '^[0-9]{3}$' AND "emissionPoint" ~ '^[0-9]{3}$' AND "nextSequential" BETWEEN 1 AND 999999999
);

-- The app's own point, test environment only. The production row is created
-- on purpose when going live (B7), never by a migration.
INSERT INTO "EmissionPoint" ("id", "establishment", "emissionPoint", "environment", "label", "updatedAt")
VALUES ('ep_001_002_pruebas', '001', '002', 'PRUEBAS', 'VeegHub · pruebas', CURRENT_TIMESTAMP);
