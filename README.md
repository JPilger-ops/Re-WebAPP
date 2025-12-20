# Rechnungsapp (Express + PostgreSQL)

 Web-Backend für das Rechnungsmodul der Waldwirtschaft Heidekönig. Express liefert sowohl die REST-API als auch das statische Frontend (HTML/JS/CSS). Rechnungen werden als PDF erzeugt, per E-Mail versendet und optional direkt an DATEV weitergeleitet.

## Features
- JWT-Login per Secure-Cookie, Rollen- und Berechtigungssystem (Admin/User + Permissions für Kategorien/Settings).
- Kundenverwaltung auf Basis der Tabelle `recipients`.
- Rechnungen anlegen, Positionen mit 19%/7% MwSt., Status sent/paid, Löschung nur für Admins.
- HKForms-Integration: optionale ReservationRequest-ID auf der Rechnung, Status-Sync (sent/paid/overdue) und automatische Überfällig-Markierung nach Versand.
- PDF-Generierung via Puppeteer (inkl. Kategorie-Logo, EPC-QR-Code/SEPA-Daten) und Ablage in `pdfs/`.
- E-Mail-Versand über globales SMTP oder kategoriespezifische Mailkonten + HTML-Templates; Vorschau verfügbar.
- DATEV-Export: dedizierte Zieladresse, Statusspalten in `invoices`, Export-Button und BCC-Option im Versand.
- Kategorien mit Logos, Templates sowie SMTP-/IMAP-Konfiguration; Logo-Uploads landen in `public/logos`.
- Statistikseite mit KPIs (gesamt + pro Jahr) und Filtern nach Jahr/Kategorie; Zugriff via Permission `stats.view`.
- Statische Frontend-Seiten in `public/` (Login, Rechnungen, Kunden, Kategorien, Rollen-/Benutzerverwaltung, Statistik).

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

## Schritt-für-Schritt Einrichtung (Beispiel Debian/Ubuntu)
1) Repository holen und ins Backend wechseln  
```bash
git clone <repo-url> rechnungsapp
cd rechnungsapp/backend
```

2) Systemabhängigkeiten installieren (Root/Sudo)  
```bash
sudo apt update
sudo apt install -y curl git postgresql postgresql-contrib
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v  # Versionen prüfen (Node 20+)
```
Optional: PM2 für Production  
```bash
sudo npm install -g pm2
```

3) NPM-Abhängigkeiten laden  
```bash
npm ci
```

4) Datenbank-User und -DB anlegen (Postgres Shell)  
```bash
sudo -u postgres psql -c "CREATE USER rechnung_app WITH PASSWORD '<db-pass>';"
sudo -u postgres psql -c "CREATE DATABASE rechnung_prod OWNER rechnung_app;"
psql -h localhost -U rechnung_app -d rechnung_prod -f schema.sql
```

5) `.env` erstellen  
- Inhalt aus dem Beispiel unten übernehmen und anpassen.  
- Mindestens setzen: `APP_DOMAIN`, `APP_HTTPS_PORT`, `CORS_ORIGINS`, `JWT_SECRET`, `APP_CREATE_PIN`, DB-Zugang, SMTP-Zugang, TLS-Pfade (`APP_SSL_CERT_DIR` oder `APP_SSL_KEY_PATH/APP_SSL_CERT_PATH`).  
```bash
cp .env.example .env  # falls vorhanden; sonst mit Editor anlegen
```

6) TLS-Zertifikat hinterlegen  
- Standardpfad: `certificates/rechnung.intern/privkey.pem` und `certificates/rechnung.intern/fullchain.pem`.  
- Alternativ eigene Pfade per Env (siehe `.env`). Ohne Zertifikat startet `npm run dev` nicht.

7) Basisrollen/-rechte eintragen  
```bash
psql -h localhost -U rechnung_app -d rechnung_prod <<'SQL'
INSERT INTO roles (name, description) VALUES 
  ('admin','Voller Zugriff'),
  ('user','Standardnutzer')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key) VALUES
  ((SELECT id FROM roles WHERE name='admin'), 'settings.general'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.read'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.write'),
  ((SELECT id FROM roles WHERE name='admin'), 'categories.delete'),
  ((SELECT id FROM roles WHERE name='admin'), 'stats.view')
ON CONFLICT DO NOTHING;
SQL
```

