import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_NAME = /[A-Za-z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|LOGIN)[A-Za-z0-9_]*/;
const ASSIGNMENT = /([A-Za-z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|LOGIN)[A-Za-z0-9_]*)=(\S+)/g;
const REDACTED = '[redacted]';

export function redactLog(text, env = process.env) {
  let out = String(text);
  for (const [name, value] of Object.entries(env)) {
    if (!SECRET_NAME.test(name)) continue;
    if (typeof value !== 'string' || value.length < 8) continue;
    out = out.split(value).join(REDACTED);
  }
  return out.replace(ASSIGNMENT, (match, name, value) => `${name}=${value.length >= 8 ? REDACTED : value}`);
}

export function tailLog(text, lines = 20) {
  const rows = String(text).split('\n');
  while (rows.length && rows[rows.length - 1] === '') rows.pop();
  return rows.slice(-lines).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, count] = process.argv.slice(2);
  const wanted = Number.parseInt(count, 10);
  const lines = Number.isFinite(wanted) && wanted > 0 ? wanted : 20;
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    text = `could not read ${file}`;
  }
  process.stdout.write(`${redactLog(tailLog(text, lines))}\n`);
}
