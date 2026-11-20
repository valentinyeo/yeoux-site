import { parse, parseFragment, serialize } from 'parse5';
import { siteNavigation } from './siteNavigation.mjs';

const marker = '<!--ht-theme-v1-->';
const MAX_BUFFERED_HTML_BYTES = 1024 * 1024;
const assets = `<script src="/theme/v1/init.js"></script><link rel="stylesheet" href="/theme/v1/theme.css"><link rel="stylesheet" href="/theme/v1/legacy.css"><script src="/theme/v1/theme.js" defer></script>`;
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
const isSiteMenu = node => attr(node, 'data-site-menu') !== undefined;
const hasSiteMenu = node => (node.childNodes || []).some(child => isSiteMenu(child) || hasSiteMenu(child));
const dropNavPlaceholders = node => {
  if (!node.childNodes) return;
  node.childNodes = node.childNodes.filter(child => attr(child, 'data-site-nav') === undefined || isSiteMenu(child));
  node.childNodes.forEach(child => { child.parentNode = node; dropNavPlaceholders(child); });
};
const supportedCharset = value => !value || /^(?:utf-?8|us-ascii)$/i.test(value.trim());
const headerCharset = value => /charset\s*=\s*["']?([^;\s"']+)/i.exec(value)?.[1];

export function themeArtifactHtml(source, active = '/explorations', core) {
  const document = parse(source);
  const html = document.childNodes.find(node => node.tagName === 'html');
  const head = html.childNodes.find(node => node.tagName === 'head');
  const body = html.childNodes.find(node => node.tagName === 'body');
  if (!body) return null;
  const metas = head.childNodes.filter(node => node.tagName === 'meta');
  if (metas.some(node => !supportedCharset(attr(node, 'charset') || headerCharset(attr(node, 'content') || '')))) return null;
  if (attr(html, 'data-ht-artifact') !== undefined && hasSiteMenu(body)) return source;

  const children = body.childNodes;
  for (let index = 0; index < children.length; index++) {
    if (children[index].nodeName !== '#comment' || children[index].data.trim() !== 'ht-nav') continue;
    const next = start => { while (children[start]?.nodeName === '#text' && !children[start].value.trim()) start++; return start; };
    const style = next(index + 1), header = next(style + 1);
    if (children[style]?.tagName === 'style' && children[header]?.tagName === 'header' && attr(children[header], 'class')?.split(/\s+/).includes('ht-site-nav')) {
      children.splice(index, header - index + 1);
      break;
    }
  }
  dropNavPlaceholders(body);
  if (attr(html, 'data-ht-artifact') === undefined) html.attrs.push({ name: 'data-ht-artifact', value: '' });
  const viewport = metas.some(node => attr(node, 'name')?.toLowerCase() === 'viewport') ? '' : '<meta name="viewport" content="width=device-width,initial-scale=1">';
  const headNodes = parseFragment(viewport + assets).childNodes;
  headNodes.forEach(node => { node.parentNode = head; });
  head.childNodes.push(...headNodes);
  const navNodes = parseFragment(marker + siteNavigation(active, core)).childNodes;
  navNodes.forEach(node => { node.parentNode = body; });
  body.childNodes.unshift(...navNodes);
  return serialize(document);
}

export async function withArtifactTheme(response, active, core) {
  if (!response.ok || response.body === null) return response;
  const type = response.headers.get('Content-Type') || '';
  if (!/^text\/html(?:\s*;|\s*$)/i.test(type) || !supportedCharset(headerCharset(type))) return response;
  if (Number(response.headers.get('Content-Length')) > MAX_BUFFERED_HTML_BYTES) {
    let hasAssets = false;
    let viewport = false;
    return new HTMLRewriter()
      .on('html', { element(element) {
        if (!element.hasAttribute('data-ht-artifact')) element.setAttribute('data-ht-artifact', '');
      } })
      .on('meta[name="viewport"]', { element() { viewport = true; } })
      .on('link[href="/theme/v1/theme.css"]', { element() { hasAssets = true; } })
      .on('head', { element(element) {
        element.onEndTag(end => {
          if (!hasAssets) end.before((viewport ? '' : '<meta name="viewport" content="width=device-width,initial-scale=1">') + assets, { html: true });
        });
      } })
      .on('body', { element(element) {
        element.prepend(marker + siteNavigation(active, core), { html: true });
      } })
      .on('header.ht-site-nav', { element(element) { element.remove(); } })
      .on('[data-site-nav]', { element(element) { if (!element.hasAttribute('data-site-menu')) element.remove(); } })
      .transform(response);
  }
  const bytes = await response.arrayBuffer();
  const original = () => new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return original(); }
  const html = themeArtifactHtml(source, active, core);
  if (html === null) return original();
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  headers.delete('ETag');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
