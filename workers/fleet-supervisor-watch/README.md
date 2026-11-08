# fleet-supervisor-watch

Outside dead-man switch for the VPS supervisor (HYCI-189). POST `/heartbeat?id=production|drill` with `Authorization: Bearer <token>`. Cron every 5 minutes; 15 minutes silence posts to Slack #fleet and emails Valentin.

Deploy (after merge):

```bash
cd workers/fleet-supervisor-watch
npm ci
npx wrangler kv namespace create FLEET_SUPERVISOR_KV
# put the returned id into wrangler.toml
yeo-key --env 'Hetzner Wrangler All Access' -- npx wrangler secret put HEARTBEAT_TOKEN
yeo-key --env 'Hetzner Wrangler All Access' -- npx wrangler secret put SLACK_BOT_TOKEN
yeo-key --env 'Hetzner Wrangler All Access' -- npx wrangler deploy
```

Store the same heartbeat token in 1Password item `Fleet Supervisor Heartbeat` field `HEARTBEAT_TOKEN` for the VPS client. Until that item exists, keep it in `~/.local/state/fleet-watch/heartbeat.token` (mode 600).

The public endpoint is the worker's `workers.dev` URL (yeoux.net is behind Zero Trust).
