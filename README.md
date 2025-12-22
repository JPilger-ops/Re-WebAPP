# Rechnungsapp (Express + PostgreSQL)

 Web-Backend für das Rechnungsmodul der Waldwirtschaft Heidekönig. Express liefert sowohl die REST-API als auch das statische Frontend (HTML/JS/CSS). Rechnungen werden als PDF erzeugt, per E-Mail versendet und optional direkt an DATEV weitergeleitet.

## Features
- JWT-Login per Secure-Cookie, Rollen- und Berechtigungssystem (Admin/User + feingranulare Permissions für Rechnungen, Kunden, Benutzer, Rollen, Kategorien, Settings, Statistik).
- Kundenverwaltung auf Basis der Tabelle `recipients`.
- Rechnungen anlegen, Positionen mit 19%/7% MwSt., Status sent/paid, Löschung nur für Admins.
- HKForms-Integration: optionale ReservationRequest-ID auf der Rechnung, Status-Sync (sent/paid/overdue) und automatische Überfällig-Markierung nach Versand.
- PDF-Generierung via Puppeteer (inkl. Kategorie-Logo, EPC-QR-Code/SEPA-Daten) und Ablage in `pdfs/`.
- E-Mail-Versand über globales SMTP oder kategoriespezifische Mailkonten + HTML-Templates; Vorschau verfügbar.
- DATEV-Export: dedizierte Zieladresse, Statusspalten in `invoices`, Export-Button und BCC-Option im Versand.
- Kategorien mit Logos, Templates sowie SMTP-/IMAP-Konfiguration; Logo-Uploads landen in `public/logos`.
- Statistikseite mit KPIs (gesamt + pro Jahr) und Filtern nach Jahr/Kategorie; Zugriff via Permission `stats.view`.
- Statische Frontend-Seiten in `public/` (Login, Rechnungen, Kunden, Kategorien, Rollen-/Benutzerverwaltung, Statistik).
- E-Mail-Preview: `GET /api/invoices/:id/email-preview` liefert subject/body_html/body_text, From-Absender und DATEV-Info.
- Versand-Testmodus: `EMAIL_SEND_DISABLED=1` unterdrückt den realen Versand, markiert aber Status als „gesendet“; `EMAIL_REDIRECT_TO=<adresse>` leitet alle Sendungen auf diese Adresse um (kein DATEV-BCC im Redirect-Modus).

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

7) Basisrollen/-rechte + Admin werden automatisch per Prisma-Seed angelegt (Admin-User `admin`, Passwort per `DEFAULT_ADMIN_PASSWORD` oder Default `admin`, volle Permissions).  

8) Entwicklung starten und prüfen  
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

9) Tests und Checks  
```bash
npm test
curl -k https://<APP_DOMAIN>/api/testdb
```

## Docker Compose (dev_DOCKER)
**Ziel:** `docker compose build && docker compose up -d` startet App + Postgres “out of the box”, DB wird automatisch initialisiert (Schema, Migrationen, Admin + Permissions), PDFs schreiben nach `backend/pdfs`.

### CI (GitHub Actions)
- Workflow: `.github/workflows/ci.yml`
- Triggers: push/pull_request auf `main` und `dev_Prisma`
- Steps: `docker compose up -d --build`, Health-Wait, dann `check:api`, `check:pdf`, `check:invoice` im App-Container. Bei Fehlern: `docker compose logs`, danach `docker compose down -v`.
- Branch Protection: PRs nur mergen, wenn der CI-Workflow grün ist (im GitHub-UI aktivieren).

### 1) Env-Dateien
- `backend/.env` (anlegen aus `backend/.env.example`) enthält App-/DB-/SMTP-Settings.
- Root `.env` steuert nur das Image-Tag (`APP_VERSION`).
- Compose liest beide via `env_file`. DB-Host/Port werden intern auf `db:5432` gesetzt (bridge network).

