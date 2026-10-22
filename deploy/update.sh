#!/bin/sh
set -eu
cd "$(dirname "$0")"

exec 9>.update.lock
flock -n 9 || exit 0

[ -s active-port ] || echo 3061 > active-port
active=$(cat active-port)
if [ "$active" = "3062" ]; then
  idle=3061; cur=green; next=blue
else
  active=3061; idle=3062; cur=blue; next=green
fi

ids() {
  docker compose config --images | while read -r image; do docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || echo "yok:$image"; done | sort | tr '\n' ' '
}

before=$(ids)
docker compose pull -q --ignore-pull-failures
after=$(ids)
if [ "$before" != "$after" ] || [ "${1:-}" = "--force" ]; then touch .pending; fi
[ -f .pending ] || exit 0

docker compose up -d db gate >/dev/null

if [ "${1:-}" != "--force" ]; then
  secret=$(grep -E '^TENANTS_SECRET=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [ -n "$secret" ]; then
    activity=$(curl -s -m 5 -H "Authorization: Bearer $secret" "http://127.0.0.1:$active/admin/api/live/activity" || true)
    case "$activity" in
      *'"rooms":0,"waiting":0'*) ;;
      *'"rooms":'*)
        echo "$(date '+%F %T') ertelendi: aktif gorusme var $activity"
        exit 0
        ;;
    esac
  fi
fi

echo "$(date '+%F %T') guncelleme: $cur -> $next ($after)"
docker compose up -d --no-deps --force-recreate "app-$next"
tries=0
until curl -fs -o /dev/null -m 5 "http://127.0.0.1:$idle/admin"; do
  tries=$((tries + 1))
  if [ "$tries" -ge 60 ]; then
    echo "$(date '+%F %T') yeni surum acilmadi, $cur devam ediyor"
    docker compose stop "app-$next" >/dev/null
    exit 1
  fi
  sleep 2
done

echo "$idle" > active-port
sleep 15
docker compose stop "app-$cur" >/dev/null
docker compose up -d --no-deps edge >/dev/null
rm -f .pending
docker image prune -f >/dev/null
echo "$(date '+%F %T') tamam: aktif $next ($idle)"
