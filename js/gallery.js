const STORAGE_KEY = 'cryon-gallery-artworks';
const MAX_ITEMS = 12;

export function loadArtworks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveArtworks(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderCard(artwork) {
  const date = formatDate(artwork.createdAt);
  return `
    <article class="collection-card collection-card--user" data-id="${artwork.id}">
      <div class="collection-card__image">
        <img src="${artwork.imageData}" alt="${escapeHtml(artwork.title)}" loading="lazy">
      </div>
      <div class="collection-card__body">
        <span class="collection-tag tag-sketch">Studio sketch</span>
        <h3>${escapeHtml(artwork.title)}</h3>
        <p>${escapeHtml(artwork.description)}</p>
        <div class="collection-meta">
          <span>Pastel on textured paper</span>
          <span>${date}</span>
        </div>
      </div>
    </article>
  `;
}

export function renderUserGallery(items = loadArtworks()) {
  const wrap = document.getElementById('user-gallery-wrap');
  const grid = document.getElementById('user-collection-grid');
  if (!wrap || !grid) return;

  if (!items.length) {
    wrap.hidden = true;
    grid.innerHTML = '';
    return;
  }

  wrap.hidden = false;
  grid.innerHTML = items.map(renderCard).join('');
}

export function addArtwork(artwork) {
  const items = loadArtworks();
  items.unshift(artwork);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  saveArtworks(items);
  renderUserGallery(items);
  return artwork;
}

document.addEventListener('DOMContentLoaded', () => {
  renderUserGallery();
});
