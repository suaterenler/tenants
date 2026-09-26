#!/bin/sh
set -eu

cd "$(dirname "$0")"

before=$(docker image inspect --format '{{.Id}}' "${APP_IMAGE:-ghcr.io/suaterenler/tenants:latest}" 2>/dev/null || true)
docker compose pull -q app
after=$(docker image inspect --format '{{.Id}}' "${APP_IMAGE:-ghcr.io/suaterenler/tenants:latest}")

if [ "$before" != "$after" ] || [ "${1:-}" = "--force" ]; then
  echo "$(date '+%F %T') yeni imaj: $after"
  docker compose up -d
  docker image prune -f >/dev/null
fi
