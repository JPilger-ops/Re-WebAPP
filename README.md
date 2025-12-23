# Re-WebAPP (dev_Prisma)

Interne Rechnungs- und Verwaltungs-App mit Backend (Node/Express/Prisma), Frontend (React/Vite/Tailwind, als statische Assets aus dem Backend), Postgres-DB und optionalem Reverse Proxy (NGINX Proxy Manager). Ports/Domain sind für den internen Betrieb vorbelegt: Host-IP 192.200.255.225, Host-Port 3031, Domain rechnung.intern (Proxy auf 192.168.50.100).

## 1) Überblick
- Features: Kunden/Recipients, Rechnungen (PDF/Regenerate), Kategorien (Logo/SMTP/Template), E-Mail-Vorschau/-Versand, DATEV-Export, Stats, Admin Users/Rollen/Permissions, Settings (PDF/SMTP/Header/Bank/Tax/DATEV/HKForms/Network/Security), API-Keys (HKForms), Health/Smoke Checks.
- Architektur: Backend (Express + Prisma) liefert API + statische Assets (Vite build unter backend/public). DB: Postgres. Puppeteer/Chromium im Container für PDFs. Reverse Proxy (NPM) terminiert TLS; App spricht intern HTTP.

## 2) Quickstart (Server/Local)
Voraussetzungen: Docker + Docker Compose.

Schritte:
1. `git clone <repo>`
2. `./scripts/setup.sh` (legt .env an, wenn fehlt)
3. `.env` anpassen (mindestens DB_PASS, DB_USER, DB_NAME setzen)
4. `docker compose up -d --build`
5. Smoke-Checks (im Repo):
   - `npm --prefix backend run check:api`
   - `npm --prefix backend run check:pdf`
   - `npm --prefix backend run check:invoice`

Defaults:
- Host-IP: 192.200.255.225
- Host-Port: 3031 (forward durch NPM)
- Domain: rechnung.intern (Proxy auf 192.168.50.100)
- App intern: HTTP only; TLS ausschließlich im NPM

## 3) NGINX Proxy Manager (NPM) Setup
- Proxy Host: rechnung.intern
- Forward: `http://192.200.255.225:3031`
- TLS nur im NPM; Force SSL/HTTP2 optional.
- Advanced Header Snippet:
  ```
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  ```
- Trust Proxy aktiv (App erkennt X-Forwarded-Proto). CORS_ORIGINS Default: https://rechnung.intern; weitere Domains per ENV ergänzen.

## 4) Konfiguration (.env & Settings UI)
Wichtige ENV:
- DB_* (DB_HOST/PORT/USER/PASS/NAME/SCHEMA, DATABASE_URL)
- APP_HOST / APP_PORT (Default 192.200.255.225 / 3031)
- TRUST_PROXY, CORS_ORIGINS
- EMAIL_SEND_DISABLED, EMAIL_REDIRECT_TO (Safe-Mail)
- SMTP Fallback (ENV), Category-/DB-SMTP über UI

Settings-Tabs (UI, Admin-only):
- PDF: Speicherpfad + Test (Pfad muss ins Volume gebunden sein)
- SMTP/Testmail: globales SMTP, Test-Mail (dry-run/redirect beachtet)
- Rechnungskopf: Header/Logo; Hinweis: PDFs neu generieren
- Bank/Steuer
- DATEV
- HKForms + API Keys (create/rotate/revoke/delete im HKForms Tab)
- Network/Security (Trust Proxy/CORS Hinweise)

## 5) Betrieb / Wartung
- Update: `git pull` + `docker compose up -d --build`
- Logs: `docker compose logs -f app`
- DB Backup/Restore (Beispiel):
  - Backup: `docker compose exec db pg_dump -U $DB_USER -d $DB_NAME > backup.sql`
  - Restore: `cat backup.sql | docker compose exec -T db psql -U $DB_USER -d $DB_NAME`
- Migration/Seed: Container-Start führt `prisma migrate deploy` + `prisma db seed` (Bootstrap) aus.
- Troubleshooting:
  - White screen: Hard Reload, prüfen, ob Assets (backend/public/assets) 200 liefern.
  - PDF-Fehler: PDF-Path in Settings prüfen, Test-Path Endpoint nutzen.
  - Mail: EMAIL_SEND_DISABLED/REDIRECT beachten; SMTP-Konfig prüfen.
  - DATEV: Status/Timestamp in Invoice (list/detail); parity scripts nutzen.

## 6) Developer / Scripts
Backend-Smokes/Special:
- `npm --prefix backend run check:api`
- `npm --prefix backend run check:pdf`
- `npm --prefix backend run check:invoice`
- `npm --prefix backend run check:parity`
- `npm --prefix backend run check:pdf-parity`
- `npm --prefix backend run check:mail-parity`
- `npm --prefix backend run check:datev-parity`
- `npm --prefix backend run check:hkforms-parity`

Frontend:
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

Team-Workflow: Nach Meilensteinen commit/push auf dev_Prisma; Compose/Smoke grün halten.

