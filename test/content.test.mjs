import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteItem, getItem, indexItems, isValidSlug, legacyRedirect, legacySection, legacySlug, listAll, putItem, titleFromSlug, uploadMetadata } from '../src/lib/content.mjs';
import { themeArtifactHtml, withArtifactTheme } from '../src/lib/artifactTheme.mjs';

function memoryBucket() {
  const store = new Map();
  return {
    store,
    async put(key, body, options) { store.set(key, { body: await new Response(body).text(), ...options, uploaded: new Date() }); },
    async get(key) { const o = store.get(key); return o ? { body: o.body, size: Buffer.byteLength(o.body), httpMetadata: o.httpMetadata } : null; },
    async list({ prefix }) { return { objects: [...store.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, object]) => ({ key, ...object })), truncated: false }; },
    async head(key) { return store.has(key) ? {} : null; },
    async delete(key) { store.delete(key); },
  };
}

test('old yeoshare keys map to a valid, stable slug', () => {
  assert.equal(legacySlug('p/1a2b3c4d/plan.html'), '1a2b3c4d-plan.html');
  assert.equal(legacySlug('p/1a2b3c4d/My Plan (v2).html'), '1a2b3c4d-My-Plan-v2.html');
  const long = legacySlug(`p/1a2b3c4d/${'x'.repeat(300)}.html`);
  assert.ok(isValidSlug(long) && long.endsWith('.html'), long);
  assert.equal(legacySlug('other/key.html'), null);
  for (const name of ['a b.png', 'ünïcode.pdf', '...', 'x.tar.gz']) assert.ok(isValidSlug(legacySlug(`p/00000000/${name}`)), name);
});

test('report-like names go to reports, the rest to explorations', () => {
  assert.equal(legacySection('p/1a2b3c4d/weekly-report.html'), 'reports');
  assert.equal(legacySection('p/1a2b3c4d/bookmark-cheatsheet.html'), 'explorations');
});

test('titles fall back to a readable file name', () => {
  assert.equal(titleFromSlug('1a2b3c4d-token-ladder_plan.html'), 'Token ladder plan');
});

test('upload metadata takes type, project and date, and rejects bad values', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  assert.deepEqual(uploadMetadata(new Headers({ 'X-Project': 'chromescribe', 'X-Title': 'Plan' }), now).metadata, { date: '2026-10-17', title: 'Plan', project: 'chromescribe' });
  assert.ok(uploadMetadata(new Headers({ 'X-Date': '17/10/2026' }), now).error);
  assert.ok(uploadMetadata(new Headers({ 'X-Project': 'Has Spaces' }), now).error);
});

test('index lists newest first by date, then upload time', () => {
  const items = indexItems([
    { key: 'x/a.html', uploaded: new Date('2026-10-01T00:00:00Z'), customMetadata: { date: '2026-09-01' } },
    { key: 'x/b.html', uploaded: new Date('2026-10-02T00:00:00Z'), customMetadata: { date: '2026-10-17', title: 'B' } },
    { key: 'x/c.html', uploaded: new Date('2026-10-03T00:00:00Z'), customMetadata: { date: '2026-10-17' } },
  ], 'x/');
  assert.deepEqual(items.map(item => item.slug), ['c.html', 'b.html', 'a.html']);
  assert.equal(items[1].title, 'B');
});

