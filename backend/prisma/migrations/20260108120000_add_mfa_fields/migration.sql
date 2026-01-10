-- AlterTable
ALTER TABLE "users"
ADD COLUMN "mfa_enabled" BOOLEAN DEFAULT false,
ADD COLUMN "mfa_secret" TEXT,
ADD COLUMN "mfa_temp_secret" TEXT;
