import { sectionRoutes } from '../../lib/sectionRoutes.mjs';

export const prerender = false;
export const { PUT, DELETE, GET, ALL } = sectionRoutes('explorations');
