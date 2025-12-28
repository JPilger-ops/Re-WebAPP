# Re-WebAPP (dev_Prisma)

Interne Rechnungs- und Verwaltungs-App mit Backend (Node/Express/Prisma), Frontend (React/Vite/Tailwind, als statische Assets aus dem Backend), Postgres-DB und optionalem Reverse Proxy (NGINX Proxy Manager). Ports/Domain sind für den internen Betrieb vorbelegt: Host-IP 192.200.255.225, Host-Port 3031, Domain rechnung.intern (Proxy auf 192.168.50.100).

## 1) Überblick
- Features: Kunden/Recipients, Rechnungen (PDF/Regenerate), Kategorien (Logo/SMTP/Template), E-Mail-Vorschau/-Versand, DATEV-Export, Stats, Admin Users/Rollen/Permissions, Settings (PDF/SMTP/Header/Bank/Tax/DATEV/HKForms/Network/Security), API-Keys (HKForms), Health/Smoke Checks.
- Architektur: Backend (Express + Prisma) liefert API + statische Assets (Vite build unter backend/public). DB: Postgres. Puppeteer/Chromium im Container für PDFs. Reverse Proxy (NPM) terminiert TLS; App spricht intern HTTP.

## 2) Quickstart (Server/Local)
Voraussetzungen: Docker Engine >= 20.x, Docker Compose v2 (BuildKit empfohlen/Default).

Schritte (manuell):
1. `git clone <repo>`
2. `./scripts/setup.sh` (legt .env + backend/.env an, wenn fehlen)
3. `.env` anpassen (mindestens DB_PASS, DB_USER, DB_NAME setzen; ggf. backend/.env Secrets)
4. `./scripts/build-meta.sh` (schreibt BUILD_SHA/BUILD_NUMBER/BUILD_TIME in `.env` und ruft `docker compose build` mit BuildKit)
5. `docker compose up -d --build` (Standard-Workflow, nutzt BuildKit-Cache)
6. Smoke-Checks (im Repo):
   - `npm --prefix backend run check:api`
   - `npm --prefix backend run check:pdf`
   - `npm --prefix backend run check:invoice`

### Geführtes Deployment/Update (Wizard, inkl. Symlink `current`)
Empfohlen für Server-Rollout mit Versionen und geteilten Daten/PDFs.

1. Stelle sicher, dass das Repo sauber ist (`git status`) und der gewünschte Commit ausgecheckt ist.
2. Starte den Wizard: `./scripts/deploy-wizard.sh`
   - Fragt Installationspfad (Default: `/opt/rechnungsapp`), Modus (install/update), Compose-Projektname.
   - Fragt nur nicht-UI-konfigurierbare `.env`-Werte ab: DB_HOST/PORT/NAME/SCHEMA/USER/PASS, DATABASE_URL, APP_BIND_IP, APP_PUBLIC_PORT, APP_PORT, APP_HTTPS_DISABLE sowie `JWT_SECRET` in backend/.env. Defaults: DB_HOST=db, DB_PORT=5432, DB_NAME=rechnung_prod, DB_SCHEMA=public, DB_USER=rechnung_app, DATABASE_URL=postgresql://rechnung_app:change_me@db:5432/rechnung_prod?schema=public, APP_BIND_IP=0.0.0.0, APP_PUBLIC_PORT=3031, APP_PORT=3030, APP_HTTPS_DISABLE=true. DB_PASS und JWT_SECRET müssen gesetzt werden.
   - PDF-Pfade werden initial auf `/app/pdfs`, `/app/pdfs/archive`, `/app/pdfs/trash` gesetzt und Verzeichnisse angelegt (später in der UI änderbar).
   - Exportiert den aktuellen Commit nach `<BASE>/versions/<sha>`, legt `shared/data` und `shared/pdfs` an und verlinkt sie in das Release (Einstellungen/Kategorien bleiben erhalten).
   - Schreibt Build-Metadaten (SHA/Number/Time) in `.env`, setzt optional `COMPOSE_PROJECT_NAME`.
   - Führt `docker compose build`, `prisma migrate deploy`, optional `prisma db seed` (legt admin/admin an, falls fehlend) und `docker compose up -d` aus.
   - Aktiviert das Release über den Symlink `<BASE>/current`.
3. Healthcheck (Wizard macht optional): `curl http://127.0.0.1:${APP_PUBLIC_PORT:-3031}/api/version`
4. Standard-Login nach frischem Setup: admin / admin (bitte direkt ändern; bei Updates bleibt bestehendes Passwort unverändert, wenn Seed übersprungen wird).

Defaults:
- Host-IP: 192.200.255.225
- Host-Port: 3031 (forward durch NPM)
- Container-Port: 3030 (APP_PORT); Compose mappt 192.200.255.225:3031 -> 3030
  - Port-Binding per ENV steuerbar: APP_BIND_IP (default 0.0.0.0), APP_PUBLIC_PORT (default 3031)
  - Auf Server: APP_BIND_IP=192.200.255.225, APP_PUBLIC_PORT=3031. In CI/local reicht Default.
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
- APP_HOST / APP_PORT (Default 0.0.0.0 / 3030; Host-Port 3031 wird über docker-compose gebunden)
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
- Alternativ: Wizard (s.o.) für versionierten Rollout mit Symlink-Switch (`./scripts/deploy-wizard.sh`)
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

## 7) Prereqs: Docker/Compose installieren (Ubuntu/Debian Beispiel)
```bash
sudo apt-get update
sudo apt-get install -y gnupg ca-certificates curl lsb-release apt-transport-https
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version
docker compose version
```

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
- Design-QA/Apple-Look: siehe `docs/design-qa.md` (Checkliste) und `docs/design-diff.md` (Style-Änderungen)

Frontend:
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`

Build-Metadaten/Version:
- `./scripts/build-meta.sh` ermittelt SHA + Commit-Count aus Git, aktualisiert `.env` (BUILD_SHA, BUILD_NUMBER, BUILD_TIME) und ruft `docker compose build` mit BuildKit.
- `/api/version` gibt Version + Build aus; lokal testen mit `curl http://127.0.0.1:3031/api/version`.

Team-Workflow: Nach Meilensteinen commit/push auf dev_Prisma; Compose/Smoke grün halten.
