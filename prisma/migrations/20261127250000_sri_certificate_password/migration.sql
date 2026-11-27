-- The .p12 password is now typed when uploading and kept encrypted next to
-- the file, instead of living in SRI_CERT_PASSWORD. NOT NULL without default
-- is safe: the table was created the same day and never held a row outside
-- local tests.
-- AlterTable
ALTER TABLE "SriCertificate" ADD COLUMN     "encryptedPassword" TEXT NOT NULL,
ADD COLUMN     "passwordIv" TEXT NOT NULL,
ADD COLUMN     "passwordTag" TEXT NOT NULL;
