-- Allow IMAP fields to be optional because UI currently only collects SMTP data.
ALTER TABLE "category_email_accounts"
  ALTER COLUMN "imap_host" DROP NOT NULL,
  ALTER COLUMN "imap_port" DROP NOT NULL;
