#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { contentType, legacySlug } from '../src/lib/content.mjs';

export const KEY_ITEM = 'Yeoux Site Share';
export const ACCESS_KEY_ITEM = 'Yeoux Site Access Gates';
export const KEY_FIELDS = ['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'];

export const HELP = `Usage: yeoshare [--report] [--project <name>] [--title <text>] [--date YYYY-MM-DD] <file>

Uploads a file to https://yeoux.net (Zero Trust: only Valentin can open it) and prints its URL.
Explorations land on https://yeoux.net/explorations, reports (--report) on https://yeoux.net/reports.
Both indexes list newest first and build themselves from the type, project and date of each upload.
The same file path always gets the same URL, so running it again updates the page in place.
--project defaults to the name of the git repo holding the file. --date defaults to today.
Keys come from 1Password through yeo-key (items "${KEY_ITEM}" and "${ACCESS_KEY_ITEM}"), never from a file.
Only Yeo UX material goes here. Hypertask material goes to hypertask.app. Never upload secrets or infra docs.`;

export function parseArgs(argv) {
  const options = { section: 'explorations', project: '', title: '', date: '', file: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') return { help: true };
    if (arg === '--report') options.section = 'reports';
    else if (arg === '--exploration') options.section = 'explorations';
    else if (['--project', '--title', '--date'].includes(arg)) {
      if (i + 1 >= argv.length) return { error: `${arg} needs a value` };
      options[arg.slice(2)] = argv[++i];
    } else if (arg.startsWith('-')) return { error: `unknown option ${arg}` };
    else if (options.file) return { error: 'give one file' };
    else options.file = arg;
  }
  if (!options.file) return { error: 'give a file' };
  return { options };
}

export function slugFor(realPath) {
  const id = createHash('sha256').update(realPath).digest('hex').slice(0, 8);
  return legacySlug(`p/${id}/${path.basename(realPath)}`);
}

function repoName(file) {
  try {
    const top = execFileSync('git', ['-C', path.dirname(file), 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return path.basename(top).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40);
  } catch {
    return '';
  }
}

export function readKeys(read = args => execFileSync('yeo-key', args, { encoding: 'utf8' })) {
  const share = read([KEY_ITEM, 'SHARE_TOKEN']).trim();
  const out = read([ACCESS_KEY_ITEM, ...KEY_FIELDS]);
  return { SHARE_TOKEN: share, ...Object.fromEntries(out.trim().split('\n').map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) };
}

async function main() {
  const { help, error, options } = parseArgs(process.argv.slice(2));
  if (help) { console.log(HELP); return; }
  if (error) { console.error(`yeoshare: ${error}\n\n${HELP}`); process.exit(2); }
  const file = realpathSync(options.file);
  const slug = slugFor(file);
  const keys = readKeys();
  const headers = {
    Authorization: `Bearer ${keys.SHARE_TOKEN}`,
    'CF-Access-Client-Id': keys.CF_ACCESS_CLIENT_ID,
    'CF-Access-Client-Secret': keys.CF_ACCESS_CLIENT_SECRET,
    'Content-Type': contentType(slug) || 'application/octet-stream',
    'X-Project': options.project || repoName(file),
  };
  if (options.title) headers['X-Title'] = options.title;
  if (options.date) headers['X-Date'] = options.date;
  const response = await fetch(`https://yeoux.net/${options.section}/${slug}`, { method: 'PUT', headers, body: readFileSync(file) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { console.error(`yeoshare: upload failed (${response.status}) ${body.error || ''}`); process.exit(1); }
  console.log(body.url);
}

if (import.meta.url === `file://${realpathSync(process.argv[1])}`) await main();
