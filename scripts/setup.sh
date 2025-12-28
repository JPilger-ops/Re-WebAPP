#!/usr/bin/env bash
set -euo pipefail

color() { printf "\033[%sm%s\033[0m\n" "$1" "$2"; }
info() { color "36" "$1"; }
success() { color "32" "$1"; }
warn() { color "33" "$1"; }
error() { color "31" "$1"; }

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

info "Wichtige Variablen (aus .env):"
grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME|DB_SCHEMA|APP_HOST|APP_PORT|APP_BIND_IP|APP_PUBLIC_PORT)=' .env || true

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
