import test from 'node:test';
import assert from 'node:assert/strict';
import { accessSync, constants, readFileSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HELP, deleteTarget, main, parseArgs, readKeys, slugFor } from '../bin/yeoshare.mjs';
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

test('yeoshare is executable when installed as a CLI', () => {
  assert.doesNotThrow(() => accessSync(new URL('../bin/yeoshare.mjs', import.meta.url), constants.X_OK));
});

test('delete accepts one file or URL and documents report selection', () => {
  assert.equal(parseArgs(['--delete', 'a.html']).options.delete, true);
  assert.equal(parseArgs(['--delete', '--report', 'a.html']).options.section, 'reports');
  assert.ok(parseArgs(['--delete']).error);
  assert.ok(parseArgs(['--delete', 'a.html', 'b.html']).error);
  assert.match(HELP, /--delete <file-or-url>/);
});

test('delete file targets resolve real paths exactly like uploads, including symlinks', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'yeoshare-delete-'));
  try {
    const file = path.join(dir, 'My Plan.html');
    const link = path.join(dir, 'alias.html');
    writeFileSync(file, '<p>test</p>');
    symlinkSync(file, link);
    const slug = slugFor(realpathSync(file));
    assert.equal(deleteTarget(path.relative(process.cwd(), file)), `https://yeoux.net/explorations/${slug}`);
    assert.equal(deleteTarget(link, 'reports'), `https://yeoux.net/reports/${slug}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('delete URLs select their own section and never send credentials to another origin', () => {
  assert.equal(deleteTarget('https://yeoux.net/reports/12345678-plan.html?x=1#top'), 'https://yeoux.net/reports/12345678-plan.html');
  assert.equal(deleteTarget('https://yeoux.net/explorations/a.html', 'reports'), 'https://yeoux.net/explorations/a.html');
  const credentialUrl = new URL('https://yeoux.net/reports/a.html');
  credentialUrl.username = 'test-user';
  credentialUrl.password = 'test-password';
  for (const url of [credentialUrl.href, 'http://yeoux.net/reports/a.html', 'https://example.com/reports/a.html', 'https://yeoux.net.evil.test/reports/a.html', 'https://yeoux.net:8443/reports/a.html', 'https://yeoux.net/reports', 'https://yeoux.net/other/a.html', 'https://yeoux.net/__proto__/a.html', 'https://yeoux.net/reports/a/b.html', 'https://yeoux.net/reports/a%20b.html']) {
    assert.throws(() => deleteTarget(url), /delete URL must/);
  }
});

test('delete sends DELETE with both authentication layers, no body, and prints the deleted URL', async t => {
  t.mock.method(childProcess, 'execFileSync', (command, args) => {
    assert.equal(command, 'yeo-key');
    return args[0] === 'Yeoux Site Share' ? 'share-value\n' : 'CF_ACCESS_CLIENT_ID=client-id\nCF_ACCESS_CLIENT_SECRET=client-secret\n';
  });
  syncBuiltinESMExports();
  const printed = [];
  t.mock.method(console, 'log', text => printed.push(text));
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return Response.json({ deleted: true, url });
  });
  try {
    await main(['--delete', 'https://yeoux.net/reports/a.html']);
    assert.deepEqual(calls, [{ url: 'https://yeoux.net/reports/a.html', options: {
      method: 'DELETE', headers: {
        Authorization: 'Bearer share-value',
        'CF-Access-Client-Id': 'client-id',
        'CF-Access-Client-Secret': 'client-secret',
      },
    } }]);
    assert.deepEqual(printed, ['deleted https://yeoux.net/reports/a.html']);
    globalThis.fetch = async () => Response.json({ error: 'Not found' }, { status: 404 });
    t.mock.method(console, 'error', text => printed.push(text));
    t.mock.method(process, 'exit', code => { throw new Error(`exit ${code}`); });
    await assert.rejects(main(['--delete', 'https://yeoux.net/reports/missing.html']), /exit 1/);
    assert.equal(printed.at(-1), 'yeoshare: delete failed (404)');
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
