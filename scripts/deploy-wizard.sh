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
prompt_required() {
  local message="$1" default="$2" value
  while true; do
    read -r -p "${message}${default:+ [${default}]}: " value
    value="${value:-$default}"
    if [ -n "${value}" ]; then
      echo "${value}"
      return
    fi
    warn "Wert darf nicht leer sein."
  done
}
set_env_value() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s#^${key}=.*#${key}=${value}#g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}
current_env_value() {
  local file="$1" key="$2"
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2-
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

ENV_FILE="${RELEASE_DIR}/.env"
info "Frage zentrale .env Werte ab (Pflichtfelder ohne Default)"
DB_HOST_VAL="$(current_env_value "${ENV_FILE}" "DB_HOST")"
DB_PORT_VAL="$(current_env_value "${ENV_FILE}" "DB_PORT")"
DB_NAME_VAL="$(current_env_value "${ENV_FILE}" "DB_NAME")"
DB_USER_VAL="$(current_env_value "${ENV_FILE}" "DB_USER")"
DB_PASS_VAL="$(current_env_value "${ENV_FILE}" "DB_PASS")"
APP_BIND_IP_VAL="$(current_env_value "${ENV_FILE}" "APP_BIND_IP")"
APP_PUBLIC_PORT_VAL="$(current_env_value "${ENV_FILE}" "APP_PUBLIC_PORT")"
APP_PORT_VAL="$(current_env_value "${ENV_FILE}" "APP_PORT")"
PDF_STORAGE_VAL="$(current_env_value "${ENV_FILE}" "PDF_STORAGE_PATH")"
PDF_ARCHIVE_VAL="$(current_env_value "${ENV_FILE}" "PDF_ARCHIVE_PATH")"
PDF_TRASH_VAL="$(current_env_value "${ENV_FILE}" "PDF_TRASH_PATH")"

set_env_value "${ENV_FILE}" "DB_HOST" "$(prompt_required "DB_HOST" "${DB_HOST_VAL}")"
set_env_value "${ENV_FILE}" "DB_PORT" "$(prompt_required "DB_PORT" "${DB_PORT_VAL}")"
set_env_value "${ENV_FILE}" "DB_NAME" "$(prompt_required "DB_NAME" "${DB_NAME_VAL}")"
set_env_value "${ENV_FILE}" "DB_USER" "$(prompt_required "DB_USER" "${DB_USER_VAL}")"
set_env_value "${ENV_FILE}" "DB_PASS" "$(prompt_required "DB_PASS" "${DB_PASS_VAL}")"
set_env_value "${ENV_FILE}" "APP_BIND_IP" "$(prompt_required "APP_BIND_IP (Host)" "${APP_BIND_IP_VAL}")"
set_env_value "${ENV_FILE}" "APP_PUBLIC_PORT" "$(prompt_required "APP_PUBLIC_PORT (Host-Port)" "${APP_PUBLIC_PORT_VAL}")"
set_env_value "${ENV_FILE}" "APP_PORT" "$(prompt_required "APP_PORT (Container-Port)" "${APP_PORT_VAL:-3030}")"
set_env_value "${ENV_FILE}" "PDF_STORAGE_PATH" "$(prompt_required "PDF_STORAGE_PATH (Speicher)" "${PDF_STORAGE_VAL}")"
set_env_value "${ENV_FILE}" "PDF_ARCHIVE_PATH" "$(prompt "PDF_ARCHIVE_PATH (optional Archiv, leer lassen wenn nicht genutzt)" "${PDF_ARCHIVE_VAL}")"
set_env_value "${ENV_FILE}" "PDF_TRASH_PATH" "$(prompt "PDF_TRASH_PATH (optional Trash, leer lassen wenn nicht genutzt)" "${PDF_TRASH_VAL}")"

BACKEND_ENV_FILE="${RELEASE_DIR}/backend/.env"
JWT_SECRET_VAL="$(current_env_value "${BACKEND_ENV_FILE}" "JWT_SECRET")"
info "Backend-Env (Pflicht: JWT_SECRET, Rest optional und später in UI änderbar)"
set_env_value "${BACKEND_ENV_FILE}" "JWT_SECRET" "$(prompt_required "JWT_SECRET" "${JWT_SECRET_VAL}")"

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

RUN_SEED_DEFAULT="ja"
if [[ "${MODE,,}" == "update" ]]; then
  RUN_SEED_DEFAULT="nein"
fi
RUN_SEED="$(prompt "Admin-Seed ausführen (legt admin/admin an, ändert kein bestehendes PW)" "${RUN_SEED_DEFAULT}")"
if [[ "${RUN_SEED,,}" == "ja" || "${RUN_SEED,,}" == "y" ]]; then
  info "Admin-User sicherstellen (admin / admin, bitte später ändern)"
  DEFAULT_ADMIN_PASSWORD="${DEFAULT_ADMIN_PASSWORD:-admin}" docker compose --project-name "${PROJECT_NAME}" run --rm app npx prisma db seed
else
  info "Admin-Seed übersprungen (bestehende Benutzer bleiben unverändert)"
fi

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
