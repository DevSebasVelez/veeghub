-- AlterEnum
ALTER TYPE "CredentialKind" ADD VALUE 'OAUTH';

-- AlterTable
ALTER TABLE "Credential" ADD COLUMN "accessMethod" TEXT,
ALTER COLUMN "encryptedSecret" DROP NOT NULL,
ALTER COLUMN "secretIv" DROP NOT NULL,
ALTER COLUMN "secretTag" DROP NOT NULL;
