export function initNavbar() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  const currentPath = window.location.pathname;

  nav.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (currentPath.endsWith(href.replace('./', '')) ||
        (href.includes('index') && (currentPath.endsWith('/') || currentPath.endsWith('/lovesite/')))) {
      link.classList.add('active');
    }
  });
}
