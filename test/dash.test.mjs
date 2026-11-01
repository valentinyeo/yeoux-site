import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accessEmail,
  catalogKey,
  decisionsKey,
  emptyDecisionFile,
  getCatalog,
  listDashboardDates,
  mergeDecision,
  parseDayCatalog,
  parseDecisionFile,
  parseDecisionWrite,
  postDecision,
  putCatalog,
  reviewRows,
} from '../src/lib/dash.mjs';

function memoryBucket() {
  const store = new Map();
  return {
    store,
    async put(key, body) {
      store.set(key, { body: await new Response(body).text() });
    },
    async get(key) {
      const object = store.get(key);
      return object ? { body: object.body } : null;
    },
    async list({ prefix }) {
      return {
        objects: [...store.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })),
        truncated: false,
      };
    },
  };
}

const sampleCatalog = {
  date: '2026-11-01',
  generatedAt: '2026-11-01T12:00:00.000Z',
  stories: [
    {
      id: 'aaaaaaaaaaaaaaaa',
      rank: 1,
      beat: 'repo',
      title: 'Example repo',
      entity: 'repo:example/one',
      urls: ['https://github.com/example/one'],
      score: 12,
      firstSeen: '2026-11-01T01:00:00.000Z',
    },
    {
      id: 'bbbbbbbbbbbbbbbb',
      rank: 2,
      beat: 'model',
      title: 'Example model',
      entity: 'model:example/two',
      urls: ['https://huggingface.co/example/two'],
      score: 9,
      firstSeen: '2026-11-01T02:00:00.000Z',
    },
  ],
};

test('dash keys stay under the dash prefix', () => {
  assert.equal(catalogKey('ai-movers', '2026-11-01'), 'd/ai-movers/2026-11-01/catalog.json');
  assert.equal(decisionsKey('ai-movers', '2026-11-01'), 'd/ai-movers/2026-11-01/decisions.json');
});

test('catalog parse keeps at most 100 stories and brands ids', () => {
  const { catalog, error } = parseDayCatalog(sampleCatalog, '2026-11-01');
  assert.equal(error, undefined);
  assert.equal(catalog.storyCount, 2);
  assert.equal(catalog.stories[0].id, 'aaaaaaaaaaaaaaaa');
  assert.ok(parseDayCatalog({ ...sampleCatalog, date: '2026-10-31' }, '2026-11-01').error);
  assert.ok(parseDayCatalog({ ...sampleCatalog, stories: Array(101).fill(sampleCatalog.stories[0]) }, '2026-11-01').error);
});

test('decision write validates story id and verdict', () => {
  assert.deepEqual(parseDecisionWrite({ storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }).write, {
    storyId: 'aaaaaaaaaaaaaaaa',
    verdict: 'accept',
  });
  assert.ok(parseDecisionWrite({ storyId: 'short', verdict: 'accept' }).error);
  assert.ok(parseDecisionWrite({ storyId: 'aaaaaaaaaaaaaaaa', verdict: 'maybe' }).error);
});

test('mergeDecision is idempotent for the same verdict', () => {
  const base = emptyDecisionFile('2026-11-01');
  const first = mergeDecision(base, { storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }, 'valentin@example.com', '2026-11-01T13:00:00.000Z');
  assert.equal(first.changed, true);
  const again = mergeDecision(first.file, { storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }, 'valentin@example.com', '2026-11-01T14:00:00.000Z');
  assert.equal(again.changed, false);
  assert.equal(again.file.decisions.aaaaaaaaaaaaaaaa.at, '2026-11-01T13:00:00.000Z');
  const flip = mergeDecision(first.file, { storyId: 'aaaaaaaaaaaaaaaa', verdict: 'reject' }, 'valentin@example.com', '2026-11-01T15:00:00.000Z');
  assert.equal(flip.changed, true);
  assert.equal(flip.file.decisions.aaaaaaaaaaaaaaaa.verdict, 'reject');
});

test('reviewRows treat missing decisions as pending', () => {
  const { catalog } = parseDayCatalog(sampleCatalog, '2026-11-01');
  const { file } = parseDecisionFile({
    date: '2026-11-01',
    decisions: {
      aaaaaaaaaaaaaaaa: { storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept', at: 't', by: 'a@b.c' },
    },
  }, '2026-11-01');
  const rows = reviewRows(catalog, file);
  assert.equal(rows[0].decision.verdict, 'accept');
  assert.equal(rows[1].decision, null);
});

test('Access email comes only from the Access header', () => {
  assert.equal(accessEmail(new Request('https://yeoux.net/', { headers: { 'Cf-Access-Authenticated-User-Email': 'Valentin@Example.com' } })), 'valentin@example.com');
  assert.equal(accessEmail(new Request('https://yeoux.net/')), '');
});

test('catalog PUT needs the share token and lands in R2', async () => {
  const bucket = memoryBucket();
  const put = headers => new Request('https://yeoux.net/dash/ai-movers/2026-11-01/catalog', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(sampleCatalog),
  });
  assert.equal((await putCatalog(bucket, put({}), 'ai-movers', '2026-11-01', 'secret')).status, 401);
  const ok = await putCatalog(bucket, put({ Authorization: 'Bearer secret' }), 'ai-movers', '2026-11-01', 'secret');
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { url: 'https://yeoux.net/dash/ai-movers/2026-11-01', storyCount: 2 });
  const got = await getCatalog(bucket, 'ai-movers', '2026-11-01');
  assert.equal(got.status, 200);
  assert.equal((await got.json()).storyCount, 2);
  assert.deepEqual(await listDashboardDates(bucket, 'ai-movers'), ['2026-11-01']);
});

test('decision POST needs Access identity and survives reload', async () => {
  const bucket = memoryBucket();
  await putCatalog(
    bucket,
    new Request('https://yeoux.net/dash/ai-movers/2026-11-01/catalog', {
      method: 'PUT',
      headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleCatalog),
    }),
    'ai-movers',
    '2026-11-01',
    'secret',
  );
  const bare = await postDecision(
    bucket,
    new Request('https://yeoux.net/dash/ai-movers/2026-11-01/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }),
    }),
    'ai-movers',
    '2026-11-01',
  );
  assert.equal(bare.status, 401);
  const ok = await postDecision(
    bucket,
    new Request('https://yeoux.net/dash/ai-movers/2026-11-01/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'valentin@example.com',
      },
      body: JSON.stringify({ storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }),
    }),
    'ai-movers',
    '2026-11-01',
  );
  assert.equal(ok.status, 200);
  const payload = await ok.json();
  assert.equal(payload.changed, true);
  assert.equal(payload.file.decisions.aaaaaaaaaaaaaaaa.verdict, 'accept');
  const again = await postDecision(
    bucket,
    new Request('https://yeoux.net/dash/ai-movers/2026-11-01/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cf-Access-Authenticated-User-Email': 'valentin@example.com',
      },
      body: JSON.stringify({ storyId: 'aaaaaaaaaaaaaaaa', verdict: 'accept' }),
    }),
    'ai-movers',
    '2026-11-01',
  );
  assert.equal((await again.json()).changed, false);
});
