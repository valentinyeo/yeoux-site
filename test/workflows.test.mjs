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
    if (Object.hasOwn(job, 'uses')) continue;
    const labels = [job['runs-on']].flat();
    assert.ok(labels.length > 0 && labels.every(label => typeof label === 'string' && label.trim()), `${context}: runs-on must be literal strings`);
    for (const label of labels) {
      assert.ok(!label.includes('${{'), `${context}: runs-on labels must be literal strings`);
      assert.doesNotMatch(label, /self-hosted|contabo|yeoux/i, `${context}: CI on the VPS is forbidden, use a GitHub-hosted runner`);
    }
    assert.ok(labels.some(label => /^(?:ubuntu|windows|macos)(?:-|$)/i.test(label)), `${context}: runs-on must be a GitHub-hosted runner`);
  }
}

test('every executable workflow job uses a GitHub-hosted runner', () => {
  const directory = new URL('../.github/workflows/', import.meta.url);
  const files = readdirSync(directory).filter(file => /\.ya?ml$/.test(file));
  assert.ok(files.length > 0, 'no workflow YAML files found');
  for (const file of files) checkWorkflow(readFileSync(new URL(file, directory), 'utf8'), file);
});

test('workflow runner policy accepts hosted jobs and rejects self-hosted runner values', () => {
  const checkJob = source => checkWorkflow(`jobs:\n  control:\n${source}\n`, 'control.yml');
  assert.doesNotThrow(() => checkJob('    runs-on: ubuntu-latest'));
  assert.doesNotThrow(() => checkJob('    runs-on: [ubuntu-24.04]'));
  for (const [source, message] of [
    ['    runs-on: [self-hosted, contabo, yeoux]', /forbidden/],
    ['    runs-on: [self-hosted, ubuntu-latest]', /forbidden/],
    ['    runs-on: self-hosted', /forbidden/],
    ['    runs-on: ${{ matrix.runner }}', /literal strings/],
    ['    runs-on: [ubuntu-latest, "${{ matrix.runner }}"]', /literal strings/],
    ['    runs-on: []', /literal strings/],
    ['    runs-on: custom-label', /GitHub-hosted/],
    ['    steps: []', /literal strings/],
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