**Minimal zwingend (Backend/.env):**
- `APP_DOMAIN`, `CORS_ORIGINS` (siehe Modi unten)
- `JWT_SECRET`, `SESSION_SECRET`, `APP_CREATE_PIN`, `APP_PIN`
- DB: `DB_USER`, `DB_PASS`, `DB_NAME` (müssen zu `POSTGRES_*` in compose passen), `DB_HOST=db` wird überschrieben
- SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (oder Dummy, falls Versand nicht genutzt wird)
- TLS: entweder Zertifikatspfad (Modus A) oder `APP_HTTPS_DISABLE=true` (Modus B)
- Optional: `DEFAULT_ADMIN_PASSWORD` (ansonsten `admin`)

**Modus A – HTTP in der App, TLS nur im Proxy (Standard im Docker):**
```
APP_DOMAIN=http://rechnung.intern
APP_HTTPS_PORT=3030
APP_HTTPS_DISABLE=true
CORS_ORIGINS=https://rechnung.intern,http://rechnung.intern
```
Der Proxy (NPM) terminiert TLS und reicht `X-Forwarded-Proto: https` durch. Express hat `trust proxy = 1`, dadurch werden Cookies bei HTTPS-Aufruf durch den Proxy trotzdem als `Secure` gesetzt.

**Modus B – HTTPS in der App (nur wenn Zertifikat gemountet wird):**
```
APP_DOMAIN=https://rechnung.intern
APP_HTTPS_PORT=3030
APP_HTTPS_DISABLE=false
APP_SSL_CERT_DIR=/app/certificates/rechnung.intern  # oder APP_SSL_KEY_PATH / APP_SSL_CERT_PATH
```

### 2) Build & Start
```bash
docker compose up -d --build  # startet Postgres + App
```
Ports: App lauscht intern auf 3030, wird auf dem Host nur an `192.200.255.225:3031` gepublished (für NPM). DB hat kein Port-Mapping (nur intern). PDFs landen in `./backend/pdfs`.

Healthcheck: nutzt automatisch HTTP oder HTTPS je nach `APP_HTTPS_DISABLE`.

### 3) Smoke-Tests
```bash
# API-Version (Host-Port 3031)
npm --prefix backend run check:api

# PDF-Smoketest (legt backend/pdfs/smoke-check.pdf an)
npm --prefix backend run check:pdf

# Invoice-Smoketest (legt Rechnung + PDF an, prüft Datei >0 Bytes, löscht wieder)
npm --prefix backend run check:invoice

# Im Container (falls nötig):
# CHECK_HOST=127.0.0.1 CHECK_PORT=3030 npm --prefix backend run check:api
# CHECK_HOST=127.0.0.1 CHECK_PORT=3030 npm --prefix backend run check:invoice
```

### UI Sanity Flow (manuell, Browser)
1) Login via https://rechnung.intern
2) Kunde anlegen (/customers)
3) Rechnung anlegen (/invoices) inkl. Position
4) PDF öffnen (Button “PDF”)
5) Rechnungskopf in /settings anpassen, dann in /invoices “PDF neu” für eine Rechnung → neues PDF prüfen
6) SMTP Testmail in /settings (zeigt Dry-Run/Redirect-Hinweis, wenn EMAIL_SEND_DISABLED/EMAIL_REDIRECT_TO gesetzt)

Fixdaten: Host 192.200.255.225 Port 3031, NPM 192.168.50.100, Domain rechnung.intern.

### 4) DB-Init & Idempotenz
`npm run start:docker` ruft `scripts/bootstrap-db.mjs` auf und führt immer:
- `npx prisma migrate deploy`
- `npx prisma db seed` (idempotent)

Seed legt Rollen `admin`/`user`, alle Permissions und den Admin-User `admin` (Passwort `DEFAULT_ADMIN_PASSWORD` oder `admin`) an; bestehende Admin-User werden nur der Admin-Rolle zugeordnet, Passwort bleibt unverändert.

Seed-Idempotenz geprüft: frische DB (compose down -v → up) legt Admin/Rollen/Permissions an; erneuter Start ohne DB-Reset läuft fehlerfrei durch, keine Duplikate (`admin_users=1`, `admin_roles=1`, `admin_perms=23`).

