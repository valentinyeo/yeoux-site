#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOKEN = 'local-verifier-token';
export const DAY = '2026-02-03';
export const ACCESS_EMAIL = 'verifier@example.invalid';

const page = (heading, line) => `<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1><p>${line}</p></body></html>`;

export const ITEMS = [
  { section: 'reports', slug: 'aa11bb22-quarterly-tiles.html', title: 'Quarterly tiles', project: 'sample-app', date: '2026-02-01' },
  { section: 'reports', slug: '99887766-ci-performance-sample.html', title: 'CI performance sample', project: 'sample-app', date: '2026-01-29' },
  { section: 'reports', slug: 'cc33dd44-shipping-notes.html', title: 'Shipping notes', project: 'sample-app', date: '2026-01-28' },
  { section: 'reports', slug: 'ee55ff66-heavy-week.html', title: 'Heavy week', project: 'sample-app', date: '2026-01-20' },
  { section: 'explorations', slug: '11223344-route-study.html', title: 'Route study', project: 'sample-app', date: '2026-01-30' },
  { section: 'explorations', slug: '55667788-label-test.html', title: 'Label test', project: 'sample-app', date: '2026-01-15' },
];

const ROWS = [
  ['Toolkit ships regional preview', 'launch', ['https://news.ycombinator.com/item?id=1'], [{ source: 'hn', metric: 'points', value: 412 }]],
  ['Notes app adds offline drafts', 'launch', ['https://github.com/sample-notes/app'], [{ source: 'github', metric: 'stars', value: 1820 }]],
  ['Design system drops the sidebar', 'change', ['https://www.reddit.com/r/design/comments/2'], [{ source: 'reddit' }]],
  ['Compiler team speeds up builds', 'release', ['https://www.youtube.com/watch?v=3'], [{ source: 'youtube' }]],
  ['Newsletter passes ten thousand readers', 'story', ['https://example.com/letters'], [{ source: 'press' }]],
  ['Router makers ship a new module', 'launch', ['https://example.com/router'], [{ source: 'company' }]],
  ['Benchmark board adds a latency chart', 'change', ['https://example.com/bench'], [{ source: 'github', metric: 'forks', value: 94 }]],
  ['Chat app folds threads into channels', 'change', ['https://x.com/sample/status/8'], [{ source: 'x' }]],
  ['Model card lists a longer context', 'release', ['https://huggingface.co/sample/model'], [{ source: 'huggingface', metric: 'downloads', value: 52000 }]],
  ['Docs site gains a search box', 'story', ['https://example.com/docs'], [{ source: 'press' }]],
  ['Editor adds a rewrite panel', 'launch', ['https://example.com/editor'], [{ source: 'producthunt' }]],
  ['Registry trims install time', 'change', ['https://example.com/registry'], [{ source: 'company' }]],
  ['Map tool exports a route file', 'launch', ['https://example.com/maps'], [{ source: 'press' }]],
  ['Scheduler retries failed jobs', 'change', ['https://github.com/sample/scheduler'], [{ source: 'github', metric: 'stars', value: 640 }]],
  ['Camera app adds a wide frame', 'release', ['https://example.com/camera'], [{ source: 'youtube' }]],
  ['Paper explains a smaller cache', 'story', ['https://arxiv.org/abs/0000.00001'], [{ source: 'arxiv' }]],
  ['Calendar view gains a week grid', 'change', ['https://example.com/calendar'], [{ source: 'press' }]],
  ['Search index rebuilds faster', 'change', ['https://example.com/search'], [{ source: 'company' }]],
  ['Board game site opens a lobby', 'launch', ['https://example.com/lobby'], [{ source: 'reddit' }]],
  ['Audio tool ships a stem splitter', 'launch', ['https://example.com/audio'], [{ source: 'producthunt' }]],
  ['Reserve twenty-one', 'story', ['https://example.com/reserve-21'], [{ source: 'press' }]],
  ['Reserve twenty-two', 'story', ['https://example.com/reserve-22'], [{ source: 'press' }]],
  ['Reserve twenty-three', 'story', ['https://example.com/reserve-23'], [{ source: 'press' }]],
];

export function storyId(index) {
  return String(index + 1).padStart(16, '0');
}

export function storyRows(count = 23) {
  return ROWS.slice(0, count).map(([title, beat, urls, signals], index) => ({
    id: storyId(index),
    title,
    beat,
    urls,
    signals,
    rank: index + 1,
    firstSeen: '2026-02-03T06:00:00Z',
    ...(index === 19 ? { covered: { date: '2026-01-27', video: 'https://example.com/replay/1' } } : {}),
  }));
}

export function dayCatalog() {
  const rows = storyRows();
  return {
    date: DAY,
    generatedAt: '2026-02-03T06:00:00Z',
    targetAccept: 15,
    stories: rows.slice(0, 20),
    reserves: rows.slice(20),
  };
}

async function put(fetchImpl, port, url, options) {
  const response = await fetchImpl(`http://localhost:${port}${url}`, options);
  if (!response.ok) throw new Error(`seed ${options.method} ${url} returned ${response.status}`);
  await response.body?.cancel();
}

export async function seed(port, fetchImpl = fetch) {
  for (const item of ITEMS) {
    await put(fetchImpl, port, `/${item.section}/${item.slug}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'text/html; charset=utf-8',
        'X-Title': item.title,
        'X-Project': item.project,
        'X-Date': item.date,
      },
      body: page(item.title, 'Invented sample content for the local verifier.'),
    });
  }
  await put(fetchImpl, port, `/dash/ai-movers/${DAY}/catalog`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dayCatalog()),
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--token') {
    console.log(TOKEN);
  } else {
    try {
      await seed(Number(arg));
      console.log(`seeded http://localhost:${arg}`);
    } catch (error) {
      console.error(`seed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
