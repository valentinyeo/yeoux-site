(() => {
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  function apply(preference) {
    root.dataset.themePreference = preference;
    const dark = preference === 'system' ? system.matches : preference === 'dark';
    root.dataset.theme = dark ? 'dark' : 'light';
    buttons.forEach(button => {
      const label = `Switch to ${dark ? 'light' : 'dark'} mode`;
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
  }
  apply(root.dataset.themePreference || 'system');
  buttons.forEach(button => button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('ht-theme', next); } catch {}
  }));
  system.addEventListener('change', () => {
    if (root.dataset.themePreference === 'system') apply('system');
  });
  window.addEventListener('storage', event => {
    if (event.key === 'ht-theme' || event.key === null) {
      apply(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system');
    }
  });
  window.addEventListener('beforeprint', () => { root.dataset.theme = 'light'; });
  window.addEventListener('afterprint', () => { apply(root.dataset.themePreference || 'system'); });
  const slot = document.querySelector('body > [data-nav-slot]');
  const nav = document.querySelector('[data-site-nav]');
  if (slot && nav) nav.appendChild(slot);
  const menus = [...document.querySelectorAll('[data-site-nav] details')];
  menus.forEach(menu => menu.addEventListener('toggle', () => {
    if (menu.open) menus.forEach(other => {
      if (other !== menu && !other.contains(menu) && !menu.contains(other)) other.open = false;
    });
  }));
  document.addEventListener('click', event => {
    menus.forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const menu = document.activeElement?.closest('[data-site-nav] details[open]');
    menus.forEach(item => { item.open = false; });
    menu?.querySelector('summary')?.focus();
  });
})();
