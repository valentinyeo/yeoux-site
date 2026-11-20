export const DASH_PREFIX = 'd/';
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DASHBOARD_PATTERN = /^[a-z0-9-]{1,40}$/;
export const STORY_ID_PATTERN = /^[0-9a-f]{16}$/;
export const VERDICTS = new Set(['accept', 'reject', 'used']);
const HOOK_SKIP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'from', 'by', 'as', 'at', 'is', 'are', 'its', 'into', 'over', 'via']);
const SOURCE_NAMES = {
  github: 'GitHub',
  hn: 'Hacker News',
  reddit: 'Reddit',
  x: 'X',
  twitter: 'X',
  huggingface: 'Hugging Face',
  openrouter: 'OpenRouter',
  producthunt: 'Product Hunt',
  youtube: 'YouTube',
  company: 'Company',
  press: 'Press',
  web: 'Press',
  arxiv: 'arXiv',
  digg: 'Digg',
};
const METRIC_NAMES = {
  stars: 'stars',
  forks: 'forks',
  points: 'points',
  comments: 'comments',
  likes: 'likes',
  downloads: 'downloads',
  views: 'views',
};

export const TARGET_ACCEPT = 15;
export const SHOWN_COUNT = 20;

export const DASHBOARDS = {
  'ai-movers': {
    id: 'ai-movers',
    title: 'AI Movers',
    blurb: 'Twenty candidates. Keep fifteen for the video. Reject swaps in the next reserve. Drag sets script order.',
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
  return { date, updatedAt: new Date(0).toISOString(), order: [], decisions: {} };
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
  if (!storyId) return { error: 'storyId must be a 16-char hex id' };
  if (body.clear === true || body.verdict === null) {
    return { write: { storyId, verdict: null } };
  }
  const verdict = parseVerdict(body.verdict);
  if (!verdict) return { error: 'verdict must be accept, reject or used' };
  return { write: { storyId, verdict } };
}

export function cleanTitle(title) {
  return String(title || '')
    .replace(/\u2014/g, ', ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function leadPhrase(title) {
  let text = cleanTitle(title).replace(/[\[\]]/g, '');
  const github = text.match(/^[^/\s]+\/[^:\s]+:\s*(.+)$/);
  if (github) text = github[1].trim();
  const words = text.split(' ').filter(Boolean);
  return words.slice(0, 10).join(' ');
}

export function hookFromTitle(title) {
  const phrase = leadPhrase(title);
  if (!phrase) return '[STORY]';
  if (/\[[^\]]+\]/.test(phrase)) return phrase;
  const words = phrase.split(' ');
  let index = -1;
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const bare = words[i].replace(/[^A-Za-z0-9-]/g, '');
    if (bare.length >= 3 && !HOOK_SKIP.has(bare.toLowerCase())) {
      index = i;
      break;
    }
  }
  if (index < 0) index = words.length - 1;
  const target = words[index].replace(/[^A-Za-z0-9-]/g, '') || words[index];
  words[index] = words[index].replace(target, `[${target.toUpperCase()}]`);
  return words.join(' ');
}

export function labelFromBeat(beat) {
  const value = String(beat || '').trim().toUpperCase();
  return value || 'STORY';
}

