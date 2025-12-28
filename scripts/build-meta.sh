#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

HAS_GIT=1
if ! command -v git >/dev/null 2>&1 || ! git rev-parse --git-dir >/dev/null 2>&1; then
  HAS_GIT=0
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

resolve_build_value() {
  local current="$1"
  local git_cmd="$2"
  local fallback="$3"
  if [ -n "${current:-}" ]; then
    echo "${current}"
    return
  fi
  if [ "${HAS_GIT}" -eq 1 ]; then
    if value="$(${git_cmd})"; then
      echo "${value}"
      return
    fi
  fi
  echo "${fallback}"
}

BUILD_SHA="$(resolve_build_value "${BUILD_SHA:-}" "git rev-parse --short HEAD" "unknown")"
BUILD_NUMBER="$(resolve_build_value "${BUILD_NUMBER:-}" "git rev-list --count HEAD" "0")"
BUILD_TIME="$(resolve_build_value "${BUILD_TIME:-}" "git show -s --format=%cI HEAD" "$(date -u +"%Y-%m-%dT%H:%M:%SZ")")"
ENV_FILE="${ROOT_DIR}/.env"

touch "${ENV_FILE}"

upsert_env_var() {
  local key="$1"
  local value="$2"
  local current
  current="$(grep -m1 "^${key}=" "${ENV_FILE}" || true)"
  if [ "${current}" = "${key}=${value}" ]; then
    return
  fi
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

if [ "${SKIP_DOCKER_COMPOSE:-0}" = "1" ]; then
  echo "Docker Compose Build übersprungen (SKIP_DOCKER_COMPOSE=1)."
  exit 0
fi

DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose build "$@"
