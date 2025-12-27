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

if [ ! -f .env ]; then
  info ".env fehlt -> kopiere .env.example"
  cp .env.example .env
  warn "Bitte .env anpassen (DB_PASS, APP_BIND_IP usw.)."
else
  info ".env vorhanden"
fi

if [ ! -f backend/.env ]; then
  info "backend/.env fehlt -> kopiere backend/.env.example"
  cp backend/.env.example backend/.env
else
  info "backend/.env vorhanden"
fi

info "Baue Images (docker compose build)"
docker compose build

info "Starte Container (docker compose up -d)"
docker compose up -d

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
