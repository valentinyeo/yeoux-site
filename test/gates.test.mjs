import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { gates } from '../tools/gates.mjs';

test('G1 refuses vacuous success when the source bucket is empty', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, result: [] }));
  t.mock.method(console, 'log', () => {});
  const previous = process.exitCode;
  try {
    await gates.g1();
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = previous;
  }
});

test('G3 requires login redirects and an authenticated 200', async t => {
  t.mock.method(console, 'log', () => {});
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => ++calls <= 3 ? new Response(null, { status: 302, headers: { Location: 'https://yeoux.cloudflareaccess.com/login' } }) : new Response(null, { status: 403 }));
  const previous = process.exitCode;
  try {
    await gates.g3();
    assert.equal(process.exitCode, 1);
    process.exitCode = previous;
    calls = 0;
    globalThis.fetch = async () => ++calls <= 3 ? new Response(null, { status: 302, headers: { Location: 'https://yeoux.cloudflareaccess.com/login' } }) : new Response(null, { status: 200 });
    await gates.g3();
    assert.equal(process.exitCode, previous);
  } finally {
    process.exitCode = previous;
  }
});

test('G4 removes only its own upload and local fixture after checking the first row', async t => {
  let file;
  let title;
  t.mock.method(childProcess, 'execFileSync', (command, args) => {
    assert.ok(command.endsWith('/bin/yeoshare.mjs'));
    file = args.at(-1);
    title = /<title>(.*?)<\/title>/.exec(readFileSync(file, 'utf8'))[1];
  });
  syncBuiltinESMExports();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return options?.method === 'PUT' ? Response.json({ deleted: true }) : new Response(`<tbody><tr><td><a>${title}</a></td></tr></tbody>`);
  });
  t.mock.method(console, 'log', () => {});
  try {
    await gates.g4();
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://yeoux.net/explorations');
    assert.match(calls[1].url, /^https:\/\/yeoux\.net\/explorations\/[0-9a-f]{8}-g4-check\.html$/);
    assert.equal(calls[1].options.body, '');
    assert.equal(existsSync(file), false);
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
  }
});
