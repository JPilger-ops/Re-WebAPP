-- Create table for global email templates
CREATE TABLE IF NOT EXISTS "email_templates" (
  "id" INTEGER PRIMARY KEY,
  "subject_template" TEXT,
  "body_html_template" TEXT,
  "body_text_template" TEXT,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- Ensure single-row uniqueness
INSERT INTO "email_templates" ("id", "subject_template", "body_html_template", "body_text_template")
VALUES (
  1,
  'Rechnung {{invoice_number}}',
  NULL,
  'Hallo {{recipient_name}},\n\nanbei erhältst du deine Rechnung Nr. {{invoice_number}} vom {{invoice_date}}.\nDer Betrag von {{amount}} ist fällig bis {{due_date}}.\n\nVielen Dank!\n{{company_name}}'
)
ON CONFLICT ("id") DO NOTHING;
