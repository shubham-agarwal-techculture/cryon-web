const STORAGE_KEY = 'cryon-gallery-artworks';
const MAX_ITEMS = 12;
const USER_CARD_ATTR = 'data-user-sketch';

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
  el.textContent = text ?? '';
  return el.innerHTML;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Shrink artwork before localStorage to avoid quota errors. */
export async function compressImageForStorage(dataUrl, maxSize = 720, quality = 0.72) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function renderCard(artwork) {
  const date = formatDate(artwork.createdAt);
  return `
    <article class="collection-card" ${USER_CARD_ATTR}="true" data-id="${artwork.id}">
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
  const grid = document.getElementById('static-collection-grid');
  if (!grid) return;

  grid.querySelectorAll(`[${USER_CARD_ATTR}]`).forEach((card) => card.remove());

  if (!items.length) return;

  const markup = items.map(renderCard).join('');
  grid.insertAdjacentHTML('afterbegin', markup);
}

function persistArtworks(items) {
  while (items.length) {
    try {
      saveArtworks(items);
      return true;
    } catch (error) {
      if (error?.name !== 'QuotaExceededError' || items.length <= 1) {
        console.error('Could not save gallery artworks:', error);
        return false;
      }
      items.pop();
    }
  }
  return false;
}

export async function addArtwork(artwork) {
  const items = loadArtworks();
  const storedImage = await compressImageForStorage(artwork.imageData);
  const stored = { ...artwork, imageData: storedImage };
  items.unshift(stored);

  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;

  if (!persistArtworks(items)) {
    throw new Error('Gallery storage is full. Remove older sketches or clear site data.');
  }

  renderUserGallery(items);
  return stored;
}

function initGallery() {
  renderUserGallery();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGallery);
} else {
  initGallery();
}
