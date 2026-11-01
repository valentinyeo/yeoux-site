import { env } from 'cloudflare:workers';
import { putOrder } from '../../../../lib/dash.mjs';

export const prerender = false;

export const PUT = ({ params, request }) => putOrder(env.CONTENT, request, 'ai-movers', params.date || '');

export const ALL = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'PUT' } });
