#!/usr/bin/env bash
set -euo pipefail

dir=$1
port=$2
here=$(cd "$(dirname "$0")" && pwd)

if [ ! -d "$dir/node_modules" ]; then
  ( cd "$dir" && npm ci --no-audit --no-fund )
fi

mkdir -p "$dir/.wrangler"
pidfile="$dir/.wrangler/pstack-app.pid"
logfile="$dir/.wrangler/pstack-app.log"

if [ -f "$pidfile" ]; then
  kill -- "-$(cat "$pidfile")" 2>/dev/null || true
  sleep 1
fi

printf 'SHARE_TOKEN=%s\n' "$(node "$here/seed.mjs" --token)" > "$dir/.dev.vars"
rm -rf "$dir/.wrangler/state/v3/r2"

cd "$dir"
ASTRO_DEV_BACKGROUND=1 setsid nohup npx astro dev --port "$port" --ignore-lock > "$logfile" 2>&1 &
signal_pid=$!
echo "$signal_pid" > "$pidfile"

code=000
for _ in $(seq 1 150); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/" || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

if [ "$code" != "200" ]; then
  echo "start-app: $dir did not answer on port $port" >&2
  tail -40 "$logfile" >&2 || true
  kill -- "-$signal_pid" 2>/dev/null || true
  exit 1
fi

node "$here/seed.mjs" "$port" > /dev/null
echo "http://localhost:$port"
