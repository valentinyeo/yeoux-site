const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const safeHref = value => /^(https?:\/\/|\/(?!\/)|\.\.?\/|#)/i.test(value) ? escape(value) : '#';
export const themeButton = `<button class="ht-theme-toggle" type="button" data-theme-toggle aria-label="Switch color mode" title="Switch color mode">
  <svg class="ht-moon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M20.7 13a8.7 8.7 0 0 1-9.7-9.7A8.8 8.8 0 1 0 20.7 13Z"/></svg>
  <svg class="ht-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
  <span class="ht-theme-dark">Dark mode</span><span class="ht-theme-light">Light mode</span>
</button>`;
export function renderNavigation({ brand = 'Yeo UX', home = '/', sections = [], active = '' } = {}) {
  const exact = sections.some(([, links]) => links.some(([href]) => href === active));
  const current = href => exact ? href === active : href !== '/' && active.startsWith(href + '/');
  const link = ([href, label]) => `<li><a href="${safeHref(href)}"${current(href) ? ' aria-current="page"' : ''}>${escape(label)}</a></li>`;
  const items = sections.map(([heading, links]) => (heading ? `<li class="ht-heading">${escape(heading)}</li>` : '') + links.map(link).join('')).join('') + `<li class="ht-heading">Display</li><li>${themeButton}</li>`;
  return `<nav class="ht-nav" data-site-nav data-site-menu aria-label="Primary">
    <details class="ht-mobile"><summary aria-label="Open navigation menu"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></summary><ul class="ht-mobile-items">${items}</ul></details>
    <a class="ht-brand" href="${safeHref(home)}"${active === home ? ' aria-current="page"' : ''}>${escape(brand)}</a>
  </nav>`;
}
