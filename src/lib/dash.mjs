export const DASH_PREFIX = 'd/';
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DASHBOARD_PATTERN = /^[a-z0-9-]{1,40}$/;
export const STORY_ID_PATTERN = /^[0-9a-f]{16}$/;
export const VERDICTS = new Set(['accept', 'reject']);

export const DASHBOARDS = {
  'ai-movers': {
    id: 'ai-movers',
    title: 'AI Movers',
    blurb: 'Morning research review. Accept or reject each story.',
  },
};

export function isUtcDate(value) {
  return DATE_PATTERN.test(value);
}

export function isDashboardId(value) {
  return DASHBOARD_PATTERN.test(value) && Object.hasOwn(DASHBOARDS, value);
}

export function catalogKey(dashboardId, date) {
  return `${DASH_PREFIX}${dashboardId}/${date}/catalog.json`;
}

export function decisionsKey(dashboardId, date) {
  return `${DASH_PREFIX}${dashboardId}/${date}/decisions.json`;
}

export function emptyDecisionFile(date) {
  return { date, updatedAt: new Date(0).toISOString(), decisions: {} };
}

export function accessEmail(request) {
  const email = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
  return email.includes('@') ? email : '';
}

export function parseStoryId(value) {
  const id = String(value || '').trim().toLowerCase();
  return STORY_ID_PATTERN.test(id) ? id : null;
}

export function parseVerdict(value) {
  const verdict = String(value || '').trim().toLowerCase();
  return VERDICTS.has(verdict) ? verdict : null;
}

export function parseDecisionWrite(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Body must be a JSON object' };
  }
  const storyId = parseStoryId(body.storyId);
  const verdict = parseVerdict(body.verdict);
  if (!storyId) return { error: 'storyId must be a 16-char hex id' };
  if (!verdict) return { error: 'verdict must be accept or reject' };
  return { write: { storyId, verdict } };
}

export function parseDayCatalog(raw, date) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Catalog must be a JSON object' };
  }
  if (raw.date !== date) return { error: 'Catalog date must match the URL date' };
  if (!Array.isArray(raw.stories)) return { error: 'Catalog stories must be an array' };
  if (raw.stories.length > 100) return { error: 'Catalog may list at most 100 stories' };
  const stories = [];
  const seen = new Set();
  for (const [index, row] of raw.stories.entries()) {
    if (!row || typeof row !== 'object') return { error: `Story ${index} must be an object` };
    const id = parseStoryId(row.id);
    if (!id) return { error: `Story ${index} needs a 16-char hex id` };
    if (seen.has(id)) return { error: `Duplicate story id ${id}` };
    seen.add(id);
    const title = String(row.title || '').trim();
    if (!title) return { error: `Story ${index} needs a title` };
    const urls = Array.isArray(row.urls) ? row.urls.map(String).filter(Boolean) : [];
    stories.push({
      id,
      rank: Number.isFinite(row.rank) ? Number(row.rank) : index + 1,
      beat: String(row.beat || '').trim(),
      title,
      entity: String(row.entity || '').trim(),
      urls,
      score: Number.isFinite(row.score) ? Number(row.score) : 0,
      firstSeen: String(row.firstSeen || '').trim(),
    });
  }
  return {
    catalog: {
      date,
      generatedAt: String(raw.generatedAt || new Date().toISOString()),
      storyCount: stories.length,
      stories,
    },
  };
}

export function parseDecisionFile(raw, date) {
  if (raw == null) return { file: emptyDecisionFile(date) };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Decisions must be a JSON object' };
  }
  const decisions = {};
  const source = raw.decisions && typeof raw.decisions === 'object' && !Array.isArray(raw.decisions)
    ? raw.decisions
    : {};
  for (const [key, row] of Object.entries(source)) {
    const storyId = parseStoryId(key) || parseStoryId(row?.storyId);
    const verdict = parseVerdict(row?.verdict);
    if (!storyId || !verdict) continue;
    decisions[storyId] = {
      storyId,
      verdict,
      at: String(row.at || ''),
      by: String(row.by || ''),
    };
  }
  return {
    file: {
      date,
      updatedAt: String(raw.updatedAt || new Date(0).toISOString()),
      decisions,
    },
  };
}

