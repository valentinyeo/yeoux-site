import { SECTIONS, indexItems, listAll } from './content.mjs';

export const CORE = [
  { title: 'Software Factory', items: [
    { name: 'Runners', href: '/reports/a41914ac-runner-board.html' },
    { name: 'Usage', href: '/reports/4180dee3-subscription-pacing.html' },
    { name: 'Factory performance', href: '/reports/c65b9a8c-productivity.html' },
    { name: 'CI performance', match: '^CI performance' },
    { name: 'Check wait', href: '/reports/eb9c1c8d-factory-check-wait.html' },
    { name: 'Changes shipped', href: '/reports/1f3069d2-shipping.html' },
  ] },
  { title: 'Money', items: [
    { name: 'Finance triage', match: '^Finance triage' },
    { name: 'Cost monitor', href: '/reports/492a8f4d-cost-monitor.html' },
  ] },
];

export function resolveCore(items, core = CORE) {
  const href = entry => {
    if (entry.href) return entry.href;
    const pattern = new RegExp(entry.match, 'i');
    const found = items.find(item => pattern.test(item.title));
    return found ? `/reports/${found.slug}` : null;
  };
  return core
    .map(cluster => ({
      title: cluster.title,
      items: cluster.items.map(entry => ({ name: entry.name, href: href(entry) })).filter(entry => entry.href),
    }))
    .filter(cluster => cluster.items.length);
}

let cache = { at: 0, value: null };

export async function loadCore(bucket, now = Date.now()) {
  if (cache.value && now - cache.at < 60000) return cache.value;
  let value;
  try {
    const { prefix } = SECTIONS.reports;
    value = resolveCore(indexItems(await listAll(bucket, prefix), prefix));
  } catch {
    return resolveCore([]);
  }
  cache = { at: now, value };
  return value;
}
