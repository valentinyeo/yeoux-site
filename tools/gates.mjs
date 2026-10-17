#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listBucket } from './migrate.mjs';

const env = process.env;
const access = { 'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET };
const pass = (gate, detail) => { console.log(`${gate} PASS ${detail}`); };
const fail = (gate, detail) => { console.log(`${gate} FAIL ${detail}`); process.exitCode = 1; };

const indexCount = async section => {
  const html = await (await fetch(`https://yeoux.net/${section}`, { headers: access })).text();
  return (html.match(new RegExp(`href="/${section}/`, 'g')) || []).length;
};

const gates = {
  async g1() {
    const old = await listBucket(env.OLD_BUCKET, env.CLOUDFLARE_API_TOKEN);
    const broken = [];
    for (const { key } of old) {
      const first = await fetch(`https://admin.yeoux.net/${key.split('/').map(encodeURIComponent).join('/')}`, { headers: access, redirect: 'manual' });
      const target = first.headers.get('Location') || '';
      const landed = first.status === 301 && target.startsWith('https://yeoux.net/') ? (await fetch(target, { headers: access, redirect: 'manual' })).status : 0;
      if (landed !== 200) broken.push(`${key} -> ${first.status} ${target} -> ${landed}`);
    }
    broken.length ? fail('G1', `${broken.length} of ${old.length} broken:\n${broken.join('\n')}`) : pass('G1', `${old.length} old URLs answer 301 to a live page`);
  },
  async g2() {
    const old = (await listBucket(env.OLD_BUCKET, env.CLOUDFLARE_API_TOKEN)).length;
    const fresh = (await listBucket('yeoux-site-content', env.CLOUDFLARE_API_TOKEN)).length;
    const shown = (await indexCount('explorations')) + (await indexCount('reports'));
    old === fresh && fresh === shown ? pass('G2', `${old} old = ${fresh} new = ${shown} listed`) : fail('G2', `${old} old, ${fresh} new, ${shown} listed`);
  },
  async g3() {
    const response = await fetch('https://yeoux.net/', { redirect: 'manual' });
    const location = response.headers.get('Location') || '';
    response.status === 302 && location.includes('cloudflareaccess.com') ? pass('G3', 'logged-out request goes to the Zero Trust login') : fail('G3', `got ${response.status} ${location}`);
  },
  async g4() {
    const dir = mkdtempSync(path.join(tmpdir(), 'yeoux-g4-'));
    const title = `G4 check ${new Date().toISOString()}`;
    const file = path.join(dir, 'g4-check.html');
    writeFileSync(file, `<!doctype html><title>${title}</title><p>${title}</p>`);
    execFileSync(path.join(import.meta.dirname, '..', 'bin', 'yeoshare.mjs'), ['--title', title, '--project', 'yeoux-site', file], { stdio: 'inherit' });
    const started = Date.now();
    while (Date.now() - started < 60000) {
      const html = await (await fetch('https://yeoux.net/explorations', { headers: access })).text();
      const first = /<tbody>[\s\S]*?<a[^>]*>([^<]*)<\/a>/.exec(html)?.[1];
      if (first === title) return pass('G4', `shown first after ${Math.round((Date.now() - started) / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    fail('G4', 'upload not first on /explorations within a minute');
  },
};

const chosen = process.argv.slice(2);
for (const name of chosen.length ? chosen : Object.keys(gates)) {
  if (!gates[name]) { console.error(`unknown gate ${name}`); process.exit(2); }
  await gates[name]();
}
