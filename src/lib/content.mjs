export const SECTIONS = {
  explorations: { prefix: 'x/', title: 'Explorations' },
  reports: { prefix: 'r/', title: 'Reports' },
};

const SLUG_PATTERN = /^[A-Za-z0-9._-]{1,120}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidSlug = slug => SLUG_PATTERN.test(slug);

export const contentType = slug => {
  const ext = slug.toLowerCase().split('.').pop();
  return {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
    md: 'text/markdown; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    mp4: 'video/mp4',
  }[ext] || null;
};

export function legacySlug(legacyKey) {
  const match = /^p\/([0-9a-f]{8})\/(.+)$/.exec(legacyKey);
  if (!match) return null;
  const name = match[2].replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : '';
  const stem = (ext ? name.slice(0, dot) : name).replace(/-+$/, '') || 'file';
  return `${match[1]}-${stem.slice(0, 110 - ext.length)}${ext}`;
}

export function legacySection(legacyKey) {
  const name = legacyKey.split('/').pop().toLowerCase();
  return /report|status|audit|review|summary|weekly|monthly/.test(name) ? 'reports' : 'explorations';
}

export function titleFromSlug(slug) {
  const stem = slug.replace(/^[0-9a-f]{8}-/, '').replace(/\.[A-Za-z0-9]{1,5}$/, '');
  const words = stem.replace(/[-_.]+/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : slug;
}

export function uploadMetadata(headers, now = new Date()) {
  const read = name => (headers.get(name) || '').trim().slice(0, 200);
  const date = read('X-Date');
  if (date && !DATE_PATTERN.test(date)) return { error: 'X-Date must look like 2026-10-17' };
  const project = read('X-Project').toLowerCase();
  if (project && !/^[a-z0-9-]{1,40}$/.test(project)) return { error: 'X-Project must be lowercase letters, digits and dashes' };
  const metadata = { date: date || now.toISOString().slice(0, 10) };
  const title = read('X-Title');
  if (title) metadata.title = title;
  if (project) metadata.project = project;
  const legacy = read('X-Legacy-Key');
  if (legacy) metadata.legacy = legacy;
  return { metadata };
}

export function indexItems(objects, prefix) {
  return objects
    .map(object => {
      const slug = object.key.slice(prefix.length);
      const meta = object.customMetadata || {};
      const uploaded = new Date(object.uploaded);
      return {
        slug,
        title: meta.title || titleFromSlug(slug),
        project: meta.project || '',
        date: meta.date || uploaded.toISOString().slice(0, 10),
        uploaded,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.uploaded - a.uploaded);
}

export async function listAll(bucket, prefix) {
  const objects = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor, include: ['customMetadata'] });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return objects;
}

export async function putItem(bucket, request, section, slug, shareToken) {
  if (!shareToken || request.headers.get('Authorization') !== `Bearer ${shareToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = SECTIONS[section].prefix + slug;
  const url = `https://yeoux.net/${section}/${slug}`;
  if (request.body === null || request.headers.get('Content-Length') === '0') {
    await bucket.delete(key);
    return Response.json({ deleted: true, url });
  }
  const { metadata, error } = uploadMetadata(request.headers);
  if (error) return Response.json({ error }, { status: 400 });
  await bucket.put(key, request.body, {
    httpMetadata: { contentType: contentType(slug) || request.headers.get('Content-Type') || 'application/octet-stream' },
    customMetadata: metadata,
  });
  return Response.json({ url });
}

export async function deleteItem(bucket, request, section, slug, shareToken) {
  if (!shareToken || request.headers.get('Authorization') !== `Bearer ${shareToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const key = SECTIONS[section].prefix + slug;
  if (!await bucket.head(key)) return Response.json({ error: 'Not found' }, { status: 404 });
  await bucket.delete(key);
  return Response.json({ deleted: true, url: `https://yeoux.net/${section}/${slug}` });
}

export async function getItem(bucket, section, slug) {
  const object = await bucket.get(SECTIONS[section].prefix + slug);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'Content-Type': contentType(slug) || object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function legacyRedirect(bucket, pathname) {
  const legacyKey = decodeURIComponent(pathname.slice(1));
  const slug = legacySlug(legacyKey);
  if (!slug) return null;
  for (const section of [legacySection(legacyKey), ...Object.keys(SECTIONS)]) {
    if (await bucket.head(SECTIONS[section].prefix + slug)) return `https://yeoux.net/${section}/${slug}`;
  }
  return null;
}
