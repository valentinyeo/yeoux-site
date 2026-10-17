#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const FORBIDDEN = [
  ['Hypertask Cloudflare account id', /6031a7dff0d4a6469414cfa8a6dedddf/],
  ['Hypertask Access audience', /fea6a655fffebd4c7ef1eaa443e7ac559ededcce/],
  ['Hypertask Access team', /hypertask\.cloudflareaccess\.com/i],
  ['Hypertask content bucket', /hypertask-app-content/],
  ['Neon database', /neon\.tech|@neondatabase|neondb/i],
  ['Postgres connection string', /postgres(?:ql)?:\/\//i],
  ['Database URL variable', /\bDATABASE_URL\b/],
  ['Hypertask secrets folder', /hypertask-secrets|hypertask-app\/credentials/],
];

export function findForbidden(files, read) {
  const hits = [];
  for (const file of files) {
    if (file === 'tools/no-hypertask.mjs' || file === 'test/tools.test.mjs') continue;
    const text = read(file);
    for (const [label, pattern] of FORBIDDEN) if (pattern.test(text)) hits.push(`${file}: ${label}`);
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const hits = findForbidden(files, file => { try { return readFileSync(file, 'latin1'); } catch { return ''; } });
  if (hits.length) {
    console.error(`Hypertask material found. Remove it:\n${hits.join('\n')}`);
    process.exit(1);
  }
  console.log(`No Hypertask keys, account ids or Neon strings in ${files.length} files.`);
}
