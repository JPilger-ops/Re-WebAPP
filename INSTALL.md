# Installation (guided)

Voraussetzungen
- Docker Engine >= 20.x und Docker Compose v2 installiert (BuildKit empfohlen/Default)
- Git installiert
- Ports: Standard Host-Port 3031 (extern) → Container 3030 (intern). Bei Bedarf in `.env` über `APP_PUBLIC_PORT` anpassen.

Schnellstart
1) Repository klonen  
   `git clone <repo-url> && cd rechnungsapp`
2) Env-Dateien anlegen (falls nicht vorhanden)  
   - `.env` aus `.env.example` kopieren und DB/Port anpassen  
   - `backend/.env` aus `backend/.env.example` kopieren
3) Build & Start  
   - `./scripts/build-meta.sh` (setzt BUILD_SHA/BUILD_NUMBER/TIME in `.env` und ruft `docker compose build` mit BuildKit)  
   - `docker compose up -d --build`
4) Status prüfen  
   - `docker compose ps` (Healthchecks)  
   - optional: `curl http://127.0.0.1:3031/api/version` (oder Port aus `.env`)

Geführte Installation
- Script: `bash scripts/install.sh`
- Führt Checks (Docker/Compose), legt fehlende `.env` an, baut Images und startet Container. Zeigt Status und optional Healthcheck.

Update / Redeploy
1) `git pull`
2) `./scripts/build-meta.sh`
3) `docker compose up -d --build`

Troubleshooting
- Logs App/DB: `docker compose logs -f app` / `docker compose logs -f db`
- Gesundheit: `docker compose ps`
- Ports: `.env` → `APP_BIND_IP`, `APP_PUBLIC_PORT`, `APP_PORT`
- DB: `docker compose exec db psql -U rechnung_app -d rechnung_prod`
