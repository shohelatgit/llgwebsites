(() => {
  const meta = document.querySelector('meta[name="site-preview-path"]');
  const match = window.location.pathname.match(/^\/__site__\/[^/]+(\/.*)?$/);
  if (meta) meta.content = match?.[1] || '/';
})();
