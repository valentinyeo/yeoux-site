import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

function checkWorkflow(source, file) {
  const workflow = parse(source);
  assert.ok(workflow?.jobs && typeof workflow.jobs === 'object' && !Array.isArray(workflow.jobs), `${file}: jobs must be a mapping`);
  const jobs = Object.entries(workflow.jobs);
  assert.ok(jobs.length > 0, `${file}: no jobs to inspect`);
  for (const [name, job] of jobs) {
    const context = `${file}: job ${name}`;
    assert.ok(job && typeof job === 'object' && !Array.isArray(job), `${context}: job must be a mapping`);
    assert.ok(!Object.hasOwn(job, 'uses'), `${context}: reusable-workflow runner cannot be inspected`);
    const labels = job['runs-on'];
    assert.ok(Array.isArray(labels), `${context}: runs-on must be a literal label array`);
    for (const label of labels) {
      assert.ok(typeof label === 'string' && label.trim() && !label.includes('${{'), `${context}: runs-on labels must be literal strings`);
      assert.doesNotMatch(label, /^(?:ubuntu|windows|macos)(?:-|$)/i, `${context}: GitHub-hosted runner label is forbidden`);
    }
    for (const label of ['self-hosted', 'contabo', 'yeoux']) {
      assert.ok(labels.includes(label), `${context}: runs-on must include ${label}`);
    }
  }
}

test('every executable workflow job uses the Yeo UX self-hosted runner', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const files = readdirSync(directory).filter(file => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, 'no workflow YAML files found');
  for (const file of files) checkWorkflow(readFileSync(new URL(file, directory), 'utf8'), file);
});

test('workflow runner policy accepts self-hosted jobs and rejects unsafe runner values', () => {
  const checkJob = source => checkWorkflow(`jobs:\n  control:\n${source}\n`, 'control.yml');
  assert.doesNotThrow(() => checkJob('    runs-on: [self-hosted, contabo, yeoux]'));
  for (const [source, message] of [
    ['    runs-on: ubuntu-latest', /literal label array/],
    ['    runs-on: [self-hosted, contabo, yeoux, windows-latest]', /GitHub-hosted/],
    ['    runs-on: [self-hosted, contabo, yeoux, macos-15]', /GitHub-hosted/],
    ['    runs-on: [self-hosted, contabo, yeoux, ubuntu-24.04]', /GitHub-hosted/],
    ['    runs-on: [self-hosted, contabo]', /include yeoux/],
    ['    runs-on: [self-hosted, yeoux]', /include contabo/],
    ['    runs-on: [contabo, yeoux]', /include self-hosted/],
    ['    runs-on: ${{ matrix.runner }}', /literal label array/],
    ['    runs-on: [self-hosted, contabo, yeoux, "${{ matrix.runner }}"]', /literal strings/],
    ['    runs-on: {group: yeoux}', /literal label array/],
    ['    runs-on: [self-hosted, contabo, yeoux, 22]', /literal strings/],
    ['    runs-on: []', /include self-hosted/],
    ['    steps: []', /literal label array/],
    ['    uses: owner/repo/.github/workflows/shared.yml@main', /reusable-workflow/],
    ['    uses: owner/repo/.github/workflows/shared.yml@main\n    runs-on: [self-hosted, contabo, yeoux]', /reusable-workflow/],
  ]) {
    assert.throws(() => checkJob(source), message);
  }
  assert.throws(() => checkWorkflow('jobs: {}', 'empty.yaml'), /no jobs/);
  assert.throws(() => checkWorkflow('name: missing jobs', 'empty.yaml'), /jobs must be a mapping/);
  assert.throws(() => checkWorkflow('jobs: [invalid]', 'invalid.yaml'), /jobs must be a mapping/);
  assert.throws(() => checkWorkflow('jobs:\n  invalid: null', 'invalid.yaml'), /job must be a mapping/);
  assert.throws(() => checkJob('    runs-on: [unterminated'), /flow sequence/i);
});

function secretScanTriggers() {
  const workflow = parse(readFileSync(new URL('../.github/workflows/gitleaks.yml', import.meta.url), 'utf8'));
  return workflow.on;
}

test('the full-history secret scan runs weekly and can be started by hand', () => {
  const triggers = secretScanTriggers();
  assert.ok(triggers && typeof triggers === 'object' && !Array.isArray(triggers), 'gitleaks.yml: needs named triggers');
  const schedule = triggers.schedule;
  assert.ok(Array.isArray(schedule) && schedule.length > 0, 'gitleaks.yml: needs a schedule so the whole history is rescanned without a push');
  for (const entry of schedule) {
    assert.match(String(entry?.cron), /^\S+ \S+ \S+ \S+ \S+$/, 'gitleaks.yml: schedule needs a five-field cron');
  }
  assert.ok(Object.hasOwn(triggers, 'workflow_dispatch'), 'gitleaks.yml: needs workflow_dispatch so the weekly path can be run once as proof');
  assert.ok(Object.hasOwn(triggers, 'push') && Object.hasOwn(triggers, 'pull_request'), 'gitleaks.yml: keeps scanning pushes and pull requests');
});

test('the secret scan trigger policy accepts the shipped file and rejects a push-only file', () => {
  const check = triggers => {
    assert.ok(triggers && typeof triggers === 'object' && !Array.isArray(triggers), 'needs named triggers');
    assert.ok(Array.isArray(triggers.schedule) && triggers.schedule.length > 0, 'needs a schedule');
    assert.match(String(triggers.schedule[0]?.cron), /^\S+ \S+ \S+ \S+ \S+$/, 'needs a five-field cron');
    assert.ok(Object.hasOwn(triggers, 'workflow_dispatch'), 'needs workflow_dispatch');
  };
  assert.doesNotThrow(() => check({ push: null, pull_request: null, schedule: [{ cron: '17 4 * * 1' }], workflow_dispatch: null }));
  assert.throws(() => check(['push', 'pull_request']), /needs named triggers/);
  assert.throws(() => check({ push: null, pull_request: null }), /needs a schedule/);
  assert.throws(() => check({ push: null, schedule: [{ cron: 'weekly' }], workflow_dispatch: null }), /five-field cron/);
  assert.throws(() => check({ push: null, schedule: [], workflow_dispatch: null }), /needs a schedule/);
  assert.throws(() => check({ push: null, schedule: [{ cron: '17 4 * * 1' }] }), /needs workflow_dispatch/);
});
