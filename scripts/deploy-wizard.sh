#!/usr/bin/env bash
set -euo pipefail

info() { printf "==> %s\n" "$*"; }
warn() { printf "!! %s\n" "$*" >&2; }
fail() { printf "✖ %s\n" "$*" >&2; exit 1; }
prompt() {
  local message="$1" default="$2" var
  read -r -p "${message} [${default}]: " var
  echo "${var:-$default}"
}

command -v docker >/dev/null 2>&1 || fail "Docker nicht gefunden. Bitte installieren."
command -v docker compose >/dev/null 2>&1 || fail "docker compose (V2) nicht gefunden. Bitte installieren."
command -v git >/dev/null 2>&1 || fail "git nicht gefunden. Bitte installieren."
command -v tar >/dev/null 2>&1 || fail "tar nicht gefunden."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_SHA="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
RELEASE_NUMBER="$(git -C "${ROOT_DIR}" rev-list --count HEAD)"
RELEASE_TIME="$(git -C "${ROOT_DIR}" show -s --format=%cI HEAD)"

info "Deployment-Wizard startet. Aktueller Commit: ${RELEASE_SHA} (count ${RELEASE_NUMBER})"

BASE_DIR="$(prompt "Installationspfad" "/opt/rechnungsapp")"
MODE="$(prompt "Modus (install/update)" "update")"
PROJECT_NAME="$(prompt "Compose Projektname" "rechnungsapp")"
VERSIONS_DIR="${BASE_DIR}/versions"
RELEASE_DIR="${VERSIONS_DIR}/${RELEASE_SHA}"
CURRENT_LINK="${BASE_DIR}/current"
SHARED_DIR="${BASE_DIR}/shared"

mkdir -p "${VERSIONS_DIR}" "${SHARED_DIR}"
if [ -d "${RELEASE_DIR}" ]; then
  warn "Release-Verzeichnis existiert bereits: ${RELEASE_DIR}"
  CONFIRM="$(prompt "Überschreiben?" "nein")"
  if [[ "${CONFIRM,,}" != "ja" && "${CONFIRM,,}" != "y" ]]; then
    fail "Abbruch, vorhandenes Release bleibt bestehen."
  fi
  rm -rf "${RELEASE_DIR}"
fi
mkdir -p "${RELEASE_DIR}"

info "Exportiere aktuellen Stand nach ${RELEASE_DIR}"
git -C "${ROOT_DIR}" archive --format=tar HEAD | tar -x -C "${RELEASE_DIR}"

# Gemeinsame Daten/PDF-Pfade auf shared verlinken, damit Upgrades keine Daten verlieren.
mkdir -p "${SHARED_DIR}/data" "${SHARED_DIR}/pdfs"
rm -rf "${RELEASE_DIR}/data"
ln -sfn "${SHARED_DIR}/data" "${RELEASE_DIR}/data"
rm -rf "${RELEASE_DIR}/backend/pdfs"
ln -sfn "${SHARED_DIR}/pdfs" "${RELEASE_DIR}/backend/pdfs"

cd "${RELEASE_DIR}"
info "Führe Basis-Setup aus (env-Dateien)"
SETUP_QUIET=1 ./scripts/setup.sh

if ! grep -q "^COMPOSE_PROJECT_NAME=" .env 2>/dev/null; then
  echo "COMPOSE_PROJECT_NAME=${PROJECT_NAME}" >> .env
fi

info "Schreibe Build-Metadaten in .env (ohne Build)"
BUILD_SHA="${RELEASE_SHA}" BUILD_NUMBER="${RELEASE_NUMBER}" BUILD_TIME="${RELEASE_TIME}" SKIP_DOCKER_COMPOSE=1 ./scripts/build-meta.sh

export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

info "Baue Images mit BuildKit"
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose --project-name "${PROJECT_NAME}" build

info "Prisma Migrationen anwenden"
docker compose --project-name "${PROJECT_NAME}" run --rm app npx prisma migrate deploy

info "Admin-User sicherstellen (admin / admin, bitte später ändern)"
DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-admin}" docker compose --project-name "${PROJECT_NAME}" run --rm app npx prisma db seed

info "Container starten"
docker compose --project-name "${PROJECT_NAME}" up -d

info "Aktiviere neues Release via Symlink ${CURRENT_LINK}"
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

if command -v curl >/dev/null 2>&1; then
  PORT="$(grep -m1 "^APP_PUBLIC_PORT=" .env | cut -d= -f2-)"
  PORT="${PORT:-3031}"
  info "Healthcheck: http://127.0.0.1:${PORT}/api/version"
  curl -fsS "http://127.0.0.1:${PORT}/api/version" || warn "Healthcheck fehlgeschlagen (ggf. Port/Proxy prüfen)."
fi

info "Fertig. Nutze ${CURRENT_LINK} für nachfolgende Kommandos. Modus: ${MODE}"