export function mergeDecision(file, write, by, at = new Date().toISOString()) {
  const current = file.decisions[write.storyId];
  if (current && current.verdict === write.verdict) {
    return { file, changed: false };
  }
  return {
    changed: true,
    file: {
      date: file.date,
      updatedAt: at,
      decisions: {
        ...file.decisions,
        [write.storyId]: {
          storyId: write.storyId,
          verdict: write.verdict,
          at,
          by,
        },
      },
    },
  };
}

export function reviewRows(catalog, file) {
  return catalog.stories.map(story => ({
    story,
    decision: file.decisions[story.id] || null,
  }));
}

export async function readJson(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  const text = await new Response(object.body).text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'Stored JSON is invalid' };
  }
}

export async function writeJson(bucket, key, value) {
  await bucket.put(key, `${JSON.stringify(value)}\n`, {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function listDashboardDates(bucket, dashboardId) {
  const prefix = `${DASH_PREFIX}${dashboardId}/`;
  const dates = new Set();
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    for (const object of page.objects) {
      const match = object.key.match(new RegExp(`^${prefix}(\\d{4}-\\d{2}-\\d{2})/catalog\\.json$`));
      if (match) dates.add(match[1]);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return [...dates].sort((a, b) => b.localeCompare(a));
}

export async function putCatalog(bucket, request, dashboardId, date, shareToken) {
  if (!shareToken || request.headers.get('Authorization') !== `Bearer ${shareToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDashboardId(dashboardId) || !isUtcDate(date)) {
    return Response.json({ error: 'Invalid dashboard or date' }, { status: 400 });
  }
  let raw;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const { catalog, error } = parseDayCatalog(raw, date);
  if (error) return Response.json({ error }, { status: 400 });
  await writeJson(bucket, catalogKey(dashboardId, date), catalog);
  return Response.json({
    url: `https://yeoux.net/dash/${dashboardId}/${date}`,
    storyCount: catalog.storyCount,
  });
}

export async function getCatalog(bucket, dashboardId, date) {
  if (!isDashboardId(dashboardId) || !isUtcDate(date)) {
    return Response.json({ error: 'Invalid dashboard or date' }, { status: 400 });
  }
  const raw = await readJson(bucket, catalogKey(dashboardId, date));
  if (raw == null) return Response.json({ error: 'Not found' }, { status: 404 });
  if (raw.error) return Response.json({ error: raw.error }, { status: 500 });
  const { catalog, error } = parseDayCatalog(raw, date);
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(catalog, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function getDecisions(bucket, dashboardId, date) {
  if (!isDashboardId(dashboardId) || !isUtcDate(date)) {
    return Response.json({ error: 'Invalid dashboard or date' }, { status: 400 });
  }
  const raw = await readJson(bucket, decisionsKey(dashboardId, date));
  if (raw && raw.error) return Response.json({ error: raw.error }, { status: 500 });
  const { file, error } = parseDecisionFile(raw, date);
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(file, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function postDecision(bucket, request, dashboardId, date) {
  if (!isDashboardId(dashboardId) || !isUtcDate(date)) {
    return Response.json({ error: 'Invalid dashboard or date' }, { status: 400 });
  }
  const by = accessEmail(request);
  if (!by) return Response.json({ error: 'Access identity required' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body must be JSON' }, { status: 400 });
  }
  const { write, error: writeError } = parseDecisionWrite(body);
  if (writeError) return Response.json({ error: writeError }, { status: 400 });
  const raw = await readJson(bucket, decisionsKey(dashboardId, date));
  if (raw && raw.error) return Response.json({ error: raw.error }, { status: 500 });
  const { file: current, error } = parseDecisionFile(raw, date);
  if (error) return Response.json({ error }, { status: 500 });
  const { file, changed } = mergeDecision(current, write, by);
  if (changed) await writeJson(bucket, decisionsKey(dashboardId, date), file);
  return Response.json({ changed, file });
}
