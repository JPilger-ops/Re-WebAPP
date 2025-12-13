# Rechnungsapp (Express + PostgreSQL)

Web-Backend für das Rechnungsmodul der Waldwirtschaft Heidekönig. Express liefert sowohl die REST-API als auch das statische Frontend (HTML/JS/CSS). Rechnungen werden als PDF erzeugt, per E-Mail versendet und optional direkt an DATEV weitergeleitet.

## Features
- JWT-Login per Secure-Cookie, Rollen- und Berechtigungssystem (Admin/User + Permissions für Kategorien/Settings).
- Kundenverwaltung auf Basis der Tabelle `recipients`.
- Rechnungen anlegen, Positionen mit 19%/7% MwSt., Status sent/paid, Löschung nur für Admins.
- PDF-Generierung via Puppeteer (inkl. Kategorie-Logo, EPC-QR-Code/SEPA-Daten) und Ablage in `pdfs/`.
- E-Mail-Versand über globales SMTP oder kategoriespezifische Mailkonten + HTML-Templates; Vorschau verfügbar.
- DATEV-Export: dedizierte Zieladresse, Statusspalten in `invoices`, Export-Button und BCC-Option im Versand.
- Kategorien mit Logos, Templates sowie SMTP-/IMAP-Konfiguration; Logo-Uploads landen in `public/logos`.
- Statische Frontend-Seiten in `public/` (Login, Rechnungen, Kunden, Kategorien, Rollen- und Benutzerverwaltung).

## Projektaufbau
- `src/` – Express-Server, Routen und Controller.
- `public/` – Statische UI, ausgeliefert unter `/`.
- `pdfs/` – erzeugte Rechnungspdfs.
- `schema.sql` – Datenbankschema (PostgreSQL).
- `certificates/rechnung.intern/` – erwartete TLS-Dateien (`privkey.pem`, `fullchain.pem`), per Env übersteuerbar.
- `certificates/ca/` – interne CA (`ca.crt`) für Client-SSL; Download nur für Admins unter Einstellungen.
- `tests/` – Node.js Tests (Schwerpunkt DATEV).
- `ecosystem.config.cjs` – PM2-Definition für den Produktivbetrieb.

## Voraussetzungen
- Node.js 20+ und npm.
- PostgreSQL 13+ mit User/DB für die App.
- TLS-Zertifikat (PEM). Standardpfad siehe `certificates/rechnung.intern/`; alternativ per `APP_SSL_*`-Variablen setzen. Ohne gültiges Zertifikat startet `src/index.js` nicht.
- SMTP-Zugang für den Versand (global oder je Kategorie) und optional IMAP-Zugang zum Testen der Kategorie-Konten.

## Einrichtung
1) Abhängigkeiten installieren  
`npm install`

2) `.env` im Projektwurzel-Ordner `backend/` anlegen (Beispiel unten).

3) Datenbank anlegen & Schema importieren  
`psql -h <host> -U <user> -d <db> -f schema.sql`

4) Basisrollen/Berechtigungen füllen (Minimalbeispiel)  
```sql
INSERT INTO roles (name, description) VALUES 
  ('admin','Voller Zugriff'),
  ('user','Standardnutzer')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key) VALUES
  ((SELECT id FROM roles WHERE name='admin'), 'settings.general'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.read'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.write'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.delete')
ON CONFLICT DO NOTHING;
```

5) Ersten Benutzer registrieren (rollt Rolle `admin` zu, geschützt durch `APP_CREATE_PIN`)  
```bash
curl -k -X POST "https://<domain>/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<pw>","role":"admin","createPin":"<APP_CREATE_PIN>"}'
```

6) Entwicklung/Prod starten  
- Lokal: `npm run dev` (nutzt HTTPS-Port `APP_HTTPS_PORT`, Standard 443)  
- Prod per PM2: `pm2 start ecosystem.config.cjs`

7) Frontend aufrufen  
`https://<APP_DOMAIN>` bzw. `https://localhost:<APP_HTTPS_PORT>` wenn die CORS-Origin passt.

## Beispiel `.env`
```
APP_DOMAIN=https://rechnung.intern
APP_HTTPS_PORT=443
CORS_ORIGINS=https://rechnung.intern

DB_HOST=localhost
DB_PORT=5432
DB_USER=rechnung_app
DB_PASS=<<secret>>
DB_NAME=rechnung_prod

JWT_SECRET=<<secret>>
APP_CREATE_PIN=<<pin-fuer-registry>>

SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=rechnungen@example.com
SMTP_PASS=<<secret>>
MAIL_FROM="Waldwirtschaft Heidekönig <rechnungen@example.com>"
DATEV_EMAIL=datev@example.com

SEPA_CREDITOR_NAME="Waldwirtschaft Heidekönig"
SEPA_CREDITOR_IBAN="DE00123456780000000000"
SEPA_CREDITOR_BIC="ABCDEFGHXXX"
BANK_NAME="Hausbank"

APP_SSL_CERT_DIR=/path/zum/zertifikat  # oder APP_SSL_KEY_PATH / APP_SSL_CERT_PATH
APP_VERSION=0.6.0
```

## API-Überblick (gekürzt)
- Auth: `POST /api/auth/login`, `POST /api/auth/register` (mit `createPin`), `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- Benutzer (Admin): `GET/POST/PUT/DELETE /api/users`, `POST /api/users/:id/reset-password`.
- Rollen (Admin): `GET /api/roles`, `GET /api/roles/:id/permissions`, `POST/PUT/DELETE /api/roles`.
- Kunden: `GET/POST/PUT/DELETE /api/customers`.
- Rechnungen: `GET /api/invoices` (Liste + Filter), `GET /api/invoices/:id`, `POST /api/invoices` (Neuanlage), `GET /api/invoices/:id/pdf`, `POST /api/invoices/:id/send-email` (optional `include_datev: true`), `POST /api/invoices/:id/datev-export`, Statusrouten für sent/paid, `DELETE /api/invoices/:id` nur Admin.
- Kategorien (Permissions `categories.*` oder `settings.general`): CRUD, Logo-Upload (`POST /api/categories/logo`), Template/SMTP je Kategorie (`/api/categories/:id/email|template`), Mail-Test.
- Einstellungen: `GET/PUT /api/settings/bank`, `GET/PUT /api/settings/datev`, `GET /api/settings/ca-cert` (admin).
- Sonstiges: `GET /api/testdb` (DB-Ping), `GET /api/version`.

## Tests
Node.js Tests laufen mit  
`npm test`

Schwerpunkt sind die DATEV-Helfer (`tests/datev.test.js`). Puppeteer/SMTP werden nicht automatisch angestoßen.

## Hinweise
- HTTPS ist Pflicht, weil Cookies `secure` gesetzt werden. Hinter einem Reverse Proxy entweder Zertifikatpfade via `APP_SSL_*` setzen oder den HTTPS-Teil dort terminieren und die App intern per Port weiterreichen.
- Generierte PDFs liegen unter `pdfs/` und werden beim Versand als Anhang genutzt.
- Kategorie-spezifische SMTP-Zugänge haben Vorrang vor den globalen SMTP-Env-Variablen.
