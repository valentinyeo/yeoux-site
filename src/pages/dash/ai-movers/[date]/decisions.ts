import { env } from 'cloudflare:workers';
import { getDecisions, postDecision } from '../../../../lib/dash.mjs';

export const prerender = false;

export const GET = ({ params }) => getDecisions(env.CONTENT, 'ai-movers', params.date || '');

export const POST = ({ params, request }) => postDecision(env.CONTENT, request, 'ai-movers', params.date || '');

export const ALL = () => new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