### 5) Troubleshooting
- Healthcheck rot & APP_HTTPS_DISABLE=true → prüfe, ob Compose-Healthcheck auf HTTP zeigt (siehe `docker-compose.yml`).
- PDFs: Image muss Chromium enthalten (`docker exec rechnungsapp-app-1 which chromium-browser`). Falls nicht, `docker compose build app --no-cache`.
- Proxy-Betrieb (NPM): Proxy Host `rechnung.intern`, Forward Host/IP `192.200.255.225`, Forward Port `3031`, Schema `http`, Websockets on, TLS/Certificate im NPM, optional Force SSL. TLS wird nur im NPM terminiert; Header `X-Forwarded-Proto: https` durchreichen (Express erkennt das über `trust proxy` für Cookie/Secure-Flags).
- Zertifikate: In Modus A müssen `privkey.pem` und `fullchain.pem` an den in `.env` gesetzten Pfad gemountet werden.

## Security / Production Notes
- Env/Secrets: `.env`, `backend/.env` nicht commiten (siehe .gitignore). Credentials per Env/Secrets im Deployment setzen.
- HTTP Security: `helmet` aktiv, `x-powered-by` disabled, HSTS nur wenn HTTPS in der App aktiv ist. CSP ist aus, um SPA/Assets nicht zu brechen (bei Bedarf projektweit definieren).
- CORS: nur explizite Origins (Default `https://rechnung.intern`), `credentials: true`.
- Rate Limiting: allgemeines Limit (Default 300 req/Minute) und Login-Limiter (Default 20 req/Minute). Konfigurierbar via `RATE_LIMIT_*` Envs.
- Logging: Request-Logging nur in non-production (`morgan dev`). Startup loggt Ports/Proxy/CORS/Public URL (keine Secrets).
- Runtime: Container läuft als non-root; Schreibrechte benötigt für `backend/pdfs/`.

## CORS / Proxy / Cookies
- Default-CORS: `https://rechnung.intern` (weitere Origins per CSV in `CORS_ORIGINS`, z. B. externe Domain später anhängen).
- `trust proxy`: per `TRUST_PROXY` (0/1/true/false), Default 1. Secure-Cookies werden gesetzt, wenn Request via HTTPS (X-Forwarded-Proto=https) kam.
- App spricht intern nur HTTP (Port 3030); NPM terminiert TLS auf `192.200.255.225:3031 -> 3030`.

## NGINX Proxy Manager (NPM) Setup
- Proxy Host:
  - Domain: `rechnung.intern`
  - Forward Scheme/Host/Port: `http://192.200.255.225:3031`
  - Websockets: ON, Block common exploits: ON (bei Problemen toggeln)
- SSL:
  - Zertifikat wählen (`rechnung.intern`)
  - Force SSL: ON, HTTP/2: ON, HSTS optional (nur bei dauerhaftem Betrieb)
- Advanced Headers (custom locations):
  ```
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  ```
- Access List (Beispiel): Allow `192.168.50.0/24` (und weitere interne Netze), Deny all.
- App-Config-Hinweise: `TRUST_PROXY=1`, `COOKIE_SECURE=auto` (X-Forwarded-Proto), `CORS_ORIGINS` Standard `https://rechnung.intern` (weitere Domains anhängen).
- Troubleshooting:
  - Login/Cookie fehlt → Proxy-Header + Trust Proxy + CORS Credentials prüfen
  - PDF hängt → ggf. `proxy_read_timeout` erhöhen
  - 502/504 → Host-IP/Port/Firewall prüfen (Forward auf `192.200.255.225:3031`)

## Frontend (Vite Option A)
- Vite + React + TS + Tailwind unter `frontend/`.
- Build-Output: `frontend` -> `backend/public/` (base `/`, Option A). `vite build` überschreibt `backend/public/index.html` und legt Assets unter `backend/public/assets/` ab.
- Dev: `npm --prefix frontend run dev` (Proxy für /api zu `http://localhost:3031`, konfigurierbar via `VITE_DEV_PROXY`).
- API-Client nutzt `credentials: 'include'`, Basis `VITE_API_BASE` (Default `/api`).

## UI-MVP (Feature-Parität, minimal)
- Login/Logout (Cookie-basiert)
- Dashboard/Landing (Übersicht)
- Recipients: Liste + Anlegen/Bearbeiten/Löschen
- Invoices: Liste + Anlegen + PDF erzeugen/Download
- Users/Roles/Permissions: mindestens anzeigen, Admin kann verwalten

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
