-- Add auth/cookie settings to network_settings
ALTER TABLE "network_settings"
ADD COLUMN IF NOT EXISTS "auth_cookie_samesite" VARCHAR(10),
ADD COLUMN IF NOT EXISTS "auth_token_ttl_minutes" INTEGER;

-- Seed defaults if row exists
UPDATE "network_settings"
SET
  "auth_cookie_samesite" = COALESCE("auth_cookie_samesite", 'lax'),
  "auth_token_ttl_minutes" = COALESCE("auth_token_ttl_minutes", 720)
WHERE "id" = 1;
