import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { spawnSync } from 'node:child_process';
import { ACCOUNT, WORKFLOW, main } from '../tools/ship.mjs';

const sha = 'a'.repeat(40);
const version = '12345678-1234-1234-1234-123456789abc';
const ciEnv = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', CLOUDFLARE_API_TOKEN: 'test-token' };

function fixture({ dirty = '', remote = sha, head = sha, help = '--message', status = { annotations: { 'workers/message': sha }, versions: [{ version_id: version, percentage: 100 }] }, liveStatus = 302, location = 'https://yeoux.cloudflareaccess.com/login', fetchError = null, failAt = -1, env = ciEnv } = {}) {
  const calls = [];
  const requests = [];
  const run = (command, args, options) => {
    calls.push({ command, args, options });
    if (calls.length - 1 === failAt) throw new Error('private child output must not be echoed');
    if (command === 'git' && args[0] === 'status') return dirty;
    if (command === 'git' && args[0] === 'rev-parse') return `${args[1] === 'HEAD' ? head : remote}\n`;
    if (command === 'npx' && args[1] === 'deployments') return typeof status === 'string' ? status : JSON.stringify(status);
    if (command === 'npx' && args.includes('--help')) return help;
    return '';
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (fetchError) throw fetchError;
    return new Response(null, { status: liveStatus, headers: location ? { Location: location } : {} });
  };
  return { calls, requests, ship: () => main(run, fetchImpl, env) };
}

