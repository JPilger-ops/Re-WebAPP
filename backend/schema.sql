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