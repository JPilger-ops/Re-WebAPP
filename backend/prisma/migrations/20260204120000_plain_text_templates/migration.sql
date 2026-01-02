-- Add plain-text column for category templates
ALTER TABLE "category_templates"
ADD COLUMN IF NOT EXISTS "body_text" TEXT;

-- Backfill category body_text from existing HTML (convert simple breaks to newlines, strip tags)
UPDATE "category_templates"
SET
  body_text = COALESCE(
    body_text,
    TRIM(
      regexp_replace(
        regexp_replace(
          regexp_replace(body_html, '<br\\s*/?>', E'\n', 'gi'),
          '</(p|div)>', E'</\\1>\n', 'gi'
        ),
        '<[^>]+>', ' ', 'gi'
      )
    )
  ),
  body_html = NULL
WHERE body_html IS NOT NULL;

-- Ensure global templates also favor plain text, migrate any HTML content
UPDATE "email_templates"
SET
  body_text_template = COALESCE(
    body_text_template,
    TRIM(
      regexp_replace(
        regexp_replace(
          regexp_replace(body_html_template, '<br\\s*/?>', E'\n', 'gi'),
          '</(p|div)>', E'</\\1>\n', 'gi'
        ),
        '<[^>]+>', ' ', 'gi'
      )
    )
  ),
  body_html_template = NULL
WHERE body_html_template IS NOT NULL;
