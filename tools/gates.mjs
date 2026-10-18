#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listBucket } from './migrate.mjs';
import { slugFor } from '../bin/yeoshare.mjs';

const env = process.env;
const access = { 'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID, 'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET };
const pass = (gate, detail) => { console.log(`${gate} PASS ${detail}`); };
const fail = (gate, detail) => { console.log(`${gate} FAIL ${detail}`); process.exitCode = 1; };

const indexCount = async section => {
  const html = await (await fetch(`https://yeoux.net/${section}`, { headers: access })).text();
  return (html.match(new RegExp(`href="/${section}/`, 'g')) || []).length;
};

export const gates = {
  async g1() {
    const old = await listBucket(env.OLD_BUCKET, env.CLOUDFLARE_API_TOKEN);
    if (!old.length) return fail('G1', 'old bucket is empty; no redirects verified');
    const broken = [];
    for (const { key } of old) {
      const first = await fetch(`https://admin.yeoux.net/${key.split('/').map(encodeURIComponent).join('/')}`, { headers: access, redirect: 'manual' });
      const target = first.headers.get('Location') || '';
      await first.body?.cancel();
      let landed = 0;
      if (first.status === 301 && target.startsWith('https://yeoux.net/')) {
        const response = await fetch(target, { headers: access, redirect: 'manual' });
        landed = response.status;
        await response.body?.cancel();
      }
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
    for (const pathname of ['/', '/explorations', '/reports']) {
      const response = await fetch(`https://yeoux.net${pathname}`, { redirect: 'manual' });
      const location = response.headers.get('Location') || '';
      await response.body?.cancel();
      if (response.status !== 302 || !location.includes('cloudflareaccess.com')) return fail('G3', `${pathname} got ${response.status} ${location}`);
    }
    const response = await fetch('https://yeoux.net/', { headers: access, redirect: 'manual' });
    await response.body?.cancel();
    response.status === 200 ? pass('G3', 'logged-out requests go to Zero Trust; service token receives 200') : fail('G3', `service token got ${response.status}`);
  },
  async g4() {
    const dir = mkdtempSync(path.join(tmpdir(), 'yeoux-g4-'));
    const title = `G4 check ${new Date().toISOString()}`;
    const file = path.join(dir, 'g4-check.html');
    writeFileSync(file, `<!doctype html><title>${title}</title><p>${title}</p>`);
    const url = `https://yeoux.net/explorations/${slugFor(file)}`;
    let uploaded = false;
    let elapsed;
    try {
      execFileSync(path.join(import.meta.dirname, '..', 'bin', 'yeoshare.mjs'), ['--title', title, '--project', 'yeoux-site', file], { stdio: 'inherit' });
      uploaded = true;
      const started = Date.now();
      while (Date.now() - started < 60000) {
        const html = await (await fetch('https://yeoux.net/explorations', { headers: access })).text();
        const first = /<tbody>[\s\S]*?<a[^>]*>([^<]*)<\/a>/.exec(html)?.[1];
        if (first === title) { elapsed = Math.round((Date.now() - started) / 1000); break; }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } finally {
      try {
        if (uploaded) {
          const response = await fetch(url, { method: 'PUT', headers: { ...access, Authorization: `Bearer ${env.SHARE_TOKEN}` }, body: '' });
          if (!response.ok || !(await response.json()).deleted) throw new Error('G4 fixture cleanup failed');
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    elapsed === undefined ? fail('G4', 'upload not first on /explorations within a minute') : pass('G4', `shown first after ${elapsed}s; test upload removed`);
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const chosen = process.argv.slice(2);
  for (const name of chosen.length ? chosen : Object.keys(gates)) {
    if (!gates[name]) { console.error(`unknown gate ${name}`); process.exit(2); }
    await gates[name]();
  }
}
