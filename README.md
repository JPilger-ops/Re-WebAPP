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
git clone https://github.com/JPilger-ops/Re-WebAPP
cd Re-WebAPP
./scripts/setup.sh                 # legt .env + backend/.env an, falls fehlen
./scripts/build-meta.sh            # setzt BUILD_* (für lokale Builds optional)
docker compose pull                # zieht fertiges Image (APP_IMAGE/APP_IMAGE_TAG, default ghcr.io/jpilger-ops/re-webapp:latest)
docker compose up -d               # startet DB + App
curl http://127.0.0.1:3031/api/version
```
Login: `admin` / `admin` (bitte direkt ändern).

## Deployment mit Wizard (empfohlen, image-basiert)
Neu-Install (alle ENV abfragen, Image ziehen, starten):
```bash
# Prereqs (Ubuntu 22.04, einmalig)
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Repo holen
git clone https://github.com/JPilger-ops/Re-WebAPP /opt/rechnungsapp
cd /opt/rechnungsapp

# Wizard starten (Modus: install)
./scripts/deploy-wizard.sh
# Prompts: Pfad, Modus=install, Projektname, DB_*/Ports/JWT_SECRET, APP_IMAGE/APP_IMAGE_TAG (default ghcr.io/jpilger-ops/re-webapp:latest)
# Der Wizard spiegelt die UI-Assets aus dem gewählten Image in backend/public, damit die Oberfläche immer zum Image passt (Branding/Uploads bleiben erhalten).
```
Healthcheck:
```bash
curl http://127.0.0.1:3031/api/version
```

Update (ENV bleibt, aber Image/Tag kann gewählt werden):
```bash
cd /opt/rechnungsapp/current   # oder dein BASE/current
./scripts/deploy-wizard.sh     # Modus: update, fragt APP_IMAGE / APP_IMAGE_TAG ab (default: bisherige Werte)
```
- Wizard legt Branding-Pfade persistent unter `shared/public/logos` und `shared/public/favicon.ico` ab (`PUBLIC_LOGOS_PATH` / `PUBLIC_FAVICON_PATH`) und erstellt vor Updates ein `pg_dump` in `shared/backups`, damit Logos und DB-Daten erhalten bleiben.

Manuell (ohne Wizard):
```bash
cd /opt/rechnungsapp/current
docker compose pull
docker compose up -d
docker compose run --rm app npx prisma migrate deploy
curl http://127.0.0.1:3031/api/version
```
- Für manuelle Deploys `PUBLIC_LOGOS_PATH` und `PUBLIC_FAVICON_PATH` auf einen persistenten Pfad (Default `./data/public/...`) zeigen lassen und bei Bedarf via `./scripts/setup.sh` mit Default-Assets befüllen, damit Branding beim Update bleibt.
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