test('package scripts expose ship without a raw deploy bypass', () => {
  const check = scripts => {
    assert.ok(!Object.hasOwn(scripts, 'deploy'), 'raw deploy npm script is forbidden');
    assert.equal(scripts.ship, 'node tools/ship.mjs');
    for (const [name, command] of Object.entries(scripts)) {
      assert.doesNotMatch(command, /\bwrangler(?:\s|["'])+deploy\b/i, `${name}: direct wrangler deploy is forbidden`);
    }
  };
  check({ ship: 'node tools/ship.mjs' });
  assert.throws(() => check({ ship: 'node tools/ship.mjs', deploy: 'npm run build && wrangler deploy' }), /raw deploy/);
  assert.throws(() => check({ ship: 'node tools/ship.mjs', release: 'npx wrangler deploy' }), /direct wrangler deploy/);
  assert.throws(() => check({ ship: 'node other.mjs' }), /node tools\/ship\.mjs/);
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  check(scripts);
});

test('outside a GitHub-hosted runner, or without the token, ship refuses before any command', async () => {
  for (const [env, message] of [
    [{}, /GitHub-hosted runners, never on this VPS/],
    [{ CLOUDFLARE_API_TOKEN: 'x' }, /GitHub-hosted runners/],
    [{ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted', CLOUDFLARE_API_TOKEN: 'x' }, /GitHub-hosted runners/],
    [{ GITHUB_ACTIONS: 'false', RUNNER_ENVIRONMENT: 'github-hosted', CLOUDFLARE_API_TOKEN: 'x' }, /GitHub-hosted runners/],
    [{ GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }, /CLOUDFLARE_API_TOKEN/],
  ]) {
    const f = fixture({ env });
    await assert.rejects(f.ship(), message);
    assert.equal(f.calls.length, 0);
    assert.equal(f.requests.length, 0);
  }
  assert.ok(existsSync(new URL(`../${WORKFLOW}`, import.meta.url)), 'refusal must point at a real workflow');
});

test('the deploy workflow runs ship on a GitHub-hosted runner for every push to main', () => {
  const workflow = parse(readFileSync(new URL(`../${WORKFLOW}`, import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main']);
  const steps = workflow.jobs.deploy.steps;
  assert.equal(workflow.jobs.deploy['runs-on'], 'ubuntu-latest');
  const ship = steps.find(step => step.run === 'npm run ship');
  assert.ok(ship, 'deploy job must run npm run ship');
  assert.equal(ship.env.CLOUDFLARE_API_TOKEN, '${{ secrets.CLOUDFLARE_API_TOKEN }}');
});

test('dirty trees and HEAD other than origin/main refuse before npm or deploy', async () => {
  for (const [options, message] of [[{ dirty: ' M README.md\n' }, /working tree must be clean/], [{ dirty: '?? untracked.txt\n' }, /working tree must be clean/], [{ remote: 'b'.repeat(40) }, /HEAD must equal origin\/main/]]) {
    const f = fixture(options);
    await assert.rejects(f.ship(), message);
    assert.ok(f.calls.every(call => call.command === 'git'));
    assert.deepEqual(f.calls[0].args, ['fetch', 'origin']);
    assert.equal(f.requests.length, 0);
  }
});

test('happy path checks in order, deploys once with the sha, and verifies Zero Trust', async t => {
  const printed = [];
  t.mock.method(console, 'log', text => printed.push(text));
  const f = fixture();
  await f.ship();
  assert.deepEqual(f.calls.map(({ command, args }) => [command, ...args]), [
    ['git', 'fetch', 'origin'],
    ['git', 'status', '--porcelain'],
    ['git', 'rev-parse', 'HEAD'],
    ['git', 'rev-parse', 'origin/main'],
    ['npm', 'ci'],
    ['npx', 'wrangler', 'deploy', '--help'],
    ['npm', 'run', 'check'],
    ['npm', 'run', 'build'],
    ['npx', 'wrangler', 'deploy', '--message', sha],
    ['npx', 'wrangler', 'deployments', 'status', '--json'],
  ]);
  for (const call of f.calls.filter(call => call.command === 'npm')) assert.equal(call.options.stdio, 'inherit');
  for (const call of f.calls.slice(-2)) {
    assert.equal(call.options.env.CLOUDFLARE_ACCOUNT_ID, ACCOUNT);
    assert.equal(call.options.env.CLOUDFLARE_API_TOKEN, 'test-token');
  }
  assert.ok(f.calls.slice(0, -2).every(call => !call.options.env), 'only the deploy calls get the Cloudflare env');
  assert.ok(f.calls.every(call => call.command !== 'yeo-key'), 'CI reads the token from the repo secret, never yeo-key');
  assert.deepEqual(f.requests, [{ url: 'https://yeoux.net/', options: { redirect: 'manual' } }]);
  assert.deepEqual(printed, [`shipped ${sha} version ${version}`]);
});

test('each command failure stops immediately without echoing captured output', async () => {
  for (let failAt = 0; failAt < 10; failAt++) {
    const f = fixture({ failAt });
    await assert.rejects(f.ship(), error => {
      assert.match(error.message, /failed$/);
      assert.doesNotMatch(error.message, /private child output/);
      return true;
    });
    assert.equal(f.calls.length, failAt + 1);
    assert.equal(f.requests.length, 0);
  }
});

test('an unsupported message flag or invalid sha fails before deploying', async () => {
  for (const [options, message] of [[{ help: 'no message option' }, /must support deploy --message/], [{ head: 'not-a-sha', remote: 'not-a-sha' }, /invalid HEAD sha/]]) {
    const f = fixture(options);
    await assert.rejects(f.ship(), message);
    assert.ok(f.calls.every(call => !call.args.includes('--message')));
    assert.equal(f.requests.length, 0);
  }
});

test('a deployment message differing from HEAD or absent fails before the live check', async () => {
  for (const status of [{ annotations: { 'workers/message': 'b'.repeat(40) } }, {}, null]) {
    const f = fixture({ status });
    await assert.rejects(f.ship(), /deployment message does not match HEAD/);
    assert.equal(f.requests.length, 0);
  }
});

test('malformed status JSON and a missing version id fail before the live check', async () => {
  for (const [status, message] of [['not JSON', /did not return valid JSON/], [{ annotations: { 'workers/message': sha } }, /missing its version id/]]) {
    const f = fixture({ status });
    await assert.rejects(f.ship(), message);
    assert.equal(f.requests.length, 0);
  }
});

test('non-302 live answers and redirects not pointing to Access fail without success output', async t => {
  const printed = [];
  t.mock.method(console, 'log', text => printed.push(text));
  for (const options of [{ liveStatus: 200 }, { liveStatus: 301 }, { liveStatus: 500 }, { location: 'https://example.com/login' }, { location: '' }]) {
    const f = fixture(options);
    await assert.rejects(f.ship(), /live site must redirect to Zero Trust/);
    assert.equal(f.requests.length, 1);
  }
  assert.deepEqual(printed, []);
});

test('network failure propagates without success output', async t => {
  const printed = [];
  t.mock.method(console, 'log', text => printed.push(text));
  const f = fixture({ fetchError: new Error('network unavailable') });
  await assert.rejects(f.ship(), /network unavailable/);
  assert.deepEqual(printed, []);
});

test('the ship account equals account_id in wrangler.toml', () => {
  const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.equal(ACCOUNT, /^account_id\s*=\s*"([^"]+)"/m.exec(config)?.[1]);
});

test('direct execution exits nonzero on the first failure, while importing does not run main', () => {
  const file = new URL('../tools/ship.mjs', import.meta.url);
  const ci = { PATH: process.env.PATH, ...ciEnv };
  for (const [direct, env, expected] of [[false, ci, ''], [true, ci, 'ship: git fetch origin failed\n'], [true, { PATH: process.env.PATH }, /^ship: deploys run only on GitHub-hosted runners/]]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
childProcess.execFileSync = () => { throw new Error('private child output'); };
syncBuiltinESMExports();
process.argv[1] = ${JSON.stringify(direct ? file.pathname : '')};
await import(${JSON.stringify(file.href)});
`], { encoding: 'utf8', env });
    assert.equal(result.status, direct ? 1 : 0);
    assert.equal(result.stdout, '');
    if (typeof expected === 'string') assert.equal(result.stderr, expected);
    else assert.match(result.stderr, expected);
  }
});
