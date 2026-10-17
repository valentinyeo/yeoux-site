import { renderNavigation } from '../../public/theme/v1/navigation.mjs';
export const siteNavigation = active => renderNavigation({ brand: 'Yeo UX', active, links: [['/explorations', 'Explorations'], ['/reports', 'Reports']] });