export function sourceLabels(signals = [], urls = []) {
  const labels = [];
  const seen = new Set();
  for (const row of Array.isArray(signals) ? signals : []) {
    const [familyRaw, detailRaw = ''] = String(row?.source || '').split(':');
    const family = familyRaw.toLowerCase();
    const detail = detailRaw.trim();
    const label = family === 'company' && detail
      ? detail
      : (SOURCE_NAMES[family] || (family ? family : ''));
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  if (!labels.length) {
    for (const value of urls) {
      try {
        const host = new URL(value).hostname.replace(/^www\./, '');
        if (host.includes('reddit.com')) labels.push('Reddit');
        else if (host.includes('x.com') || host.includes('twitter.com')) labels.push('X');
        else if (host.includes('github.com')) labels.push('GitHub');
        else if (host.includes('youtube.com') || host.includes('youtu.be')) labels.push('YouTube');
        else if (host.includes('news.ycombinator')) labels.push('Hacker News');
        else if (host && !labels.includes('Press')) labels.push('Press');
      } catch {
        continue;
      }
    }
  }
  return [...new Set(labels)];
}

export function lookFromSignals(signals, urls = []) {
  const list = Array.isArray(signals) ? signals : [];
  const metric = list.find(row => METRIC_NAMES[row?.metric] && Number.isFinite(Number(row.value)));
  const sources = sourceLabels(list, urls);
  const sourceLine = sources.length ? `Found on ${sources.join(', ')}` : '';
  const host = (() => {
    try {
      return urls[0] ? new URL(urls[0]).hostname.replace(/^www\./, '') : '';
    } catch {
      return '';
    }
  })();
  if (metric) {
    const source = SOURCE_NAMES[String(metric.source || '').split(':')[0]] || String(metric.source || 'Source');
    const count = Number(metric.value).toLocaleString('en-US');
    const noun = METRIC_NAMES[metric.metric];
    const look = `Look at: ${count} ${source} ${noun}${host ? ` on ${host}` : ''}`;
    return sourceLine ? `${look}. ${sourceLine}` : look;
  }
  const fallback = host ? `Look at: open ${host} and check the claim` : 'Look at: open the source and check the claim';
  return sourceLine ? `${fallback}. ${sourceLine}` : fallback;
}

export function slimStory(row, index = 0) {
  const title = cleanTitle(row.title);
  const urls = Array.isArray(row.urls) ? row.urls.map(String).filter(Boolean) : [];
  const beat = String(row.beat || '').trim();
  const signals = Array.isArray(row.signals) ? row.signals : [];
  const sources = Array.isArray(row.sources) && row.sources.length
    ? row.sources.map(String)
    : sourceLabels(signals, urls);
  return {
    id: parseStoryId(row.id),
    rank: Number.isFinite(row.rank) ? Number(row.rank) : index + 1,
    beat,
    title,
    entity: String(row.entity || '').trim(),
    urls,
    score: Number.isFinite(row.score) ? Number(row.score) : 0,
    firstSeen: String(row.firstSeen || '').trim(),
    hook: cleanTitle(row.hook) || hookFromTitle(title),
    label: cleanTitle(row.label) || labelFromBeat(beat),
    look: cleanTitle(row.look) || lookFromSignals(signals, urls),
    sources,
    script: cleanTitle(row.script),
    ...(parseCovered(row.covered) ? { covered: parseCovered(row.covered) } : {}),
  };
}

export function parseCovered(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const date = String(raw.date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const video = /^https:\/\//.test(String(raw.video || '')) ? String(raw.video) : '';
  return { date, video, spin: raw.spin === true };
}

export const isDone = (story, decision = null) => Boolean((story.covered && !story.covered.spin) || decision?.verdict === 'used');

export function renderHookHtml(hook) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
  return escape(hook).replace(/\[([^\]]+)\]/g, '<mark class="dash-hook-mark">$1</mark>');
}

export function parseStoryList(rows, label) {
  if (!Array.isArray(rows)) return { error: `${label} must be an array` };
  const stories = [];
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row || typeof row !== 'object') return { error: `${label} ${index} must be an object` };
    const story = slimStory(row, index);
    if (!story.id) return { error: `${label} ${index} needs a 16-char hex id` };
    if (seen.has(story.id)) return { error: `Duplicate story id ${story.id}` };
    if (!story.title) return { error: `${label} ${index} needs a title` };
    seen.add(story.id);
    stories.push(story);
  }
  return { stories, seen };
}

