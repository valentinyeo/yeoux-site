import { renderNavigation } from '../../public/theme/v1/navigation.mjs';
import { resolveCore } from './coreReports.mjs';

export const QUICK = { name: 'Factory performance', href: '/reports/c65b9a8c-productivity.html' };

export const siteNavigation = (active, core = resolveCore([])) => renderNavigation({
  brand: QUICK.name,
  home: QUICK.href,
  active,
  sections: [
    ...core
      .map(cluster => [cluster.title, cluster.items.filter(entry => entry.href !== QUICK.href).map(entry => [entry.href, entry.name])])
      .filter(([, links]) => links.length),
    ['More', [['/', 'Home'], ['/reports', 'All reports'], ['/explorations', 'Explorations'], ['/dash', 'Dash']]],
  ],
});
