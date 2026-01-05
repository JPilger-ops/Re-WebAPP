-- Add phone number to invoice header settings
ALTER TABLE "invoice_header_settings"
  ADD COLUMN IF NOT EXISTS "phone" VARCHAR(100);
