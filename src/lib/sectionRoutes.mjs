import { env } from 'cloudflare:workers';
import { getItem, isValidSlug, putItem } from './content.mjs';
import { withArtifactTheme } from './artifactTheme.mjs';

const invalid = () => Response.json({ error: 'Invalid slug' }, { status: 400 });

export const sectionRoutes = section => ({
  PUT: ({ params, request }) => isValidSlug(params.slug || '') ? putItem(env.CONTENT, request, section, params.slug, env.SHARE_TOKEN) : invalid(),
  GET: async ({ params }) => isValidSlug(params.slug || '') ? withArtifactTheme(await getItem(env.CONTENT, section, params.slug), `/${section}`) : invalid(),
  ALL: () => new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, PUT' } }),
});