test('uploads need the share token, land in their section and come back', async () => {
  const bucket = memoryBucket();
  const put = headers => new Request('https://yeoux.net/reports/r.html', { method: 'PUT', headers, body: '<p>hi</p>' });
  assert.equal((await putItem(bucket, put({}), 'reports', 'r.html', 'secret')).status, 401);
  assert.equal((await putItem(bucket, put({ Authorization: 'Bearer x' }), 'reports', 'r.html', '')).status, 401);
  const ok = await putItem(bucket, put({ Authorization: 'Bearer secret', 'X-Project': 'pecunia' }), 'reports', 'r.html', 'secret');
  assert.deepEqual(await ok.json(), { url: 'https://yeoux.net/reports/r.html' });
  assert.equal(bucket.store.get('r/r.html').customMetadata.project, 'pecunia');
  const got = await getItem(bucket, 'reports', 'r.html');
  assert.equal(got.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(got.headers.get('Content-Length'), '9');
  assert.equal(await got.text(), '<p>hi</p>');
  assert.equal((await getItem(bucket, 'explorations', 'r.html')).status, 404);
});

test('old admin URLs redirect to wherever the item moved', async () => {
  const bucket = memoryBucket();
  await bucket.put('x/1a2b3c4d-weekly-report.html', 'x', {});
  assert.equal(await legacyRedirect(bucket, '/p/1a2b3c4d/weekly-report.html'), 'https://yeoux.net/explorations/1a2b3c4d-weekly-report.html');
  await bucket.put('r/1a2b3c4d-My-Plan.html', 'x', {});
  assert.equal(await legacyRedirect(bucket, '/p/1a2b3c4d/My%20Plan.html'), 'https://yeoux.net/reports/1a2b3c4d-My-Plan.html');
  assert.equal(await legacyRedirect(bucket, '/p/1a2b3c4d/missing.html'), null);
  assert.equal(await legacyRedirect(bucket, '/favicon.ico'), null);
});

test('hosted HTML pages get the Yeo UX top bar', () => {
  const html = themeArtifactHtml('<!doctype html><html><head><meta charset="utf-8"></head><body><p>x</p></body></html>', '/reports');
  assert.match(html, /data-site-nav/);
  assert.match(html, /<a class="ht-brand" href="\/reports\/c65b9a8c-productivity.html">Factory performance</);
  assert.doesNotMatch(html, />Yeo UX</);
  assert.match(html, /href="\/reports" aria-current="page"/);
});

test('large HTML streams through the native rewriter without buffering a DOM', async () => {
  const response = new Response('<html><head></head><body>large</body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(12 * 1024 * 1024) } });
  response.arrayBuffer = () => { throw new Error('large HTML must not be buffered'); };
  const handlers = new Map();
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = class {
    on(selector, handler) { handlers.set(selector, handler); return this; }
    transform(input) { assert.equal(input, response); return input; }
  };
  try {
    assert.equal(await withArtifactTheme(response, '/reports'), response);
    const attrs = new Map();
    handlers.get('html').element({ hasAttribute: name => attrs.has(name), setAttribute: (name, value) => attrs.set(name, value) });
    assert.ok(attrs.has('data-ht-artifact'));
    let head;
    handlers.get('head').element({ onEndTag: callback => callback({ before: html => { head = html; } }) });
    assert.match(head, /theme\/v1\/theme.css/);
    assert.match(head, /name="viewport"/);
    let body;
    handlers.get('body').element({ prepend: html => { body = html; } });
    assert.match(body, /data-site-nav/);
    assert.match(body, /href="\/reports" aria-current="page"/);
    let removed = false;
    handlers.get('header.ht-site-nav').element({ remove() { removed = true; } });
    assert.ok(removed);
  } finally {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  }
});

test('DELETE removes only the authenticated target from storage and its live section index', async () => {
  for (const [section, prefix] of [['explorations', 'x/'], ['reports', 'r/']]) {
    const bucket = memoryBucket();
    await bucket.put(`${prefix}delete.html`, '<p>delete</p>', {});
    await bucket.put(`${prefix}keep.html`, '<p>keep</p>', {});
    const other = prefix === 'x/' ? 'r/' : 'x/';
    await bucket.put(`${other}delete.html`, '<p>other section</p>', {});
    const slugs = async () => indexItems(await listAll(bucket, prefix), prefix).map(item => item.slug);
    assert.ok((await slugs()).includes('delete.html'));
    const request = token => new Request(`https://yeoux.net/${section}/delete.html`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    for (const token of ['', 'wrong']) {
      assert.equal((await deleteItem(bucket, request(token), section, 'delete.html', 'secret')).status, 401);
      assert.ok(bucket.store.has(`${prefix}delete.html`));
    }
    assert.equal((await deleteItem(bucket, request('secret'), section, 'delete.html', '')).status, 401);
    const response = await deleteItem(bucket, request('secret'), section, 'delete.html', 'secret');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true, url: `https://yeoux.net/${section}/delete.html` });
    assert.equal((await getItem(bucket, section, 'delete.html')).status, 404);
    assert.deepEqual(await slugs(), ['keep.html']);
    assert.ok(bucket.store.has(`${other}delete.html`));
    const missing = await deleteItem(bucket, request('secret'), section, 'delete.html', 'secret');
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Not found' });
  }
});
