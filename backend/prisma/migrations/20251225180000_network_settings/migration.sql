CREATE TABLE IF NOT EXISTS "network_settings" (
  "id" INTEGER PRIMARY KEY,
  "cors_origins" TEXT,
  "trust_proxy" INTEGER DEFAULT 1,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "network_settings" ("id", "cors_origins", "trust_proxy")
VALUES (1, 'https://rechnung.intern,http://rechnung.intern', 1)
ON CONFLICT("id") DO NOTHING;
