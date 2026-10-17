import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { legacyRedirect } from './lib/content.mjs';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  if (url.hostname === 'admin.yeoux.net' && env.YESI_1_REDIRECTS === '1') {
    if (url.pathname === '/') return Response.redirect('https://yeoux.net/', 301);
    const target = await legacyRedirect(env.CONTENT, url.pathname);
    return target ? Response.redirect(target, 301) : new Response('Not found', { status: 404 });
  }
  const response = await next();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
