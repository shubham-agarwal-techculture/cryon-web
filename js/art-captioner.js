import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.0/dist/transformers.min.js';

env.allowLocalModels = false;
env.useBrowserCache = true;

let imageCaptioner = null;
let titleGenerator = null;

function extractGeneratedText(result) {
  if (!result) return '';
  if (Array.isArray(result)) {
    return result[0]?.generated_text?.trim() ?? '';
  }
  return result.generated_text?.trim() ?? '';
}

function fallbackTitle(caption) {
  let text = caption
    .replace(/^(a|an|the)\s+/i, '')
    .replace(/^(drawing|painting|sketch|image|picture|photo)\s+of\s+/i, '');
  const title = text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return title || 'Untitled Sketch';
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
      titleGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small', {
        dtype: 'q8',
      });
    }
    const output = await titleGenerator(
      `Write a short poetic art gallery title, 3 to 6 words, for: ${caption}`,
      { max_new_tokens: 18 }
    );
    let title = extractGeneratedText(output).replace(/^["']|["']$/g, '');
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
    imageCaptioner = await pipeline('image-to-text', 'Xenova/blip-image-captioning-base', {
      dtype: 'q8',
    });
  }

  onProgress?.('Analyzing your drawing…');
  const image = await RawImage.read(imageDataUrl);
  const result = await imageCaptioner(image);
  const caption = extractGeneratedText(result) || 'a pastel sketch on paper';

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
