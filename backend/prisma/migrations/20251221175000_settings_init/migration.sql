-- CreateTable
CREATE TABLE "smtp_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "host" VARCHAR(255),
    "port" INTEGER,
    "secure" BOOLEAN DEFAULT false,
    "user" VARCHAR(255),
    "pass_value" VARCHAR(1024),
    "from" VARCHAR(255),
    "reply_to" VARCHAR(255),
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "smtp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_header_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" VARCHAR(255),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "zip" VARCHAR(50),
    "city" VARCHAR(255),
    "country" VARCHAR(100),
    "vat_id" VARCHAR(100),
    "bank_name" VARCHAR(255),
    "iban" VARCHAR(100),
    "bic" VARCHAR(50),
    "footer_text" TEXT,
    "logo_url" VARCHAR(512),
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_header_settings_pkey" PRIMARY KEY ("id")
);
