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
  HTTPS_DISABLE_RAW="$(grep -h -m1 "^APP_HTTPS_DISABLE=" .env backend/.env 2>/dev/null | cut -d= -f2- | tr -d '\r')"
  HTTPS_DISABLE="${HTTPS_DISABLE_RAW,,}"
  PROTO="http"
  CURL_ARGS="-fsS"
  if [[ "${HTTPS_DISABLE}" != "true" && "${HTTPS_DISABLE}" != "1" && "${HTTPS_DISABLE}" != "yes" ]]; then
    PROTO="https"
    CURL_ARGS="-fsSk"
  fi
  URL_PRIMARY="${PROTO}://127.0.0.1:${PORT}/api/version"
  URL_FALLBACK="http://127.0.0.1:${PORT}/api/version"
  if [[ "${PROTO}" == "http" ]]; then
    URL_FALLBACK="https://127.0.0.1:${PORT}/api/version"
  fi

  info "Optionaler Healthcheck: ${URL_PRIMARY}"
  HEALTH_OK=""
  for _ in {1..10}; do
    if curl ${CURL_ARGS} "${URL_PRIMARY}" >/dev/null; then
      HEALTH_OK="yes"
      break
    fi
    sleep 2
  done
  if [[ -z "${HEALTH_OK}" ]]; then
    if curl -fsSk "${URL_FALLBACK}" >/dev/null; then
      warn "Healthcheck ok via ${URL_FALLBACK}. Prüfe APP_HTTPS_DISABLE/Port."
    else
      warn "Healthcheck fehlgeschlagen (ggf. Port/Proxy prüfen)."
    fi
  fi
else
  warn "curl nicht vorhanden, überspringe Healthcheck."
fi

info "Fertig. Logs: docker compose logs -f app"
