#!/usr/bin/env bash
set -euo pipefail

color() { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info() { color "36" "$1"; }
success() { color "32" "$1"; }
warn() { color "33" "$1"; }
error() { color "31" "$1"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
QUIET_SETUP="${SETUP_QUIET:-0}"

if ! command -v docker >/dev/null; then
  error "Docker ist nicht installiert. Bitte zuerst Docker installieren."; exit 1;
fi
if ! command -v docker compose >/dev/null && ! command -v docker-compose >/dev/null; then
  error "Docker Compose fehlt. Bitte installieren."; exit 1;
fi

if [ ! -f .env ]; then
  cp .env.example .env
  warn ".env wurde aus .env.example erzeugt. Bitte DB_PASS, DB_USER, DB_NAME anpassen."
else
  info ".env existiert bereits."
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  warn "backend/.env wurde aus backend/.env.example erzeugt. Bitte Secrets/SMTP prüfen."
else
  info "backend/.env existiert bereits."
fi

info "Wichtige Variablen (aus .env):"
grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME|DB_SCHEMA|APP_HOST|APP_PORT|APP_BIND_IP|APP_PUBLIC_PORT)=' .env || true

# Persistente Branding-Pfade anlegen und mit Defaults befüllen, damit Updates Logos/Favicon behalten
LOGO_PATH="$(grep -m1 '^PUBLIC_LOGOS_PATH=' .env | cut -d= -f2- || true)"
LOGO_PATH="${LOGO_PATH:-./data/public/logos}"
FAVICON_PATH="$(grep -m1 '^PUBLIC_FAVICON_PATH=' .env | cut -d= -f2- || true)"
FAVICON_PATH="${FAVICON_PATH:-./backend/public/favicon.ico}"

mkdir -p "${LOGO_PATH}"
if compgen -G "backend/public/logos/*" >/dev/null 2>&1; then
  cp -n backend/public/logos/* "${LOGO_PATH}/" 2>/dev/null || true
fi
mkdir -p "$(dirname "${FAVICON_PATH}")"
if [ -f backend/public/favicon.ico ] && [ ! -e "${FAVICON_PATH}" ]; then
  cp -n backend/public/favicon.ico "${FAVICON_PATH}" 2>/dev/null || true
fi
chmod -R 777 "${LOGO_PATH}" "$(dirname "${LOGO_PATH}")" "$(dirname "${FAVICON_PATH}")" "${FAVICON_PATH}" 2>/dev/null || true

if [ "$QUIET_SETUP" != "1" ]; then
cat <<'EOF'
Nächste Schritte:
1) Trage sichere Werte in .env ein (mind. DB_PASS, DB_USER, DB_NAME).
2) Build mit Git-Metadaten: ./scripts/build-meta.sh
3) Container starten: docker compose up -d --build
   - Auf deinem Server: setze APP_BIND_IP=192.200.255.225 und APP_PUBLIC_PORT=3031 (Host-Port)
   - Standard (CI/Local): APP_BIND_IP=0.0.0.0, APP_PUBLIC_PORT=3031
4) Healthcheck: curl http://${APP_BIND_IP:-127.0.0.1}:${APP_PUBLIC_PORT:-3031}/api/version
EOF

  success "Setup-Skript fertig."
fi
