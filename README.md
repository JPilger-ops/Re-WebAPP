# Re-WebAPP (dev_Prisma)

Interne Rechnungs- und Verwaltungs-App (Docker Compose: Backend Node/Express/Prisma, Frontend React/Vite, DB Postgres).

## Überblick
- Backend: Node/Express/Prisma
- Frontend: React/Vite
- Datenbank: Postgres

## Stack, Ports & Pfade
- Backend intern: `APP_PORT` (Default 3030)
- Extern via Compose: `APP_BIND_IP:APP_PUBLIC_PORT` (Default 0.0.0.0:3031)
- Branding/Uploads persistent: `PUBLIC_LOGOS_PATH` / `PUBLIC_FAVICON_PATH`
  - Default Logos: `./data/public/logos`
  - Default Favicon: `./backend/public/favicon.ico`
- Scripts:
  - `./scripts/setup.sh` (legt `.env` + `backend/.env` an)
  - `./scripts/build-meta.sh` (setzt `BUILD_*` + optional Build)

## Voraussetzungen (Ubuntu 22.04)
```bash
sudo apt-get update
sudo apt-get install -y gnupg ca-certificates curl lsb-release apt-transport-https
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version && docker compose version
```

## Schnellstart (fertiges Image)
```bash
git clone https://github.com/JPilger-ops/Re-WebAPP
cd Re-WebAPP
./scripts/setup.sh
./scripts/build-meta.sh            # optional für lokale Builds
docker compose pull                # zieht APP_IMAGE/APP_IMAGE_TAG (default ghcr.io/jpilger-ops/re-webapp:latest)
docker compose up -d
curl http://127.0.0.1:3031/api/version
```
Login: `admin` / `admin` (bitte direkt ändern).

## Deployment Wizard (empfohlen)
```bash
git clone https://github.com/JPilger-ops/Re-WebAPP /opt/rechnungsapp
cd /opt/rechnungsapp
./scripts/deploy-wizard.sh    # Modus: install oder update
```
- Fragt DB-/Port-/JWT-/Image-Werte ab und spiegelt UI-Assets aus dem Image nach `backend/public` (Branding/Uploads bleiben bestehen).
- Legt Branding-Pfade persistent unter `shared/public/logos` und `shared/public/favicon.ico` an und erstellt im Update-Modus ein `pg_dump` nach `shared/backups`.
- Healthcheck: `curl http://127.0.0.1:${APP_PUBLIC_PORT:-3031}/api/version`

## Manuelles Deploy/Update (ohne Wizard)
```bash
cd /opt/rechnungsapp/current
docker compose pull
docker compose up -d
docker compose run --rm app npx prisma migrate deploy
curl http://127.0.0.1:${APP_PUBLIC_PORT:-3031}/api/version
```
- Updates aus Source:
  - `git pull && ./scripts/build-meta.sh && docker compose up -d --build`
- Branding-Pfade auf persistente Locations zeigen lassen (`PUBLIC_LOGOS_PATH`, `PUBLIC_FAVICON_PATH`, Default `./data/public/...`)
  - ggf. via `./scripts/setup.sh` mit Default-Assets befüllen

## Backups
```bash
docker compose exec db pg_dump -U $DB_USER -d $DB_NAME > backup.sql
cat backup.sql | docker compose exec -T db psql -U $DB_USER -d $DB_NAME
```

## Troubleshooting
- White Screen: Hard Reload, prüfen ob `backend/public/assets` 200 liefern.
- PDF: Pfade/Schreibrechte in den UI-PDF-Settings prüfen, Verzeichnisse existieren.
- Mail: `EMAIL_SEND_DISABLED` / `EMAIL_REDIRECT_TO` prüfen, SMTP in UI setzen.
- Version: `curl http://127.0.0.1:${APP_PUBLIC_PORT:-3031}/api/version`
- CORS: UI-Netzwerk-Settings `CORS_ORIGINS` befüllen (z.B. `https://rechnung.intern,http://localhost:3031`); bei externer TLS-Termination Origin als https eintragen.
