import { env } from 'cloudflare:workers';
import { deleteItem, getItem, isValidSlug, putItem } from './content.mjs';
import { withArtifactTheme } from './artifactTheme.mjs';
import { loadCore } from './coreReports.mjs';

const invalid = () => Response.json({ error: 'Invalid slug' }, { status: 400 });

export const sectionRoutes = section => ({
  PUT: ({ params, request }) => isValidSlug(params.slug || '') ? putItem(env.CONTENT, request, section, params.slug, env.SHARE_TOKEN) : invalid(),
  DELETE: ({ params, request }) => isValidSlug(params.slug || '') ? deleteItem(env.CONTENT, request, section, params.slug, env.SHARE_TOKEN) : invalid(),
  GET: async ({ params }) => isValidSlug(params.slug || '') ? withArtifactTheme(await getItem(env.CONTENT, section, params.slug), `/${section}/${params.slug}`, await loadCore(env.CONTENT)) : invalid(),
  ALL: () => new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, PUT, DELETE' } }),
});
