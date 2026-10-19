import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const claude = readFileSync(new URL('../CLAUDE.md', import.meta.url), 'utf8');
const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('every npm run command in CLAUDE.md exists in package.json scripts', () => {
  const check = text => {
    for (const [, name] of text.matchAll(/\bnpm run ([\w:-]+)/g)) assert.ok(Object.hasOwn(scripts, name), `unknown npm script: ${name}`);
  };
  assert.throws(() => check('npm run missing-script'), /unknown npm script/);
  check(claude);
});

test('every backticked repository path in CLAUDE.md exists, ignoring trailing arguments', () => {
  const check = text => {
    for (const [, value] of text.matchAll(/`((?:src|bin|tools|test)\/[^`]+)`/g)) {
      const file = value.split(/\s/)[0];
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `missing repository path: ${file}`);
    }
  };
  assert.throws(() => check('`tools/missing-file.mjs --check`'), /missing repository path/);
  check('`tools/strip-comments.mjs --check .`');
  check(claude);
});

test('CLAUDE.md stays under 80 lines', () => {
  const check = text => assert.ok(text.split('\n').length - Number(text.endsWith('\n')) < 80, 'CLAUDE.md must stay under 80 lines');
  assert.throws(() => check(Array(80).fill('line').join('\n')), /under 80 lines/);
  assert.throws(() => check(`line${'\n'.repeat(80)}`), /under 80 lines/);
  check(claude);
});
