(() => {
  let saved;
  try { saved = localStorage.getItem('ht-theme'); } catch {}
  const preference = saved === 'light' || saved === 'dark' ? saved : 'system';
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
})();
