import test from 'node:test';
import assert from 'node:assert/strict';
import { findForbidden } from '../tools/no-hypertask.mjs';
import { listBucket, planMigration } from '../tools/migrate.mjs';

test('G5: Hypertask account ids, Neon strings and secret paths are caught', () => {
  const files = {
    'a.toml': 'account_id = "6031a7dff0d4a6469414cfa8a6dedddf"',
    'b.js': "import { neon } from '@neondatabase/serverless'",
    'c.sh': 'source ~/.config/hypertask-app/credentials.env',
    'd.js': 'const ok = "7865043d9ae730882b77f3d5d670c158"',
  };
  assert.deepEqual(findForbidden(Object.keys(files), f => files[f]), [
    'a.toml: Hypertask Cloudflare account id',
    'b.js: Neon database',
    'c.sh: Hypertask secrets folder',
  ]);
});

test('migration plan sorts every old item and refuses clashes', () => {
  const plan = planMigration([
    { key: 'p/1a2b3c4d/weekly-report.html', last_modified: '2026-09-01T10:00:00Z' },
    { key: 'p/1a2b3c4d/plan.html', last_modified: '2026-09-02T10:00:00Z' },
    { key: 'p/1a2b3c4d/plan.html', last_modified: '2026-09-02T10:00:00Z' },
    { key: 'stray.txt' },
  ]);
  assert.deepEqual(plan[0], { key: 'p/1a2b3c4d/weekly-report.html', section: 'reports', slug: '1a2b3c4d-weekly-report.html', date: '2026-09-01' });
  assert.equal(plan[1].section, 'explorations');
  assert.match(plan[2].error, /clash/);
  assert.match(plan[3].error, /not a yeoshare key/);
});

test('bucket listing follows the cursor to the end', async () => {
  const pages = [
    { success: true, result: [{ key: 'a' }], result_info: { is_truncated: true, cursor: 'c1' } },
    { success: true, result: [{ key: 'b' }], result_info: { is_truncated: false } },
  ];
  const urls = [];
  const fake = async url => { urls.push(url); return { json: async () => pages.shift() }; };
  assert.deepEqual((await listBucket('old', 't', fake)).map(o => o.key), ['a', 'b']);
  assert.match(urls[1], /cursor=c1/);
});