8) Admin-User registrieren (`APP_CREATE_PIN` wird abgefragt)  
```bash
curl -k -X POST "https://<APP_DOMAIN>/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<pw>","role":"admin","createPin":"<APP_CREATE_PIN>"}'
```

9) Entwicklung starten und prüfen  
```bash
npm run dev
curl -k https://localhost:<APP_HTTPS_PORT>/api/version
```
Frontend unter `https://localhost:<APP_HTTPS_PORT>` aufrufen (CORS-Origin muss passen).

10) Produktion mit PM2 starten (Beispiel)  
```bash
pm2 start ecosystem.config.cjs --name rechnungsapp
pm2 save
pm2 status
```

11) Tests und Checks  
```bash
npm test
curl -k https://<APP_DOMAIN>/api/testdb
```

## Docker Compose Betrieb
- `.env` aus `backend/.env.example` kopieren und anpassen (DB-Host `db`, Port `3030`, `CORS_ORIGINS` auf die Proxy-URL z. B. `https://192.169.50.100:3030` setzen, `APP_VERSION=0.9.5`). DB-Creds in `backend/.env` müssen zu den `POSTGRES_*` Werten im Compose passen (Standard: User `rechnung_app`, Passwort `change_me`, DB `rechnung_prod`).  
- Build & Start:  
  ```bash
  docker compose build
  docker compose up -d
  ```  
  Die App lauscht intern auf 3030 und wird auf dem Host unter `https://localhost:3030` bzw. über den NPM-Proxy `https://192.169.50.100:3030` bereitgestellt.
- Prüfung:  
  ```bash
  curl -k https://localhost:3030/api/version
  # oder via Proxy
  curl -k https://192.169.50.100:3030/api/version
  ```
- Volumes: Datenbank unter `./data/db`, erzeugte PDFs unter `./backend/pdfs` (Bind-Mount).  
- Beim Start führt `npm run start:docker` automatisch `scripts/init-db.js` aus (legt das Schema an und spielt SQL-Migrationen ein).  
- Optional: In `docker-compose.yml` sind kommentierte Services für pgAdmin/Adminer hinterlegt.
- TLS nur im Proxy terminieren: setze `APP_HTTPS_DISABLE=true` und nutze `APP_DOMAIN`/`CORS_ORIGINS` mit `http://…`. Healthcheck in Compose ist bereits auf HTTP gestellt.

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
HKFORMS_BASE_URL=https://app.bistrottelegraph.de/api
HKFORMS_ORGANIZATION=hk-mandant-01
HKFORMS_SYNC_TOKEN=<<secret>>
TAX_NUMBER=12/345/67890
VAT_ID=DE123456789

# Überfällig-Job (optional)
OVERDUE_DAYS=14
OVERDUE_JOB_ENABLED=true
# Millisekunden; Default 900000 (15 Minuten)
OVERDUE_JOB_INTERVAL_MS=900000

SEPA_CREDITOR_NAME="Waldwirtschaft Heidekönig"
SEPA_CREDITOR_IBAN="DE00123456780000000000"
SEPA_CREDITOR_BIC="ABCDEFGHXXX"
BANK_NAME="Hausbank"

