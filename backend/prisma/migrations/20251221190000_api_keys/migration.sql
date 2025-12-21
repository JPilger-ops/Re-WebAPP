-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255),
    "key_hash" VARCHAR(128) NOT NULL,
    "prefix" VARCHAR(32) NOT NULL,
    "scopes" JSONB,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(6),
    "revoked_at" TIMESTAMP(6),
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
