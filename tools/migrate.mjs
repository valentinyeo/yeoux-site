#!/usr/bin/env node
import { legacySection, legacySlug } from '../src/lib/content.mjs';

export const ACCOUNT = '7865043d9ae730882b77f3d5d670c158';
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets`;

export function planMigration(objects) {
  const seen = new Map();
  return objects.map(object => {
    const slug = legacySlug(object.key);
    if (!slug) return { key: object.key, error: 'not a yeoshare key' };
    if (seen.has(slug)) return { key: object.key, error: `slug clash with ${seen.get(slug)}` };
    seen.set(slug, object.key);
    return { key: object.key, section: legacySection(object.key), slug, date: String(object.last_modified || object.uploaded || '').slice(0, 10) };
  });
}

export async function listBucket(bucket, token, fetchImpl = fetch) {
  const objects = [];
  let cursor = '';
  do {
    const response = await fetchImpl(`${API}/${bucket}/objects?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!body.success) throw new Error(`listing ${bucket} failed: ${JSON.stringify(body.errors)}`);
    objects.push(...body.result);
    cursor = body.result_info?.is_truncated ? body.result_info.cursor : '';
  } while (cursor);
  return objects;
}

async function main() {
  const [from, mode] = process.argv.slice(2);
  if (!from) { console.error('Usage: tools/migrate.mjs <old bucket> [--apply]'); process.exit(2); }
  const { CLOUDFLARE_API_TOKEN: token, SHARE_TOKEN, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET } = process.env;
  const plan = planMigration(await listBucket(from, token));
  const bad = plan.filter(item => item.error);
  for (const item of plan) console.log(item.error ? `SKIP ${item.key}: ${item.error}` : `${item.section.padEnd(12)} ${item.key} -> ${item.slug}`);
  if (bad.length) { console.error(`${bad.length} items cannot move; fix the mapping first.`); process.exit(1); }
  if (mode !== '--apply') { console.log(`Dry run: ${plan.length} items. Add --apply to copy them.`); return; }
  for (const item of plan) {
    const source = await fetch(`${API}/${from}/objects/${item.key.split('/').map(encodeURIComponent).join('/')}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!source.ok) throw new Error(`reading ${item.key} failed: ${source.status}`);
    const target = await fetch(`https://yeoux.net/${item.section}/${item.slug}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SHARE_TOKEN}`,
        'CF-Access-Client-Id': CF_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': CF_ACCESS_CLIENT_SECRET,
        'Content-Type': source.headers.get('Content-Type') || 'application/octet-stream',
        'X-Legacy-Key': item.key,
        ...(item.date ? { 'X-Date': item.date } : {}),
      },
      body: await source.arrayBuffer(),
    });
    if (!target.ok) throw new Error(`writing ${item.slug} failed: ${target.status}`);
    console.log(`copied ${item.key}`);
  }
  console.log(`Copied ${plan.length} items. The old bucket is untouched.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
