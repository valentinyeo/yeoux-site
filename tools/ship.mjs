#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACCOUNT = '7865043d9ae730882b77f3d5d670c158';

export async function main(run = execFileSync, fetchImpl = fetch) {
  const command = (file, args, options = {}) => {
    try {
      return run(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options });
    } catch {
      throw new Error(`${file} ${file === 'yeo-key' ? 'deployment/status' : args.join(' ')} failed`);
    }
  };
  command('git', ['fetch', 'origin'], { stdio: 'inherit' });
  if (command('git', ['status', '--porcelain']).trim()) throw new Error('working tree must be clean before shipping');
  const sha = command('git', ['rev-parse', 'HEAD']).trim();
  if (sha !== command('git', ['rev-parse', 'origin/main']).trim()) throw new Error('HEAD must equal origin/main before shipping');
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) throw new Error('git returned an invalid HEAD sha');

  command('npm', ['ci'], { stdio: 'inherit' });
  const help = command('npx', ['wrangler', 'deploy', '--help']);
  if (!/--message\b/.test(help)) throw new Error('installed Wrangler must support deploy --message');
  command('npm', ['run', 'check'], { stdio: 'inherit' });
  command('npm', ['run', 'build'], { stdio: 'inherit' });

  const script = `set -e
export CLOUDFLARE_API_TOKEN="$credential"
export CLOUDFLARE_ACCOUNT_ID=${ACCOUNT}
npx wrangler deploy --message ${sha} >&2
npx wrangler deployments status --json`;
  const output = command('yeo-key', ['--env', 'Hetzner Wrangler All Access', '--', 'bash', '-c', script]);
  let status;
  try {
    status = JSON.parse(output);
  } catch {
    throw new Error('Wrangler deployment status did not return valid JSON');
  }
  if (status?.annotations?.['workers/message'] !== sha) throw new Error('deployment message does not match HEAD');
  const version = status.versions?.[0]?.version_id;
  if (typeof version !== 'string' || !version) throw new Error('deployment status is missing its version id');

  const response = await fetchImpl('https://yeoux.net/', { redirect: 'manual' });
  const location = response.headers.get('Location') || '';
  await response.body?.cancel();
  if (response.status !== 302 || !location.includes('cloudflareaccess.com')) throw new Error(`live site must redirect to Zero Trust (received ${response.status})`);
  console.log(`shipped ${sha} version ${version}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(`ship: ${error.message}`);
    process.exitCode = 1;
  }
}
