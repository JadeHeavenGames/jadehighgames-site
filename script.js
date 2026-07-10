const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 16);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});

menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menu.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.querySelectorAll('[data-year]').forEach((element) => { element.textContent = new Date().getFullYear(); });

const catalogGrid = document.querySelector('[data-game-grid]');
const catalogStatus = document.querySelector('[data-catalog-status]');
const catalogCount = document.querySelector('[data-game-count]');
const catalogSyncDate = document.querySelector('[data-sync-date]');

const renderCatalog = async () => {
  if (!catalogGrid) return;

  try {
    const response = await fetch('games.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.games) || !catalog.games.length) throw new Error('Catalog has no games');

    const fragment = document.createDocumentFragment();
    catalog.games.forEach((game) => {
      const card = document.createElement('article');
      card.className = 'catalog-card';

      const link = document.createElement('a');
      link.href = game.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `${game.name} on Google Play`);

      const media = document.createElement('div');
      media.className = 'catalog-card-media';
      const image = document.createElement('img');
      image.src = game.image;
      image.alt = `${game.name} game artwork`;
      image.loading = 'lazy';
      image.width = 832;
      image.height = 470;
      media.append(image);

      const body = document.createElement('div');
      body.className = 'catalog-card-body';
      const label = document.createElement('small');
      label.textContent = 'JadeHigh Games';
      const title = document.createElement('h3');
      title.textContent = game.name;
      const packageId = document.createElement('code');
      packageId.textContent = game.packageId;
      const action = document.createElement('b');
      action.textContent = 'Google Play \u2197';
      body.append(label, title, packageId, action);

      link.append(media, body);
      card.append(link);
      fragment.append(card);
    });

    catalogGrid.replaceChildren(fragment);
    catalogStatus.hidden = true;
    catalogCount.textContent = `${catalog.games.length} games`;
    const synced = new Date(catalog.syncedAt);
    catalogSyncDate.textContent = Number.isNaN(synced.valueOf())
      ? 'Automatically synced from Google Play'
      : `Catalog synced ${synced.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`;
  } catch (error) {
    catalogStatus.textContent = 'The automatic catalog is temporarily unavailable. Please use the live Google Play developer page below.';
    catalogCount.textContent = 'Catalog unavailable';
    catalogSyncDate.textContent = 'Google Play remains available';
  }
};

renderCatalog();