export function parseDayCatalog(raw, date) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Catalog must be a JSON object' };
  }
  if (raw.date !== date) return { error: 'Catalog date must match the URL date' };
  const shown = parseStoryList(raw.stories, 'Story');
  if (shown.error) return { error: shown.error };
  if (shown.stories.length > 40) return { error: 'Catalog may list at most 40 shown stories' };
  const reserveRows = Array.isArray(raw.reserves) ? raw.reserves : [];
  const reserves = parseStoryList(reserveRows, 'Reserve');
  if (reserves.error) return { error: reserves.error };
  for (const story of reserves.stories) {
    if (shown.seen.has(story.id)) return { error: `Reserve duplicates shown story ${story.id}` };
  }
  const targetAccept = Number.isFinite(raw.targetAccept) ? Number(raw.targetAccept) : TARGET_ACCEPT;
  return {
    catalog: {
      date,
      generatedAt: String(raw.generatedAt || new Date().toISOString()),
      storyCount: shown.stories.length,
      targetAccept,
      stories: shown.stories,
      reserves: reserves.stories,
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
  const order = [];
  const seen = new Set();
  if (Array.isArray(raw.order)) {
    for (const value of raw.order) {
      const id = parseStoryId(value);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      order.push(id);
    }
  }
  return {
    file: {
      date,
      updatedAt: String(raw.updatedAt || new Date(0).toISOString()),
      order,
      decisions,
    },
  };
}

export function mergeDecision(file, write, by, at = new Date().toISOString()) {
  if (write.verdict == null) {
    if (!file.decisions[write.storyId]) return { file, changed: false };
    const decisions = { ...file.decisions };
    delete decisions[write.storyId];
    return {
      changed: true,
      file: { date: file.date, updatedAt: at, order: file.order || [], decisions },
    };
  }
  const current = file.decisions[write.storyId];
  if (current && current.verdict === write.verdict) {
    return { file, changed: false };
  }
  return {
    changed: true,
    file: {
      date: file.date,
      updatedAt: at,
      order: file.order || [],
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

export function allCatalogStories(catalog) {
  return [...(catalog.stories || []), ...(catalog.reserves || [])];
}

export function knownStoryIds(catalog) {
  return allCatalogStories(catalog).map(story => story.id);
}

export function setOrder(file, order, allowedIds, at = new Date().toISOString()) {
  const allowed = new Set(allowedIds);
  if (!order.length) return { error: 'Order must list at least one story' };
  const seen = new Set();
  for (const id of order) {
    if (!allowed.has(id) || seen.has(id)) {
      return { error: 'Order must list known stories once each' };
    }
    seen.add(id);
  }
  const same = file.order?.length === order.length && file.order.every((id, index) => id === order[index]);
  if (same) return { file, changed: false };
  return {
    changed: true,
    file: {
      date: file.date,
      updatedAt: at,
      order: [...order],
      decisions: file.decisions,
    },
  };
}

export function nextReserve(catalog, order, decisions) {
  const used = new Set(order);
  for (const story of catalog.reserves || []) {
    if (used.has(story.id)) continue;
    if (decisions[story.id]?.verdict === 'reject') continue;
    return story;
  }
  return null;
}

export function applyRejectSwap(file, catalog, storyId, at = new Date().toISOString()) {
  const order = [...(file.order?.length ? file.order : catalog.stories.map(story => story.id))];
  const index = order.indexOf(storyId);
  if (index < 0) {
    return { file, replacement: null, removed: null, orderChanged: false };
  }
  const replacement = nextReserve(catalog, order, file.decisions);
  const next = [...order];
  next.splice(index, 1);
  if (replacement) next.splice(index, 0, replacement.id);
  return {
    file: {
      date: file.date,
      updatedAt: at,
      order: next,
      decisions: file.decisions,
    },
    replacement,
    removed: storyId,
    orderChanged: true,
  };
}

export function reviewRows(catalog, file) {
  const byId = new Map(allCatalogStories(catalog).map(story => [story.id, story]));
  const ordered = [];
  const used = new Set();
  const seed = file.order?.length ? file.order : catalog.stories.map(story => story.id);
  for (const id of seed) {
    const story = byId.get(id);
    if (!story || used.has(id)) continue;
    if (file.decisions[id]?.verdict === 'reject') continue;
    used.add(id);
    ordered.push(story);
  }
  for (const story of catalog.stories) {
    if (used.has(story.id)) continue;
    if (file.decisions[story.id]?.verdict === 'reject') continue;
    used.add(story.id);
    ordered.push(story);
  }
  const done = story => Number(isDone(story, file.decisions[story.id]));
  ordered.sort((a, b) => done(a) - done(b));
  return ordered.map((story, index) => ({
    story,
    position: index + 1,
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
  if (raw.resetOrder === true) {
    const current = await readJson(bucket, decisionsKey(dashboardId, date));
    const { file } = parseDecisionFile(current && !current.error ? current : null, date);
    if (file?.order?.length) await writeJson(bucket, decisionsKey(dashboardId, date), { ...file, order: [] });
  }
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
  let { file, changed } = mergeDecision(current, write, by);
  let replacement = null;
  let removed = null;
  if (changed && write.verdict === 'reject') {
    const catalogRaw = await readJson(bucket, catalogKey(dashboardId, date));
    if (catalogRaw && !catalogRaw.error) {
      const { catalog } = parseDayCatalog(catalogRaw, date);
      if (catalog) {
        const swapped = applyRejectSwap(file, catalog, write.storyId, file.updatedAt);
        file = swapped.file;
        replacement = swapped.replacement;
        removed = swapped.removed;
        if (swapped.orderChanged) changed = true;
      }
    }
  }
  if (changed) await writeJson(bucket, decisionsKey(dashboardId, date), file);
  return Response.json({ changed, file, replacement, removed });
}

export async function putOrder(bucket, request, dashboardId, date) {
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
  if (!body || !Array.isArray(body.order)) {
    return Response.json({ error: 'Body must include an order array' }, { status: 400 });
  }
  const order = [];
  for (const value of body.order) {
    const id = parseStoryId(value);
    if (!id) return Response.json({ error: 'Order ids must be 16-char hex' }, { status: 400 });
    order.push(id);
  }
  const catalogRaw = await readJson(bucket, catalogKey(dashboardId, date));
  if (catalogRaw == null) return Response.json({ error: 'Catalog not found' }, { status: 404 });
  if (catalogRaw.error) return Response.json({ error: catalogRaw.error }, { status: 500 });
  const { catalog, error: catalogError } = parseDayCatalog(catalogRaw, date);
  if (catalogError) return Response.json({ error: catalogError }, { status: 500 });
  const raw = await readJson(bucket, decisionsKey(dashboardId, date));
  if (raw && raw.error) return Response.json({ error: raw.error }, { status: 500 });
  const { file: current, error } = parseDecisionFile(raw, date);
  if (error) return Response.json({ error }, { status: 500 });
  const result = setOrder(current, order, knownStoryIds(catalog));
  if (result.error) return Response.json({ error: result.error }, { status: 400 });
  if (result.changed) await writeJson(bucket, decisionsKey(dashboardId, date), result.file);
  return Response.json({ changed: result.changed, file: result.file });
}
