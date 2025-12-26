CREATE TABLE IF NOT EXISTS "favicon_settings" (
  "id" INTEGER PRIMARY KEY,
  "filename" VARCHAR(255),
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "favicon_settings" ("id", "filename")
VALUES (1, 'logos/RE-WebAPP.png')
ON CONFLICT("id") DO NOTHING;
