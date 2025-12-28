-- CreateTable
CREATE TABLE "bank_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "account_holder" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "bic" TEXT NOT NULL,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_email_accounts" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "display_name" TEXT,
    "email_address" TEXT NOT NULL,
    "imap_host" TEXT NOT NULL,
    "imap_port" INTEGER NOT NULL,
    "imap_secure" BOOLEAN NOT NULL DEFAULT true,
    "imap_user" TEXT,
    "imap_pass" TEXT,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN DEFAULT true,
    "smtp_user" TEXT,
    "smtp_pass" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_templates" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "subject" TEXT,
    "body_html" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "datev_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email" TEXT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "datev_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hkforms_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "base_url" TEXT NOT NULL,
    "organization" TEXT,
    "api_key" TEXT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hkforms_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_categories" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "logo_file" VARCHAR(255),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) DEFAULT 1,
    "unit_price_gross" DECIMAL(10,2),
    "vat_key" INTEGER,
    "line_total_gross" DECIMAL(10,2),

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "invoice_number" VARCHAR(50) NOT NULL,
    "date" DATE NOT NULL,
    "recipient_id" INTEGER,
    "category" VARCHAR(50),
    "reservation_request_id" VARCHAR(100),
    "external_reference" TEXT,
    "status_sent" BOOLEAN DEFAULT false,
    "status_sent_at" TIMESTAMP(6),
    "status_paid_at" TIMESTAMP(6),
    "overdue_since" TIMESTAMP(6),
    "datev_export_status" VARCHAR(20) DEFAULT 'NOT_SENT',
    "datev_exported_at" TIMESTAMP(6),
    "datev_export_error" TEXT,
    "receipt_date" DATE,
    "net_19" DECIMAL(10,2),
    "vat_19" DECIMAL(10,2),
    "gross_19" DECIMAL(10,2),
    "net_7" DECIMAL(10,2),
    "vat_7" DECIMAL(10,2),
    "gross_7" DECIMAL(10,2),
    "gross_total" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "b2b" BOOLEAN DEFAULT false,
    "ust_id" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipients" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "street" VARCHAR(255),
    "zip" VARCHAR(20),
    "city" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(100),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" INTEGER NOT NULL,
    "permission_key" VARCHAR(100) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tax_number" TEXT,
    "vat_id" TEXT,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT true,
    "role_id" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schema_migrations" (
    "filename" TEXT NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("filename")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_email_accounts_category_id_key" ON "category_email_accounts"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_templates_category_id_key" ON "category_templates"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_invoice_categories_key" ON "invoice_categories"("key");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "category_email_accounts" ADD CONSTRAINT "category_email_accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "invoice_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "category_templates" ADD CONSTRAINT "category_templates_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "invoice_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

