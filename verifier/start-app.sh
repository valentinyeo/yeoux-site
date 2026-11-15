#!/usr/bin/env bash
set -euo pipefail

dir=$1
port=$2
here=$(cd "$(dirname "$0")" && pwd)

mkdir -p "$dir/.wrangler"
pidfile="$dir/.wrangler/pstack-app.pid"
logfile="$dir/.wrangler/pstack-app.log"
: > "$logfile"

show_log() {
  node "$here/failure-log.mjs" "$logfile" 20 >&2 2>/dev/null || tail -20 "$logfile" >&2 || true
}

fail() {
  echo "start-app: $*" >&2
  show_log
  exit 1
}

[ -d "$dir" ] || fail "$dir is not a directory this run can use"

if [ -f "$pidfile" ]; then
  kill -- "-$(cat "$pidfile")" 2>/dev/null || true
  sleep 1
fi

printf 'SHARE_TOKEN=%s\n' "$(node "$here/seed.mjs" --token)" > "$dir/.dev.vars"
rm -rf "$dir/.wrangler/state/v3/r2"

if [ ! -d "$dir/node_modules" ]; then
  ( cd "$dir" && npm ci --no-audit --no-fund ) >> "$logfile" 2>&1 || fail "npm ci did not finish in $dir, so the app has no dependencies"
fi

cd "$dir" || fail "$dir cannot be entered"

ASTRO_DEV_BACKGROUND=1 setsid nohup npx astro dev --port "$port" --ignore-lock >> "$logfile" 2>&1 &
signal_pid=$!
echo "$signal_pid" > "$pidfile"

code=000
for ((attempt = 0; attempt < 150; attempt++)); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$port/" || true)
  if [ "$code" = "200" ]; then break; fi
  sleep 1
done

if [ "$code" != "200" ]; then
  kill -- "-$signal_pid" 2>/dev/null || true
  fail "$dir did not answer on port $port"
fi

node "$here/seed.mjs" "$port" >> "$logfile" 2>&1 || fail "$dir answered but the seed content could not be written"

echo "http://localhost:$port"