APP_SSL_CERT_DIR=/path/zum/zertifikat  # oder APP_SSL_KEY_PATH / APP_SSL_CERT_PATH
APP_VERSION=0.9.0
```

## API-Überblick (gekürzt)
- Auth: `POST /api/auth/login`, `POST /api/auth/register` (mit `createPin`), `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password`.
- Benutzer (Admin): `GET/POST/PUT/DELETE /api/users`, `POST /api/users/:id/reset-password`.
- Rollen (Admin): `GET /api/roles`, `GET /api/roles/:id/permissions`, `POST/PUT/DELETE /api/roles`.
- Kunden: `GET/POST/PUT/DELETE /api/customers`.
- Rechnungen: `GET /api/invoices` (Liste + Filter), `GET /api/invoices/:id`, `POST /api/invoices` (Neuanlage), `GET /api/invoices/:id/pdf`, `POST /api/invoices/:id/send-email` (optional `include_datev: true`), `POST /api/invoices/:id/datev-export`, Statusrouten für sent/paid, `DELETE /api/invoices/:id` nur Admin.
- HKForms/Reservation: `GET/POST /api/invoices/by-reservation/:reservationId/status` (Header `X-HKFORMS-CRM-TOKEN`), sendet/liest Rechnungsstatus; Reservation-ID ist optional, mehrfach nutzbar.
- Statistik (Permission `stats.view`): `GET /api/stats/invoices?year=YYYY&category=cat1,cat2` liefert `overall` + `byYear` + verfügbare Kategorien.
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

🧰 Technologien

Bereich	Technologie
Backend	Node.js (ESM), Express
Frontend	HTML, CSS, Vanilla-JS
Datenbank	PostgreSQL
PDF	Puppeteer
Authentication	JWT-Cookies
Deployment	PM2
QR-Code Generator	qrcode NPM-Package


⸻

🗂 1. Projektwurzel

Pfad:

/root/rechnungsapp/

Ordner und Dateien für Backend, Frontend, Konfiguration & PDF-Generierung.

⸻

🟦 2. Backend – Hauptprojekt

Pfad:

/root/rechnungsapp/backend/

⚙ Backend-Kerndateien

Datei	Zweck
backend/package.json	Dependencies & Skripte
backend/package-lock.json	Lockfile
backend/ecosystem.config.cjs	PM2 Konfiguration
backend/.env	Umgebungsvariablen (DB, Secrets, etc.)

⚙ Server & App-Setup

Datei	Beschreibung
backend/src/server.js	Express App + Routerregistrierung
backend/src/index.js	App-Startpunkt (Port, Middleware, Initialisierung)


⸻

🟦 3. Backend – Utils

Pfad:

backend/src/utils/db.js

✨ db.js – Aufgaben:
	•	PostgreSQL-Pool
	•	Query-Funktionen
	•	Verbindungstest
	•	Fehler-Logging

⸻

🟦 4. Backend – Controllers

Pfad:

backend/src/controllers/

Controller	Funktion
auth.controller.js	Login, Logout, Token-Handling, User-Daten
customer.controller.js	Kundenverwaltung: Erstellen, Bearbeiten, Suche
invoice.controller.js	Herzstück der Anwendung: Rechnungslogik, PDF-Rendering, SEPA-QR
user.controller.js	Benutzerverwaltung
role.controller.js	Rollen & Rechte (selbst implementiert)

🔥 Wichtige Funktionen in invoice.controller.js:
	•	createInvoice() → Rechnung + Positionen + Empfänger speichern
	•	getAllInvoices() → Übersichtsliste
	•	getInvoiceById() → Detaildaten
	•	getInvoicePdf() → PDF generieren (Puppeteer)
	•	generateInvoiceHtml() → HTML-Vorlage mit Logo, Knickmarken, Reverse-Charge etc.
	•	getNextInvoiceNumber() → Automatische Nummernvergabe YYYYMM001
	•	markSent(), markPaid() → Status ändern
	•	deleteInvoice() → Rechnung + PDF löschen

⸻

🟦 5. Backend – Routes

Pfad:

backend/src/routes/

Datei	Zweck
auth.routes.js	Login, Logout, Registrierung
customer.routes.js	Kunden-Endpunkte
invoice.routes.js	Rechnungs-Endpunkte, PDF Export
user.routes.js	User-Management
role.routes.js	Rollenverwaltung
test.routes.js	Debug / Healthcheck


⸻

🟦 6. Backend – Middleware

Pfad:

backend/src/middleware/

Datei	Beschreibung
auth.middleware.js	JWT-Prüfung, Zugriffsschutz für geschützte Routen


⸻

🟦 7. Backend – Öffentliche Dateien (Frontend)

Pfad:

backend/public/


⸻

📄 HTML-Seiten:

Datei	Beschreibung
login.html	Loginmaske
index.html	Dashboard
invoices.html	Rechnungsübersicht
invoice.html	Rechnungsdetailseite
create.html	Rechnung erstellen
customers.html	Kundenverwaltung
user-management.html	Benutzerverwaltung
role-management.html	Rollenverwaltung
account.html	Eigenes Profil


⸻

🎨 CSS:

Datei
style.css


⸻

🧠 JavaScript Frontend:

Datei	Zweck
nav.js	Navigation & UI
main.js	Dashboard
login.js	Login-Logik
invoices.js	Anzeigen, filtern, verwalten
create.js	Rechnung erstellen: Positionen, B2B, QR, Popup
customers.js	Kundenverwaltung
user-management.js	Benutzerverwaltung
role-management.js	Rollenverwaltung
account.js	Passwörter ändern etc.


⸻

🖼 Assets:

backend/public/HK_LOGO.png


⸻

🟦 8. PDFs / Export

Pfad:

backend/pdfs/

Inhalt:
	•	Generierte Rechnungs-PDFs
	•	Dateiname: RE-<Nummer>.pdf

⸻

🟦 9. Temporäre / Debug-Dateien

Diese liegen im System /mnt/data (nicht Teil der App):
	•	/mnt/data/*.js
	•	/mnt/data/*.html
	•	/mnt/data/*.png
	•	/mnt/data/*.zip

Sie werden nicht geladen und gehören nicht ins Repo.

⸻

🟦 10. Datenbank / SQL-Schema

Beispielpfad:

backend/schema.sql

Beinhaltet:
	•	Tabellen: invoices, invoice_items, recipients, users, roles, role_permissions
	•	Views und Indexe (optional)

⸻

🗂 11. Gesamtübersicht (Baumdarstellung)

backend
├── .env
├── package.json
├── package-lock.json
├── ecosystem.config.cjs
├── pdfs/
├── public/
│   ├── index.html
│   ├── login.html
│   ├── invoices.html
│   ├── invoice.html
│   ├── create.html
│   ├── customers.html
│   ├── user-management.html
│   ├── role-management.html
│   ├── account.html
│   ├── style.css
│   ├── main.js
│   ├── login.js
│   ├── invoices.js
│   ├── create.js
│   ├── customers.js
│   ├── user-management.js
│   ├── role-management.js
│   ├── account.js
│   ├── nav.js
│   ├── HK_LOGO.png
│
└── src/
    ├── index.js
    ├── server.js
    ├── utils/
    │   └── db.js
    ├── controllers/
    │   ├── auth.controller.js
    │   ├── customer.controller.js
    │   ├── invoice.controller.js
    │   ├── user.controller.js
    │   └── role.controller.js
    ├── middleware/
    │   └── auth.middleware.js
    └── routes/
        ├── auth.routes.js
        ├── customer.routes.js
        ├── invoice.routes.js
        ├── user.routes.js
        ├── role.routes.js
        └── test.routes.js


⸻

🔢 Rechnungsnummern-System

Schema:

YYYYMM001

	•	Monatsbasierter Reset
	•	Kollisionssicher
	•	DB-Feld: VARCHAR(20)

⸻

🧾 B2B-Modus (Reverse Charge)

Bereich	Beschreibung
Frontend	Checkbox, USt-ID-Feld & Netto-Endbetrag
Backend	b2b & ust_id Felder, Netto-Endsumme
PDF	„Rechnung (B2B)“, Reverse-Charge Hinweis


⸻

🖨 PDF-Renderer
	•	Puppeteer Headless
	•	HTML-Template mit DIN-5008 Knickmarken
	•	SEPA-QR-Code Integration
	•	Branding über Base64 Logo
	•	Netto- oder Brutto-Endbetrag abhängig von B2B

⸻

🛠 Installation

git clone <repo-url>
cd rechnungsapp/backend
npm install
npm run start      # oder pm2 start


⸻

🔐 Environment Variablen

DATABASE_URL=postgres://user:pass@localhost:5432/rechnungsdb
JWT_SECRET=supersecret
SEPA_CREDITOR=Heidekönig
SEPA_IBAN=DE...
SEPA_BIC=GENODE...
