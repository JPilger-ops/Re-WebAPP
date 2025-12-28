#!/usr/bin/env bash
set -euo pipefail

info() { printf "==> %s\n" "$*"; }
warn() { printf "!! %s\n" "$*" >&2; }
fail() { printf "✖ %s\n" "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || fail "Docker nicht gefunden. Bitte installieren."
if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose nicht gefunden. Bitte Docker Compose V2 installieren."
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info "Führe Basis-Setup aus (legt fehlende .env Dateien an)"
SETUP_QUIET=1 ./scripts/setup.sh

info "Baue Images (inkl. Build-Metadaten aus Git)"
./scripts/build-meta.sh

info "Starte Container (docker compose up -d --build)"
docker compose up -d --build

info "Container Status:"
docker compose ps

if command -v curl >/dev/null 2>&1; then
  PORT="${APP_PUBLIC_PORT:-3031}"
  info "Optionaler Healthcheck: http://127.0.0.1:${PORT}/api/version"
  if ! curl -fsS "http://127.0.0.1:${PORT}/api/version"; then
    warn "Healthcheck fehlgeschlagen (ggf. Port/Proxy prüfen)."
  fi
else
  warn "curl nicht vorhanden, überspringe Healthcheck."
fi

info "Fertig. Logs: docker compose logs -f app"
