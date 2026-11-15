#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ACCESS_HEADER = 'Cf-Access-Authenticated-User-Email';
export const ACCESS_EMAIL = 'verifier@example.invalid';
const MAX_TEXT = 4000;
const MAX_BODY = 2000;

const actions = ['open', 'text', 'links', 'http', 'click', 'fill', 'drag', 'eval', 'viewport', 'screenshot'];

export function parseArgs(argv) {
  const positional = [];
  const flags = { header: [], width: 1280, height: 900, expect: null, expectStatus: null, data: null, screenshot: null };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = () => {
      index++;
      if (index >= argv.length) throw new Error(`--${name} needs a value`);
      return argv[index];
    };
    if (name === 'header') flags.header.push(next());
    else if (name === 'width') flags.width = Number(next());
    else if (name === 'height') flags.height = Number(next());
    else if (name === 'expect') flags.expect = next();
    else if (name === 'expect-status') flags.expectStatus = Number(next());
    else if (name === 'data') flags.data = next();
    else if (name === 'screenshot') flags.screenshot = next();
    else throw new Error(`unknown flag --${name}`);
  }
  return { positional, flags };
}

function headers(flags) {
  const out = {};
  for (const raw of flags.header) {
    const index = raw.indexOf(':');
    if (index < 1) throw new Error(`header must look like "Name: value", received ${raw}`);
    out[raw.slice(0, index).trim()] = raw.slice(index + 1).trim();
  }
  return out;
}

export function visibleText(source) {
  return String(source)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function title(source) {
  return /<title>([\s\S]*?)<\/title>/i.exec(source)?.[1]?.trim() || '';
}

function links(source) {
  const found = [];
  for (const match of String(source).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href="([^"]*)"/i.exec(match[1])?.[1] || '';
    const current = /aria-current="page"/i.test(match[1]);
    found.push({ href, text: visibleText(match[2]).slice(0, 120), current });
  }
  return found;
}

async function fetchPage(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(url, { redirect: 'follow', signal: controller.signal, ...options });
  } finally {
    clearTimeout(timer);
  }
}

async function httpAction(spec, flags) {
  const [method, url] = spec;
  if (!method || !url) throw new Error('usage: drive.mjs http <METHOD> <url>');
  const init = { method: method.toUpperCase(), headers: headers(flags) };
  if (flags.data !== null) init.body = flags.data;
  const response = await fetchPage(url, init);
  const body = await response.text();
  const picked = {};
  for (const name of ['cache-control', 'content-type', 'location', 'allow', 'content-length']) {
    const value = response.headers.get(name);
    if (value) picked[name] = value;
  }
  return { status: response.status, url, method: init.method, headers: picked, body: body.slice(0, MAX_BODY), text: visibleText(body).slice(0, MAX_TEXT) };
}

async function readAction(url, flags, mode) {
  if (!url) throw new Error(`usage: drive.mjs ${mode} <url>`);
  const response = await fetchPage(url);
  const body = await response.text();
  const result = { status: response.status, url, title: title(body), bytes: body.length, text: visibleText(body).slice(0, MAX_TEXT) };
  if (mode === 'links') result.links = links(body);
  if (mode === 'open') result.cacheControl = response.headers.get('cache-control') || '';
  return result;
}

async function launch() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error('browser actions need playwright: run npm ci in this checkout');
  }
  return chromium.launch({ headless: true });
}

async function withPage(flags, run) {
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: Number(flags.width) || 1280, height: Number(flags.height) || 900 },
      extraHTTPHeaders: { [ACCESS_HEADER]: ACCESS_EMAIL },
    });
    const page = await context.newPage();
    return await run(page, context);
  } finally {
    await browser.close();
  }
}

