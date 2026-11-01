import { renderNavigation } from '../../public/theme/v1/navigation.mjs';
export const siteNavigation = active => renderNavigation({ brand: 'Yeo UX', active, links: [['/dash', 'Dash'], ['/explorations', 'Explorations'], ['/reports', 'Reports']] });
