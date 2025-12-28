#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "Fehlender Befehl: git" >&2
  exit 1
fi
PYTHON_BIN="python3"
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "Fehlender Befehl: python3" >&2
    exit 1
  fi
fi

BUILD_SHA="$(git rev-parse --short HEAD)"
BUILD_NUMBER="$(git rev-list --count HEAD)"
BUILD_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
ENV_FILE="${ROOT_DIR}/.env"

touch "${ENV_FILE}"

upsert_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    KEY_TO_SET="${key}" VALUE_TO_SET="${value}" ENV_TARGET="${ENV_FILE}" "${PYTHON_BIN}" - <<'PY'
import os
from pathlib import Path

path = Path(os.environ["ENV_TARGET"])
key = os.environ["KEY_TO_SET"]
value = os.environ["VALUE_TO_SET"]
lines = path.read_text().splitlines()
updated = False
out = []
for line in lines:
    if line.startswith(f"{key}="):
        out.append(f"{key}={value}")
        updated = True
    else:
        out.append(line)
if not updated:
    out.append(f"{key}={value}")
path.write_text("\n".join(out) + "\n")
PY
  else
    echo "${key}=${value}" >> "${ENV_FILE}"
  fi
}

upsert_env_var "BUILD_SHA" "${BUILD_SHA}"
upsert_env_var "BUILD_NUMBER" "${BUILD_NUMBER}"
upsert_env_var "BUILD_TIME" "${BUILD_TIME}"

export BUILD_SHA BUILD_NUMBER BUILD_TIME
echo "Build-Metadaten gesetzt: sha=${BUILD_SHA}, number=${BUILD_NUMBER}, time=${BUILD_TIME}"

DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose build "$@"
