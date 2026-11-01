import { env } from 'cloudflare:workers';
import { getCatalog, putCatalog } from '../../../../lib/dash.mjs';

export const prerender = false;

export const GET = ({ params }) => getCatalog(env.CONTENT, 'ai-movers', params.date || '');

export const PUT = ({ params, request }) => putCatalog(env.CONTENT, request, 'ai-movers', params.date || '', env.SHARE_TOKEN);

export const ALL = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, PUT' } });
