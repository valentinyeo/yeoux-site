import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sourcePath = value => nonempty(value) && !value.startsWith('/') && !value.includes('\\') && value.split('/').every(part => part && part !== '.' && part !== '..');

export function checkTransitionCoverage(plan, files) {
  const errors = [];
  if (!object(plan)) return ['Plan must be an object'];
  for (const name of ['ratStack', 'incumbent', 'plausible']) {
    if (!/^[a-f0-9]{40}$/.test(plan[name] || '')) errors.push(`${name} must pin one full commit`);
  }
  if (plan.ticket !== 'HYCI-361') errors.push('Plan must name HYCI-361');
  if (!Array.isArray(plan.slices) || !plan.slices.length) errors.push('Plan needs slices');
  if (!Array.isArray(plan.inventory) || !plan.inventory.length) errors.push('Plan needs inventory');
  if (errors.length) return errors;

  const slices = new Map();
  const tickets = new Set();
  for (const slice of plan.slices) {
    if (!object(slice) || !nonempty(slice.id) || !nonempty(slice.skill) || !Array.isArray(slice.dependsOn) || !slice.dependsOn.every(nonempty)) {
      errors.push('Each slice needs an id, skill and dependency list');
      continue;
    }
    if (slices.has(slice.id)) errors.push(`Duplicate slice ${slice.id}`);
    if (!/^HYCI-[0-9]+$/.test(slice.ticket || '') || slice.ticket === plan.ticket) errors.push(`${slice.id} needs its own child ticket`);
    if (tickets.has(slice.ticket)) errors.push(`Duplicate slice ticket ${slice.ticket}`);
    tickets.add(slice.ticket);
    slices.set(slice.id, slice);
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    if (visiting.has(id)) { errors.push(`Slice dependency cycle at ${id}`); return; }
    if (visited.has(id)) return;
    const slice = slices.get(id);
    if (!slice) { errors.push(`Unknown slice dependency ${id}`); return; }
    visiting.add(id);
    for (const dependency of slice.dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of slices.keys()) visit(id);

  const items = new Set();
  const owners = new Map();
  const tracked = new Set(files);
  if (!tracked.size) errors.push('Source inventory must not be empty');
  for (const item of plan.inventory) {
    if (!object(item) || !nonempty(item.id) || !nonempty(item.noun) || !Array.isArray(item.files) || !item.files.length) {
      errors.push('Each inventory item needs an id, noun and files');
      continue;
    }
    if (items.has(item.id)) errors.push(`Duplicate inventory item ${item.id}`);
    items.add(item.id);
    if (!slices.has(item.slice)) errors.push(`${item.id} has unknown owning slice ${item.slice}`);
    for (const file of item.files) {
      if (!sourcePath(file)) { errors.push(`${item.id} has invalid source path`); continue; }
      if (owners.has(file)) errors.push(`${file} has multiple owners: ${owners.get(file)}, ${item.id}`);
      owners.set(file, item.id);
      if (!tracked.has(file)) errors.push(`Planned source does not exist: ${file}`);
    }
  }
  for (const file of tracked) {
    if (!owners.has(file)) errors.push(`Unowned source: ${file}`);
  }
  return errors;
}

if (process.argv[1] && import.meta.url === `file://${realpathSync(process.argv[1])}`) {
  const plan = JSON.parse(readFileSync(new URL('../docs/ratstack-transition.json', import.meta.url), 'utf8'));
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const errors = checkTransitionCoverage(plan, files);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`TRANSITION_COVERAGE_OK ${files.length} files, ${plan.inventory.length} inventory items, ${plan.slices.length} slices`);
  }
}
