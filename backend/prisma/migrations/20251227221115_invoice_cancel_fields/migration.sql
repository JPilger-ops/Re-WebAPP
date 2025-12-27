-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "canceled_at" TIMESTAMP(6),
ADD COLUMN "cancel_reason" TEXT;
