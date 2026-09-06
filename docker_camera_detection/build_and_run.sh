#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

command -v docker >/dev/null 2>&1 || {
  echo "Docker is required. Install Docker Engine or Docker Desktop first." >&2
  exit 1
}

cd "$SCRIPT_DIR"
docker compose up --build --detach --remove-orphans
docker compose ps
