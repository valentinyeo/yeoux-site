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
