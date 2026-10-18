import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HELP, parseArgs, readKeys, slugFor } from '../bin/yeoshare.mjs';
import { isValidSlug } from '../src/lib/content.mjs';

const source = readFileSync(new URL('../bin/yeoshare.mjs', import.meta.url), 'utf8');

test('G6: yeoshare reads keys through yeo-key, never from a file under ~/.config', () => {
  assert.doesNotMatch(source, /\.config/);
  assert.doesNotMatch(source, /credentials\.env|\.env['"`]/);
  assert.match(source, /execFileSync\('yeo-key'/);
});

test('every upload is tagged with type, project and date', () => {
  assert.deepEqual(parseArgs(['--report', '--project', 'pecunia', '--date', '2026-10-17', 'a.html']).options, { section: 'reports', project: 'pecunia', title: '', date: '2026-10-17', file: 'a.html' });
  assert.equal(parseArgs(['a.html']).options.section, 'explorations');
  assert.ok(parseArgs([]).error);
  assert.ok(parseArgs(['--project']).error);
  assert.ok(parseArgs(['--nope', 'a.html']).error);
  assert.ok(parseArgs(['--help']).help);
});

test('the same file path keeps the same URL, matching the old admin ids', () => {
  assert.equal(slugFor('/home/valentin/x/plan.html'), slugFor('/home/valentin/x/plan.html'));
  assert.notEqual(slugFor('/home/valentin/x/plan.html'), slugFor('/home/valentin/y/plan.html'));
  assert.ok(isValidSlug(slugFor('/home/valentin/x/My Plan.html')));
});

test('help points sessions at yeoux.net/explorations', () => {
  assert.match(HELP, /https:\/\/yeoux\.net\/explorations/);
});

test('credentials use their separate vault items, with one read per item', () => {
  const calls = [];
  const keys = readKeys(args => {
    calls.push(args);
    return args[0] === 'Yeoux Site Share' ? 'share-value\n' : 'CF_ACCESS_CLIENT_ID=client-id\nCF_ACCESS_CLIENT_SECRET=client-secret\n';
  });
  assert.deepEqual(calls, [
    ['Yeoux Site Share', 'SHARE_TOKEN'],
    ['Yeoux Site Access Gates', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'],
  ]);
  assert.deepEqual(keys, { SHARE_TOKEN: 'share-value', CF_ACCESS_CLIENT_ID: 'client-id', CF_ACCESS_CLIENT_SECRET: 'client-secret' });
});
