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
  local message="$1" default="$2" var
  while true; do
    read -r -p "${message}${default:+ [${default}]}: " var
    var="${var:-$default}"
    if [ -n "${var}" ]; then
      echo "${var}"
      return
    fi
    warn "Wert darf nicht leer sein."
  done
}
section() {
  printf "\n--- %s ---\n" "$1"
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
  local line
  line="$(grep -m1 "^${key}=" "$file" 2>/dev/null || true)"
  if [ -n "${line}" ]; then
    echo "${line#*=}"
  fi
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

section "Schritt 1: Basisangaben"
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

# Gemeinsame Branding-Pfade (Logos/Favicon) auf shared verlinken
SHARED_PUBLIC="${SHARED_DIR}/public"
SHARED_LOGOS="${SHARED_PUBLIC}/logos"
SHARED_FAVICON="${SHARED_PUBLIC}/favicon.ico"
mkdir -p "${SHARED_LOGOS}"

# Bestehende Assets aus aktuellem Release übernehmen (nur falls vorhanden)
if [ -d "${CURRENT_LINK}/backend/public/logos" ]; then
  cp -an "${CURRENT_LINK}/backend/public/logos/." "${SHARED_LOGOS}/" 2>/dev/null || true
fi
if [ -f "${CURRENT_LINK}/backend/public/favicon.ico" ]; then
  cp -an "${CURRENT_LINK}/backend/public/favicon.ico" "${SHARED_FAVICON}" 2>/dev/null || true
fi

# Defaults aus neuem Release bereitstellen, falls im Shared-Bereich noch nichts liegt
if [ -d "${RELEASE_DIR}/backend/public/logos" ]; then
  cp -an "${RELEASE_DIR}/backend/public/logos/." "${SHARED_LOGOS}/" 2>/dev/null || true
fi
if [ -f "${RELEASE_DIR}/backend/public/favicon.ico" ] && [ ! -f "${SHARED_FAVICON}" ]; then
  cp -an "${RELEASE_DIR}/backend/public/favicon.ico" "${SHARED_FAVICON}" 2>/dev/null || true
fi

# Symlinks ins neue Release setzen
rm -rf "${RELEASE_DIR}/backend/public/logos"
ln -sfn "${SHARED_LOGOS}" "${RELEASE_DIR}/backend/public/logos"
rm -f "${RELEASE_DIR}/backend/public/favicon.ico"
ln -sfn "${SHARED_FAVICON}" "${RELEASE_DIR}/backend/public/favicon.ico"

cd "${RELEASE_DIR}"
if [[ "${MODE,,}" == "install" ]]; then
  info "Führe Basis-Setup aus (env-Dateien)"
  SETUP_QUIET=1 ./scripts/setup.sh
else
  info "Update-Modus: bestehende .env Dateien übernehmen"
  if [ ! -e "${CURRENT_LINK}" ]; then
    fail "Update nicht möglich: ${CURRENT_LINK} existiert nicht. Bitte erst Install ausführen oder gültiges current-Symlink anlegen."
  fi
  if [ -f "${CURRENT_LINK}/.env" ]; then
    cp "${CURRENT_LINK}/.env" "${RELEASE_DIR}/.env"
  else
    fail "Keine bestehende .env gefunden unter ${CURRENT_LINK}/.env. Bitte manuell kopieren und erneut starten."
  fi
  if [ -f "${CURRENT_LINK}/backend/.env" ]; then
    cp "${CURRENT_LINK}/backend/.env" "${RELEASE_DIR}/backend/.env"
  else
    fail "Keine bestehende backend/.env gefunden unter ${CURRENT_LINK}/backend/.env. Bitte manuell kopieren und erneut starten."
  fi
fi

ENV_FILE="${RELEASE_DIR}/.env"
section "Schritt 2: .env konfigurieren"
if [[ "${MODE,,}" == "install" ]]; then
  info "Nur nicht-UI Settings. Enter = Default, [] = Pflicht."
  DB_HOST_VAL="$(current_env_value "${ENV_FILE}" "DB_HOST")"
  DB_PORT_VAL="$(current_env_value "${ENV_FILE}" "DB_PORT")"
  DB_NAME_VAL="$(current_env_value "${ENV_FILE}" "DB_NAME")"
  DB_SCHEMA_VAL="$(current_env_value "${ENV_FILE}" "DB_SCHEMA")"
  DB_USER_VAL="$(current_env_value "${ENV_FILE}" "DB_USER")"
  DB_PASS_VAL="$(current_env_value "${ENV_FILE}" "DB_PASS")"
  DATABASE_URL_VAL="$(current_env_value "${ENV_FILE}" "DATABASE_URL")"
  APP_BIND_IP_VAL="$(current_env_value "${ENV_FILE}" "APP_BIND_IP")"
  APP_PUBLIC_PORT_VAL="$(current_env_value "${ENV_FILE}" "APP_PUBLIC_PORT")"
  APP_PORT_VAL="$(current_env_value "${ENV_FILE}" "APP_PORT")"
  APP_HTTPS_DISABLE_VAL="$(current_env_value "${ENV_FILE}" "APP_HTTPS_DISABLE")"

  set_env_value "${ENV_FILE}" "DB_HOST" "$(prompt "DB_HOST" "${DB_HOST_VAL:-db}")"
  set_env_value "${ENV_FILE}" "DB_PORT" "$(prompt "DB_PORT" "${DB_PORT_VAL:-5432}")"
  set_env_value "${ENV_FILE}" "DB_NAME" "$(prompt "DB_NAME" "${DB_NAME_VAL:-rechnung_prod}")"
  set_env_value "${ENV_FILE}" "DB_SCHEMA" "$(prompt "DB_SCHEMA" "${DB_SCHEMA_VAL:-public}")"
  set_env_value "${ENV_FILE}" "DB_USER" "$(prompt "DB_USER" "${DB_USER_VAL:-rechnung_app}")"
  set_env_value "${ENV_FILE}" "DB_PASS" "$(prompt_required "DB_PASS" "${DB_PASS_VAL:-}")"
  set_env_value "${ENV_FILE}" "DATABASE_URL" "$(prompt "DATABASE_URL" "${DATABASE_URL_VAL:-postgresql://rechnung_app:change_me@db:5432/rechnung_prod?schema=public}")"
  set_env_value "${ENV_FILE}" "APP_BIND_IP" "$(prompt "APP_BIND_IP (Host)" "${APP_BIND_IP_VAL:-0.0.0.0}")"
  set_env_value "${ENV_FILE}" "APP_PUBLIC_PORT" "$(prompt "APP_PUBLIC_PORT (Host-Port)" "${APP_PUBLIC_PORT_VAL:-3031}")"
  set_env_value "${ENV_FILE}" "APP_PORT" "$(prompt "APP_PORT (Container-Port)" "${APP_PORT_VAL:-3030}")"
  set_env_value "${ENV_FILE}" "APP_HTTPS_DISABLE" "$(prompt "APP_HTTPS_DISABLE" "${APP_HTTPS_DISABLE_VAL:-true}")"
else
  info "Update-Modus: .env bleibt unverändert (keine Prompts)."
fi

# Image-Einstellungen (Install: fragen und setzen; Update: Tag/Repo wählbar)
APP_IMAGE_VAL="$(current_env_value "${ENV_FILE}" "APP_IMAGE")"
APP_IMAGE_TAG_VAL="$(current_env_value "${ENV_FILE}" "APP_IMAGE_TAG")"
if [[ "${MODE,,}" == "install" ]]; then
  APP_IMAGE_VAL="$(prompt "APP_IMAGE (Registry/Repo)" "${APP_IMAGE_VAL:-ghcr.io/jpilger-ops/re-webapp}")"
APP_IMAGE_TAG_VAL="$(prompt "APP_IMAGE_TAG (z.B. latest, v1.0.0, Commit-SHA)" "${APP_IMAGE_TAG_VAL:-latest}")"
  set_env_value "${ENV_FILE}" "APP_IMAGE" "${APP_IMAGE_VAL}"
  set_env_value "${ENV_FILE}" "APP_IMAGE_TAG" "${APP_IMAGE_TAG_VAL}"
else
  APP_IMAGE_VAL="$(prompt "APP_IMAGE (Registry/Repo)" "${APP_IMAGE_VAL:-ghcr.io/jpilger-ops/re-webapp}")"
  APP_IMAGE_TAG_VAL="$(prompt "APP_IMAGE_TAG (z.B. latest, v1.0.0, Commit-SHA)" "${APP_IMAGE_TAG_VAL:-latest}")"
  set_env_value "${ENV_FILE}" "APP_IMAGE" "${APP_IMAGE_VAL}"
  set_env_value "${ENV_FILE}" "APP_IMAGE_TAG" "${APP_IMAGE_TAG_VAL}"
fi

# PDF-Pfade automatisch setzen (UI-pflegbar, aber für Schreibbarkeit initialisieren)
PDF_STORAGE_VAL="$(current_env_value "${ENV_FILE}" "PDF_STORAGE_PATH")"
PDF_ARCHIVE_VAL="$(current_env_value "${ENV_FILE}" "PDF_ARCHIVE_PATH")"
PDF_TRASH_VAL="$(current_env_value "${ENV_FILE}" "PDF_TRASH_PATH")"
if [[ "${MODE,,}" == "install" ]]; then
  PDF_STORAGE_PATH="${PDF_STORAGE_VAL:-/app/pdfs}"
  PDF_ARCHIVE_PATH="${PDF_ARCHIVE_VAL:-/app/pdfs/archive}"
  PDF_TRASH_PATH="${PDF_TRASH_VAL:-/app/pdfs/trash}"
  set_env_value "${ENV_FILE}" "PDF_STORAGE_PATH" "${PDF_STORAGE_PATH}"
  set_env_value "${ENV_FILE}" "PDF_ARCHIVE_PATH" "${PDF_ARCHIVE_PATH}"
  set_env_value "${ENV_FILE}" "PDF_TRASH_PATH" "${PDF_TRASH_PATH}"
else
  PDF_STORAGE_PATH="${PDF_STORAGE_VAL:-/app/pdfs}"
  PDF_ARCHIVE_PATH="${PDF_ARCHIVE_VAL:-/app/pdfs/archive}"
  PDF_TRASH_PATH="${PDF_TRASH_VAL:-/app/pdfs/trash}"
fi

# Host-Pfade (Bind-Mount) ermitteln und Rechte setzen, damit PDF/Branding schreibbar sind
HOST_PDF_BASE="${SHARED_DIR}/pdfs"
HOST_PDF_ARCHIVE="${HOST_PDF_BASE}/archive"
HOST_PDF_TRASH="${HOST_PDF_BASE}/trash"
mkdir -p "${HOST_PDF_BASE}" "${HOST_PDF_ARCHIVE}" "${HOST_PDF_TRASH}"
HOST_PUBLIC="${RELEASE_DIR}/backend/public"
HOST_PUBLIC_LOGOS="${SHARED_LOGOS}"
HOST_PUBLIC_FAVICON="${SHARED_FAVICON}"
mkdir -p "${HOST_PUBLIC}"
[ -f "${HOST_PUBLIC_FAVICON}" ] || touch "${HOST_PUBLIC_FAVICON}"
# Rechte hostseitig auf node:node (1000) setzen; Fallback chmod 777
chown -R 1000:1000 "${HOST_PDF_BASE}" "${HOST_PDF_ARCHIVE}" "${HOST_PDF_TRASH}" "${HOST_PUBLIC}" "${HOST_PUBLIC_LOGOS}" "${HOST_PUBLIC_FAVICON}" 2>/dev/null || true
chmod -R 777 "${HOST_PDF_BASE}" "${HOST_PDF_ARCHIVE}" "${HOST_PDF_TRASH}" "${HOST_PUBLIC}" "${HOST_PUBLIC_LOGOS}" "${HOST_PUBLIC_FAVICON}" 2>/dev/null || true

BACKEND_ENV_FILE="${RELEASE_DIR}/backend/.env"
JWT_SECRET_VAL="$(current_env_value "${BACKEND_ENV_FILE}" "JWT_SECRET")"

# DB-Settings zwischen .env (Compose/DB) und backend/.env (App) synchron halten,
# damit keine "password authentication failed" durch abweichende Werte entstehen.
info "Übernehme DB-Einstellungen aus .env nach backend/.env"
for key in DB_HOST DB_PORT DB_NAME DB_SCHEMA DB_USER DB_PASS DATABASE_URL; do
  val="$(current_env_value "${ENV_FILE}" "${key}")"
  [ -n "${val}" ] && set_env_value "${BACKEND_ENV_FILE}" "${key}" "${val}"
done

if ! grep -q "^COMPOSE_PROJECT_NAME=" .env 2>/dev/null; then
  echo "COMPOSE_PROJECT_NAME=${PROJECT_NAME}" >> .env
fi

if [[ "${MODE,,}" == "install" ]]; then
  info "Backend-Env (JWT_SECRET wird benötigt; andere Keys später in der UI konfigurierbar)"
  set_env_value "${BACKEND_ENV_FILE}" "JWT_SECRET" "$(prompt_required "JWT_SECRET" "${JWT_SECRET_VAL:-}")"
else
  info "Update-Modus: backend/.env bleibt unverändert (kein JWT_SECRET Prompt)."
fi

section "Schritt 3: Build & Deploy"
info "Schreibe Build-Metadaten in .env (ohne Build)"
BUILD_SHA="${RELEASE_SHA}" BUILD_NUMBER="${RELEASE_NUMBER}" BUILD_TIME="${RELEASE_TIME}" SKIP_DOCKER_COMPOSE=1 ./scripts/build-meta.sh

export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"

APP_IMAGE_EFF="${APP_IMAGE_VAL:-rechnungsapp}"
APP_IMAGE_TAG_EFF="${APP_IMAGE_TAG_VAL:-latest}"
info "Pull Image: ${APP_IMAGE_EFF}:${APP_IMAGE_TAG_EFF}"
APP_IMAGE="${APP_IMAGE_EFF}" APP_IMAGE_TAG="${APP_IMAGE_TAG_EFF}" docker compose --project-name "${PROJECT_NAME}" pull

# Statische Assets des Images in Host-Pfad spiegeln, damit UI zur Image-Version passt (Branding/Uploads bleiben bestehen)
info "Synchronisiere UI-Assets aus dem Image nach backend/public (ohne bestehende Uploads zu löschen)"
docker run --rm \
  -v "${HOST_PUBLIC}:/host" \
  "${APP_IMAGE_EFF}:${APP_IMAGE_TAG_EFF}" \
  sh -c 'mkdir -p /host && for item in /app/public/*; do name=$(basename "${item}"); if [ "${name}" = "logos" ] || [ "${name}" = "favicon.ico" ]; then continue; fi; cp -r "${item}" /host/; done && chown -R 1000:1000 /host || true'

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