async function settle(page) {
  await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function pageState(page) {
  return {
    url: page.url(),
    title: await page.title(),
    theme: await page.evaluate(() => document.documentElement.dataset.theme || ''),
    text: (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
  };
}

async function goTo(page, url) {
  if (!url) throw new Error('a url is required');
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await settle(page);
}

async function browserAction(action, spec, flags) {
  if (action === 'click') {
    const [url, selector] = spec;
    return withPage(flags, async page => {
      await goTo(page, url);
      await page.locator(selector).first().click({ timeout: 10000 });
      await settle(page);
      return { ...(await pageState(page)), clicked: selector };
    });
  }
  if (action === 'fill') {
    const [url, selector, value] = spec;
    return withPage(flags, async page => {
      await goTo(page, url);
      await page.locator(selector).first().fill(value ?? '', { timeout: 10000 });
      await settle(page);
      return { ...(await pageState(page)), filled: selector, value };
    });
  }
  if (action === 'drag') {
    const [url, from, to] = spec;
    return withPage(flags, async page => {
      await goTo(page, url);
      const positions = async () => page.evaluate(() => [...document.querySelectorAll('[data-board] [data-story-id]')].map(card => `${card.querySelector('[data-pos]')?.textContent || ''}:${card.getAttribute('data-story-id')}`));
      const before = await positions();
      await page.locator(from).first().dragTo(page.locator(to).first(), { timeout: 10000 });
      await settle(page);
      return { ...(await pageState(page)), before, after: await positions() };
    });
  }
  if (action === 'eval') {
    const [url, expression] = spec;
    if (!expression) throw new Error('usage: drive.mjs eval <url> <expression>');
    return withPage(flags, async page => {
      await goTo(page, url);
      const value = await page.evaluate(expression);
      return { url, value };
    });
  }
  if (action === 'viewport') {
    const [url] = spec;
    return withPage({ ...flags, width: flags.width, height: flags.height }, async page => {
      await goTo(page, url);
      const metrics = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        menuVisible: Boolean(document.querySelector('[data-site-nav] details summary')),
        boardVisible: Boolean(document.querySelector('[data-board]')),
      }));
      const result = { url, viewport: { width: Number(flags.width), height: Number(flags.height) }, ...metrics, overflow: metrics.scrollWidth > metrics.clientWidth };
      await attachScreenshot(page, flags, result);
      return result;
    });
  }
  if (action === 'screenshot') {
    const [url, target] = spec;
    return withPage(flags, async page => {
      await goTo(page, url);
      return attachScreenshot(page, { ...flags, screenshot: target || flags.screenshot }, { url });
    });
  }
  throw new Error(`unknown action ${action}`);
}

async function attachScreenshot(page, flags, result) {
  if (!flags.screenshot) return result;
  const scratch = process.env.PSTACK_SCRATCH;
  const target = path.resolve(flags.screenshot);
  if (scratch && !target.startsWith(path.resolve(scratch) + path.sep)) throw new Error('screenshots must be written inside PSTACK_SCRATCH');
  mkdirSync(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
  return { ...result, screenshot: target };
}

function assertExpectations(result, flags) {
  const notes = [];
  if (flags.expectStatus !== null && result.status !== flags.expectStatus) {
    notes.push(`expected status ${flags.expectStatus}, received ${result.status}`);
  }
  if (flags.expect) {
    const haystack = JSON.stringify(result);
    if (!haystack.includes(flags.expect)) notes.push(`expected text not found: ${flags.expect}`);
  }
  if (!notes.length) return { ...result, ok: true };
  return { ...result, ok: false, failures: notes };
}

export async function main(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  const action = positional[0];
  if (!actions.includes(action)) throw new Error(`usage: drive.mjs <${actions.join('|')}> ...`);
  const spec = positional.slice(1);
  let result;
  if (action === 'open' || action === 'text' || action === 'links') result = await readAction(spec[0], flags, action);
  else if (action === 'http') result = await httpAction(spec, flags);
  else result = await browserAction(action, spec, flags);
  const checked = assertExpectations(result, flags);
  writeFileSync(1, `${JSON.stringify(checked)}\n`);
  if (checked.ok === false) process.exitCode = 1;
  return checked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    writeFileSync(1, `${JSON.stringify({ ok: false, error: error.message })}\n`);
    process.exitCode = 1;
  }
}
