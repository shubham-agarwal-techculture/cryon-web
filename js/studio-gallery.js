import { describeArtwork, fallbackMetadata } from './art-captioner.js';
import { addArtwork } from './gallery.js';

const galleryBtn = document.getElementById('gallery-btn');
const statusEl = document.getElementById('gallery-status');
let statusTimer = null;

function showStatus(message, type = 'loading') {
  if (!statusEl) return;
  clearTimeout(statusTimer);
  statusEl.hidden = false;
  statusEl.className = `gallery-status gallery-status--${type}`;
  statusEl.textContent = message;
}

function hideStatus(delay = 0) {
  if (!statusEl) return;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.hidden = true;
  }, delay);
}

function waitForStudio() {
  return new Promise((resolve) => {
    if (window.cryonDrawingStudio) {
      resolve(window.cryonDrawingStudio);
      return;
    }
    const check = setInterval(() => {
      if (window.cryonDrawingStudio) {
        clearInterval(check);
        resolve(window.cryonDrawingStudio);
      }
    }, 50);
  });
}

galleryBtn?.addEventListener('click', async () => {
  const studio = await waitForStudio();

  if (studio.isBlank()) {
    showStatus('Draw something on the canvas first.', 'warn');
    hideStatus(3500);
    return;
  }

  galleryBtn.disabled = true;
  showStatus('Preparing your artwork…');

  try {
    const imageData = studio.getArtworkDataUrl();
    let metadata;
    let usedFallback = false;

    try {
      metadata = await describeArtwork(imageData, showStatus);
    } catch (error) {
      console.error('AI captioning failed:', error);
      metadata = fallbackMetadata();
      usedFallback = true;
    }

    const artwork = {
      id: crypto.randomUUID(),
      imageData,
      title: metadata.title,
      description: metadata.description,
      createdAt: Date.now(),
    };

    addArtwork(artwork);

    if (usedFallback) {
      showStatus('Added to gallery with a default title (AI unavailable).', 'warn');
    } else {
      showStatus(`"${metadata.title}" was added to the gallery!`, 'success');
    }

    const gallerySection = document.getElementById('user-gallery-wrap');
    gallerySection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    hideStatus(5000);
  } catch (error) {
    console.error('Gallery add failed:', error);
    showStatus('Could not add to gallery. Please try again.', 'error');
    hideStatus(5000);
  } finally {
    galleryBtn.disabled = false;
  }
});
