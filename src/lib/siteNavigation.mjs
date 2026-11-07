import { renderNavigation } from '../../public/theme/v1/navigation.mjs';
import { resolveCore } from './coreReports.mjs';

export const siteNavigation = (active, core = resolveCore([])) => renderNavigation({
  brand: 'Yeo UX',
  active,
  sections: [
    ...core.map(cluster => [cluster.title, cluster.items.map(entry => [entry.href, entry.name])]),
    ['More', [['/reports', 'All reports'], ['/explorations', 'Explorations'], ['/dash', 'Dash']]],
  ],
});
