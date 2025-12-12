-- Empfänger
CREATE TABLE recipients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    street VARCHAR(255),
    zip VARCHAR(20),
    city VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rechnungen
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    recipient_id INTEGER REFERENCES recipients(id),
    category VARCHAR(50),
    status_sent BOOLEAN DEFAULT FALSE,
    status_sent_at TIMESTAMP,
    status_paid_at TIMESTAMP,
    receipt_date DATE,

    -- 19%
    net_19 NUMERIC(10,2),
    vat_19 NUMERIC(10,2),
    gross_19 NUMERIC(10,2),

    -- 7%
    net_7 NUMERIC(10,2),
    vat_7 NUMERIC(10,2),
    gross_7 NUMERIC(10,2),

    gross_total NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Positionen
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10,2) DEFAULT 1,
    unit_price_gross NUMERIC(10,2),
    vat_key INTEGER,
    line_total_gross NUMERIC(10,2)
);

-- Kategorien für Rechnungen
CREATE TABLE IF NOT EXISTS invoice_categories (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    label VARCHAR(255) NOT NULL,
    logo_file VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_categories_key
ON invoice_categories (key);

-- Verhindert Dubletten anhand Stammdaten
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_unique
ON recipients (
  LOWER(name),
  LOWER(street),
  zip,
  LOWER(city)
);

-- Benutzer / Accounts
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- z.B. 'admin' oder 'user'
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rollen
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Rollen → Berechtigungen
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

-- Bankeinstellungen
CREATE TABLE IF NOT EXISTS bank_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    account_holder TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    iban TEXT NOT NULL,
    bic TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO bank_settings (id, account_holder, bank_name, iban, bic)
VALUES (1, 'Waldwirtschaft Heidekönig', 'VR-Bank Bonn Rhein-Sieg eG', 'DE48 3706 9520 1104 1850 25', 'GENODED1RST')
ON CONFLICT (id) DO NOTHING;

-- E-Mail Konten pro Kategorie
CREATE TABLE IF NOT EXISTS category_email_accounts (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES invoice_categories(id) ON DELETE CASCADE,
    display_name TEXT,
    email_address TEXT NOT NULL,
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL CHECK (imap_port BETWEEN 1 AND 65535),
    imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
    imap_user TEXT,
    imap_pass TEXT,
    smtp_host TEXT,
    smtp_port INTEGER,
    smtp_secure BOOLEAN DEFAULT TRUE,
    smtp_user TEXT,
    smtp_pass TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (category_id)
);

-- Templates pro Kategorie
CREATE TABLE IF NOT EXISTS category_templates (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES invoice_categories(id) ON DELETE CASCADE,
    subject TEXT,
    body_html TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (category_id)
);
