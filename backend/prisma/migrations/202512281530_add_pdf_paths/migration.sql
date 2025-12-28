-- Add archive and trash paths for PDF settings
ALTER TABLE "pdf_settings" ADD COLUMN IF NOT EXISTS "archive_path" TEXT;
ALTER TABLE "pdf_settings" ADD COLUMN IF NOT EXISTS "trash_path" TEXT;
