-- CreateTable
CREATE TABLE "SriCertificate" (
    "id" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "holderId" TEXT,
    "issuer" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SriCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SriSigningEvent" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "accessKey" TEXT NOT NULL,
    "environment" "SriEnvironment" NOT NULL,
    "purpose" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SriSigningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SriCertificate_active_idx" ON "SriCertificate"("active");

-- CreateIndex
CREATE INDEX "SriSigningEvent_certificateId_createdAt_idx" ON "SriSigningEvent"("certificateId", "createdAt");

-- CreateIndex
CREATE INDEX "SriSigningEvent_invoiceId_idx" ON "SriSigningEvent"("invoiceId");

-- AddForeignKey
ALTER TABLE "SriSigningEvent" ADD CONSTRAINT "SriSigningEvent_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "SriCertificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SriSigningEvent" ADD CONSTRAINT "SriSigningEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- At most one certificate signs at a time.
CREATE UNIQUE INDEX "SriCertificate_one_active_idx" ON "SriCertificate"("active") WHERE "active";
