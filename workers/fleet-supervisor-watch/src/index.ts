export interface Env {
  FLEET_SUPERVISOR_KV: KVNamespace;
  HEARTBEAT_TOKEN: string;
  SLACK_BOT_TOKEN: string;
  SLACK_CHANNEL_ID: string;
  ALERT_EMAIL_TO: string;
}

const SILENCE_MS = 15 * 60 * 1000;
const IDS = ["production", "drill"];

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

async function postSlack(env: Env, text: string): Promise<void> {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: env.SLACK_CHANNEL_ID, text }),
  });
  if (!r.ok) throw new Error(`slack HTTP ${r.status}`);
  const body = (await r.json()) as { ok?: boolean };
  if (!body.ok) throw new Error("slack API refused");
}

async function postEmail(env: Env, subject: string, text: string): Promise<void> {
  if (!env.ALERT_EMAIL_TO) return;
  const r = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.ALERT_EMAIL_TO }] }],
      from: { email: "fleet@yeoux.net", name: "Fleet watch" },
      subject,
      content: [{ type: "text/plain", value: text }],
    }),
  });
  if (!r.ok) throw new Error(`mail HTTP ${r.status}`);
}

async function alarm(env: Env, id: string, silentMs: number): Promise<void> {
  const mins = Math.round(silentMs / 60000);
  const text = `Supervisor heartbeat ${id} silent ${mins} min. The VPS supervisor may be down. Undo: pause fleet-watch timer or fix the host.`;
  await postSlack(env, text);
  await postEmail(env, `Supervisor silent: ${id}`, text).catch(() => {});
}

async function recordHeartbeat(env: Env, id: string): Promise<void> {
  const now = Date.now();
  await env.FLEET_SUPERVISOR_KV.put(`hb:${id}`, String(now));
  await env.FLEET_SUPERVISOR_KV.delete(`alarm:${id}`);
}

async function checkSilence(env: Env): Promise<void> {
  const now = Date.now();
  for (const id of IDS) {
    const raw = await env.FLEET_SUPERVISOR_KV.get(`hb:${id}`);
    const last = raw ? Number(raw) : 0;
    if (!last || now - last < SILENCE_MS) continue;
    if (id === "drill" && (await env.FLEET_SUPERVISOR_KV.get(`alarm:${id}`))) {
      await env.FLEET_SUPERVISOR_KV.delete(`hb:${id}`);
      continue;
    }
    const alarmAt = await env.FLEET_SUPERVISOR_KV.get(`alarm:${id}`);
    if (alarmAt && now - Number(alarmAt) < 4 * SILENCE_MS) continue;
    await env.FLEET_SUPERVISOR_KV.put(`alarm:${id}`, String(now));
    await alarm(env, id, now - last);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/heartbeat") return new Response("not found", { status: 404 });
    if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
    const auth = request.headers.get("Authorization") ?? "";
    if (auth !== `Bearer ${env.HEARTBEAT_TOKEN}`) return unauthorized();
    const id = url.searchParams.get("id") || "production";
    if (!IDS.includes(id)) return new Response("bad id", { status: 400 });
    await recordHeartbeat(env, id);
    return new Response(null, { status: 204 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkSilence(env));
  },
};
