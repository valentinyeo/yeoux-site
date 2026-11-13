import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE, resolveCore } from '../src/lib/coreReports.mjs';
import { siteNavigation } from '../src/lib/siteNavigation.mjs';

const items = [
  { slug: 'aaaa1111-finance-triage-2026-11-07.html', title: 'Finance triage 2026-11-07' },
  { slug: 'bbbb2222-finance-triage-2026-11-06.html', title: 'Finance triage 2026-11-06' },
];

test('core reports keep the agreed order and names, runners first', () => {
  const names = CORE[0].items.slice(0, 4).map(entry => entry.name);
  assert.deepEqual(names, ['Runners', 'Usage', 'Factory performance', 'CI performance']);
});

test('a dated report resolves to its newest page and an unpublished one is left out', () => {
  const all = resolveCore(items).flatMap(cluster => cluster.items);
  assert.equal(all.find(entry => entry.name === 'Finance triage').href, '/reports/aaaa1111-finance-triage-2026-11-07.html');
  assert.ok(!all.some(entry => entry.name === 'CI performance'));
  const published = resolveCore([...items, { slug: 'cccc3333-ci.html', title: 'CI performance' }]);
  assert.equal(published[0].items[3].name, 'CI performance');
});

test('menu lists core reports at the top level, runners first, with no split', () => {
  const html = siteNavigation('/reports/a41914ac-runner-board.html', resolveCore(items));
  const links = [...html.matchAll(/<li><a href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(links[0], '/reports/a41914ac-runner-board.html');
  assert.match(html, /<a href="\/reports\/a41914ac-runner-board.html" aria-current="page">Runners</);
  assert.doesNotMatch(html, /<a href="\/reports" aria-current/);
});

test('factory performance is the header link, not a menu item', () => {
  const html = siteNavigation('/reports/c65b9a8c-productivity.html', resolveCore([]));
  assert.match(html, /<a class="ht-brand" href="\/reports\/c65b9a8c-productivity.html" aria-current="page">Factory performance<\/a>/);
  assert.equal(html.match(/productivity\.html/g).length, 1);
  assert.doesNotMatch(html, />Yeo UX</);
});

test('fleet plan is a core report in the Software Factory menu', () => {
  const entry = CORE[0].items.find(item => item.name === 'Fleet plan');
  assert.equal(entry.href, '/reports/38361bb7-fleet-shape.html');
});

test('color mode toggle lives in the hamburger menu, not the header row', () => {
  const html = siteNavigation('/reports/c65b9a8c-productivity.html', resolveCore([]));
  const menu = html.slice(html.indexOf('<ul class="ht-mobile-items">'), html.indexOf('</ul>'));
  assert.match(menu, /<li><button class="ht-theme-toggle" type="button" data-theme-toggle/);
  assert.equal(html.match(/data-theme-toggle/g).length, 1);
  assert.doesNotMatch(html.slice(html.indexOf('</details>')), /data-theme-toggle/);
});
