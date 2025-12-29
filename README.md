# Re-WebAPP (dev_Prisma)

Interne Rechnungs- und Verwaltungs-App. Läuft ausschließlich via Docker Compose (Backend: Node/Express/Prisma, Frontend: React/Vite, DB: Postgres).

## Voraussetzungen (Ubuntu 22.04)
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

## Schnellstart (Compose)
```bash
git clone <repo-url> rechnungsapp
cd rechnungsapp
./scripts/setup.sh                 # legt .env + backend/.env an, falls fehlen
./scripts/build-meta.sh            # setzt BUILD_* (für lokale Builds optional)
docker compose pull                # zieht fertiges Image (APP_IMAGE/APP_IMAGE_TAG, default ghcr.io/jpilger-ops/re-webapp:latest)
docker compose up -d               # startet DB + App
curl http://127.0.0.1:3031/api/version
```
Login: `admin` / `admin` (bitte direkt ändern).

## Deployment mit Wizard
```bash
cd rechnungsapp
./scripts/deploy-wizard.sh
```
- Fragt nur nicht-UI-konfigurierbare ENV: DB_HOST/PORT/NAME/SCHEMA/USER/PASS, DATABASE_URL, APP_BIND_IP, APP_PUBLIC_PORT, APP_PORT, APP_HTTPS_DISABLE, JWT_SECRET (nur Install). Defaults: DB_HOST=db, DB_PORT=5432, DB_NAME=rechnung_prod, DB_SCHEMA=public, DB_USER=rechnung_app, DATABASE_URL=postgresql://rechnung_app:change_me@db:5432/rechnung_prod?schema=public, APP_BIND_IP=0.0.0.0, APP_PUBLIC_PORT=3031, APP_PORT=3030, APP_HTTPS_DISABLE=true. DB_PASS und JWT_SECRET müssen angegeben werden. APP_IMAGE/APP_IMAGE_TAG können gesetzt werden (default ghcr.io/jpilger-ops/re-webapp:latest).
- PDF-Pfade werden initial auf `/app/pdfs` (+ `/archive`, `/trash`) gesetzt und Verzeichnisse angelegt; später in der UI änderbar.
- Wizard exportiert den aktuellen Commit nach `<BASE>/versions/<sha>`, setzt Build-Metadaten, zieht das Image (`docker compose pull`), führt `prisma migrate deploy`, optional `prisma db seed` (admin/admin, falls fehlend) und `docker compose up -d` aus, aktiviert Symlink `<BASE>/current`.
- Healthcheck: `curl http://127.0.0.1:${APP_PUBLIC_PORT:-3031}/api/version`

## Update (ohne Wizard)
```bash
git pull
./scripts/build-meta.sh
docker compose up -d --build
curl http://127.0.0.1:3031/api/version
```

## Backups
```bash
docker compose exec db pg_dump -U $DB_USER -d $DB_NAME > backup.sql
cat backup.sql | docker compose exec -T db psql -U $DB_USER -d $DB_NAME
```

## Troubleshooting (kurz)
- White Screen: Hard Reload, prüfen ob `backend/public/assets` 200 liefern.
- PDF-Fehler: Pfade/Schreibrechte prüfen (UI-Settings), Verzeichnisse bestehen.
- Mail: `EMAIL_SEND_DISABLED` / `EMAIL_REDIRECT_TO` prüfen, SMTP in UI hinterlegen.
- Version prüfen: `curl http://127.0.0.1:3031/api/version`
- CORS: In den UI-Netzwerk-Settings `CORS_ORIGINS` als kommaseparierte Liste (z.B. `https://rechnung.intern,http://localhost:3031`). Wenn TLS extern terminiert, Origin mit https eintragen, Backend bleibt intern HTTP.
