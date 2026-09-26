#!/bin/sh
set -eu
cd "$(dirname "$0")"
ids() {
  docker compose config --images | while read -r image; do docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || echo "yok:$image"; done | sort | tr '\n' ' '
}
before=$(ids)
docker compose pull -q --ignore-pull-failures
after=$(ids)
if [ "$before" != "$after" ] || [ "${1:-}" = "--force" ]; then
  echo "$(date '+%F %T') guncelleme: $after"
  docker compose up -d
  docker image prune -f >/dev/null
fi
