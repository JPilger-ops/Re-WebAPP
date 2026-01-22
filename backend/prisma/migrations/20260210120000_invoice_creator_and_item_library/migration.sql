-- AlterTable
ALTER TABLE "invoices"
ADD COLUMN "created_by_user_id" INTEGER;

-- CreateTable
CREATE TABLE "invoice_item_library" (
    "id" SERIAL NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "default_quantity" DECIMAL(10,2) DEFAULT 1,
    "unit_price_gross" DECIMAL(10,2) NOT NULL,
    "vat_key" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(6),

    CONSTRAINT "invoice_item_library_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_item_library_description_unit_price_gross_vat_key_key" ON "invoice_item_library"("description", "unit_price_gross", "vat_key");

-- CreateIndex
CREATE INDEX "invoice_item_library_description_idx" ON "invoice_item_library"("description");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
