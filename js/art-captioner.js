import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0';

env.allowLocalModels = false;
env.useBrowserCache = true;

let imageCaptioner = null;
let titleGenerator = null;

async function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function resizeForModel(dataUrl, maxSize = 384) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

function fallbackTitle(caption) {
  let text = caption
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/^(drawing|painting|sketch|image|picture|photo)\s+of\s+/i, '');
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function polishDescription(caption) {
  let text = caption.trim();
  if (!text) return 'A hand-drawn pastel sketch on textured paper, created in the Cryon Studio.';
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (!/[.!?]$/.test(text)) text += '.';
  return `${text} Created in the Cryon Studio drawing board with pastel tones on textured paper.`;
}

async function generateTitle(caption) {
  try {
    if (!titleGenerator) {
      titleGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
    }
    const output = await titleGenerator(
      `Write a short poetic art gallery title, 3 to 6 words, for: ${caption}`,
      { max_new_tokens: 18, temperature: 0.7 }
    );
    let title = output[0]?.generated_text?.trim().replace(/^["']|["']$/g, '');
    if (!title || title.length < 3) throw new Error('Empty title');
    if (title.length > 64) title = title.slice(0, 61) + '…';
    return title;
  } catch {
    return fallbackTitle(caption);
  }
}

/**
 * Describe artwork using open-source models (BLIP + Flan-T5).
 * @param {string} imageDataUrl
 * @param {(message: string) => void} [onProgress]
 */
export async function describeArtwork(imageDataUrl, onProgress) {
  onProgress?.('Loading BLIP image-captioning model…');
  if (!imageCaptioner) {
    imageCaptioner = await pipeline('image-to-text', 'Xenova/blip-image-captioning-base');
  }

  onProgress?.('Analyzing your drawing…');
  const modelImage = await resizeForModel(imageDataUrl);
  const result = await imageCaptioner(modelImage);
  const caption = result[0]?.generated_text?.trim() || 'a pastel sketch on paper';

  onProgress?.('Generating gallery title with Flan-T5…');
  const title = await generateTitle(caption);
  const description = polishDescription(caption);

  return { title, description, caption };
}

export function fallbackMetadata() {
  const stamp = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return {
    title: 'Untitled Sketch',
    description: `A hand-drawn piece from the Cryon Studio, added on ${stamp}. Pastel strokes on textured paper.`,
    caption: 'a pastel sketch',
  };
}
