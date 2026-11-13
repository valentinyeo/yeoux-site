import { SECTIONS, indexItems, listAll } from './content.mjs';

export const CORE = [
  { title: 'Software Factory', items: [
    { name: 'Runners', line: 'Who is building what right now, and who is idle.', href: '/reports/a41914ac-runner-board.html' },
    { name: 'Control room', line: 'Every timer and job, and which ones are broken.', href: '/reports/7c6e2ee0-control-room.html' },
    { name: 'Usage', line: 'How much of each Claude and Codex plan is used, against time.', href: '/reports/4180dee3-subscription-pacing.html' },
    { name: 'Factory performance', line: 'Pull requests shipped and tickets handled, hour by hour.', href: '/reports/c65b9a8c-productivity.html' },
    { name: 'CI performance', line: 'How long checks take and how often they fail.', match: '^CI performance' },
    { name: 'Check wait', line: 'How long pull requests wait for their checks.', href: '/reports/eb9c1c8d-factory-check-wait.html' },
    { name: 'Heavy tickets', line: 'Tickets that took many runner runs, by cause and time window.', href: '/reports/17c95ef7-heavy.html' },
    { name: 'Changes shipped', line: 'What went live, newest first.', href: '/reports/1f3069d2-shipping.html' },
    { name: 'Fleet plan', line: 'The active factory design and who is in it.', href: '/reports/38361bb7-fleet-shape.html' },
  ] },
  { title: 'Money', items: [
    { name: 'Finance triage', line: 'The latest morning money check.', match: '^Finance triage' },
    { name: 'Cost monitor', line: 'Spend leaks, checked every hour.', href: '/reports/492a8f4d-cost-monitor.html' },
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
      items: cluster.items.map(entry => ({ name: entry.name, line: entry.line, href: href(entry) })).filter(entry => entry.href),
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
