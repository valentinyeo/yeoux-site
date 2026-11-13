import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkTransitionCoverage } from '../tools/transition-coverage.mjs';

const fixture = () => ({
  ticket: 'HYCI-361',
  ratStack: 'a'.repeat(40),
  incumbent: 'b'.repeat(40),
  plausible: 'c'.repeat(40),
  slices: [
    { id: 'base', ticket: 'HYCI-363', skill: 'keep-or-cut', dependsOn: [] },
    { id: 'screen', ticket: 'HYCI-364', skill: 'test-behaviour', dependsOn: ['base'] },
  ],
  inventory: [
    { id: 'route', noun: 'Feature', slice: 'screen', files: ['src/pages/index.astro'] },
    { id: 'store', noun: 'Capability', slice: 'base', files: ['src/lib/content.mjs'] },
  ],
});
const sources = ['src/pages/index.astro', 'src/lib/content.mjs'];

test('complete plan accepts distinct source owners', () => {
  assert.deepEqual(checkTransitionCoverage(fixture(), sources), []);
});

test('a new route cannot disappear from migration scope', () => {
  const result = checkTransitionCoverage(fixture(), [...sources, 'src/pages/new.ts']);
  assert.ok(result.includes('Unowned source: src/pages/new.ts'));
});

test('a removed source invalidates its stale inventory', () => {
  const result = checkTransitionCoverage(fixture(), sources.slice(0, 1));
  assert.ok(result.includes('Planned source does not exist: src/lib/content.mjs'));
});

test('source files cannot have two owning items', () => {
  const plan = fixture();
  plan.inventory[1].files.push(sources[0]);
  assert.ok(checkTransitionCoverage(plan, sources).some(error => error.includes('multiple owners')));
});

test('each inventory item names a real slice', () => {
  const plan = fixture();
  plan.inventory[0].slice = 'missing';
  assert.ok(checkTransitionCoverage(plan, sources).some(error => error.includes('unknown owning slice')));
});

test('dependency cycles and missing slices are refused', () => {
  const cycle = fixture();
  cycle.slices[0].dependsOn.push('screen');
  assert.ok(checkTransitionCoverage(cycle, sources).some(error => error.includes('dependency cycle')));
  const missing = fixture();
  missing.slices[0].dependsOn.push('missing');
  assert.ok(checkTransitionCoverage(missing, sources).includes('Unknown slice dependency missing'));
});

test('duplicate item and slice identifiers are refused', () => {
  const plan = fixture();
  plan.slices.push({ ...plan.slices[0] });
  plan.inventory.push({ ...plan.inventory[0] });
  const result = checkTransitionCoverage(plan, sources);
  assert.ok(result.includes('Duplicate slice base'));
  assert.ok(result.includes('Duplicate inventory item route'));
});

test('every slice needs a distinct child ticket', () => {
  const missing = fixture();
  delete missing.slices[0].ticket;
  assert.ok(checkTransitionCoverage(missing, sources).includes('base needs its own child ticket'));
  const duplicate = fixture();
  duplicate.slices[1].ticket = duplicate.slices[0].ticket;
  assert.ok(checkTransitionCoverage(duplicate, sources).includes('Duplicate slice ticket HYCI-363'));
  const parent = fixture();
  parent.slices[0].ticket = parent.ticket;
  assert.ok(checkTransitionCoverage(parent, sources).includes('base needs its own child ticket'));
});

test('empty sources and malformed plans never pass', () => {
  for (const plan of [null, [], {}, { ...fixture(), slices: [] }, { ...fixture(), inventory: [] }]) {
    assert.ok(checkTransitionCoverage(plan, sources).length > 0);
  }
  assert.ok(checkTransitionCoverage(fixture(), []).includes('Source inventory must not be empty'));
  const invalid = fixture();
  invalid.slices[0].dependsOn = null;
  invalid.inventory[0].files = [];
  assert.ok(checkTransitionCoverage(invalid, sources).length > 0);
});

test('full pins and safe relative source paths are required', () => {
  const unpinned = fixture();
  unpinned.ratStack = 'main';
  assert.ok(checkTransitionCoverage(unpinned, sources).includes('ratStack must pin one full commit'));
  for (const path of ['/etc/passwd', '../secret', 'src/../secret', 'C:\\secret', './src/file', '']) {
    const plan = fixture();
    plan.inventory[0].files[0] = path;
    assert.ok(checkTransitionCoverage(plan, sources).some(error => error.includes('invalid source path')));
  }
});

test('the current tracked tree has exactly one migration owner', () => {
  const plan = JSON.parse(readFileSync(new URL('../docs/ratstack-transition.json', import.meta.url), 'utf8'));
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.deepEqual(checkTransitionCoverage(plan, files), []);
});
