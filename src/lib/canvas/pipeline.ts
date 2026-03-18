import { EmoteConfig, TEXT_PRESETS } from "@/types/emote";
import { HI_RES, GIF_HI_RES, USM_MAX_SIZE, releaseCanvas } from "./types";
import { centerAndResize } from "./backgroundRemoval";
import { applyBorder, applyTextOverlay, compositeImages, applyFrame } from "./drawing";

function resolveTextToRender(config: EmoteConfig): string | null {
  // Custom text takes priority
  if (config.text.customText.trim()) {
    return config.text.customText.trim();
  }
  // Fall back to preset
  if (config.text.preset) {
    const preset = TEXT_PRESETS.find((p) => p.id === config.text.preset);
    if (preset) return preset.text;
  }
  return null;
}

/**
 * Unsharp Mask (USM) sharpening for small output sizes.
 * sharpened = original + amount * (original - blurred)
 * Skips fully transparent pixels to avoid boundary artifacts.
 */
function applyUSM(canvas: HTMLCanvasElement, amount: number = 0.6): void {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, w, h);
  const src = imageData.data;

  // Create a blurred copy (simple 3x3 box blur)
  const blurred = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Skip transparent pixels
      if (src[idx + 3] === 0) {
        blurred[idx] = 0;
        blurred[idx + 1] = 0;
        blurred[idx + 2] = 0;
        blurred[idx + 3] = 0;
        continue;
      }

      let r = 0, g = 0, b = 0, count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const ni = (ny * w + nx) * 4;
            // Only sample from non-transparent neighbors
            if (src[ni + 3] > 0) {
              r += src[ni];
              g += src[ni + 1];
              b += src[ni + 2];
              count++;
            }
          }
        }
      }
      if (count > 0) {
        blurred[idx] = r / count;
        blurred[idx + 1] = g / count;
        blurred[idx + 2] = b / count;
      }
      blurred[idx + 3] = src[idx + 3];
    }
  }

  // Apply: sharpened = original + amount * (original - blurred)
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] === 0) continue; // Skip transparent
    src[i] = Math.max(0, Math.min(255, src[i] + amount * (src[i] - blurred[i])));
    src[i + 1] = Math.max(0, Math.min(255, src[i + 1] + amount * (src[i + 1] - blurred[i + 1])));
    src[i + 2] = Math.max(0, Math.min(255, src[i + 2] + amount * (src[i + 2] - blurred[i + 2])));
  }

  ctx.putImageData(imageData, 0, 0);
}

export function downscale(
  source: HTMLCanvasElement,
  targetSize: number
): HTMLCanvasElement {
  // Multi-step downscale for better quality (halve until close, then final resize)
  let current = source;
  while (current.width / 2 >= targetSize) {
    const half = document.createElement("canvas");
    half.width = current.width / 2;
    half.height = current.height / 2;
    const ctx = half.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, half.width, half.height);
    if (current !== source) releaseCanvas(current);
    current = half;
  }

  if (current.width === targetSize) {
    if (targetSize <= USM_MAX_SIZE) applyUSM(current);
    return current;
  }

  const final = document.createElement("canvas");
  final.width = targetSize;
  final.height = targetSize;
  const ctx = final.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, targetSize, targetSize);
  if (current !== source) releaseCanvas(current);

  if (targetSize <= USM_MAX_SIZE) applyUSM(final);

  return final;
}

export function processEmote(
  source: HTMLCanvasElement | HTMLImageElement,
  size: number,
  config: EmoteConfig,
  subCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  // 1. Center and resize at high resolution
  let canvas = centerAndResize(source, HI_RES, config.padding ?? 0.05);

  // 2. Composite with sub image (if applicable)
  if (config.subImage.mode !== "none" && subCanvas) {
    const prev = canvas;
    canvas = compositeImages(canvas, subCanvas, config.subImage.mode, HI_RES, config.subImage.scale, config.subImage.offsetX, config.subImage.offsetY);
    if (canvas !== prev) releaseCanvas(prev);
  }

  // 3. Apply border at high resolution
  {
    const prev = canvas;
    canvas = applyBorder(canvas, config.outline.style, config.outline.width, config.outline.color);
    if (canvas !== prev) releaseCanvas(prev);
  }

  // 4. Apply frame at high resolution
  {
    const prev = canvas;
    canvas = applyFrame(canvas, config.frame.type);
    if (canvas !== prev) releaseCanvas(prev);
  }

  // 5. Apply text overlay at high resolution (skip for ≤32px — text is unreadable)
  const textToRender = resolveTextToRender(config);
  if (textToRender && size > 32) {
    const prev = canvas;
    canvas = applyTextOverlay(canvas, {
      text: textToRender,
      font: config.text.font,
      fillColor: config.text.fillColor,
      strokeColor: config.text.strokeColor,
      position: config.text.position,
      userFontSize: config.text.fontSize,
      offsetX: config.text.offsetX,
      offsetY: config.text.offsetY,
      outlineWidth: config.text.outlineWidth,
    }, HI_RES);
    releaseCanvas(prev);
  }

  // 6. Downscale to target size (multi-step for quality)
  if (size < HI_RES) {
    const prev = canvas;
    canvas = downscale(canvas, size);
    releaseCanvas(prev);
  }

  return canvas;
}

/**
 * Process emote at HI_RES and return BOTH the hi-res canvas and the downscaled output.
 * Used when GIF animation needs the hi-res source for higher quality frame generation.
 */
export function processEmoteWithHiRes(
  source: HTMLCanvasElement | HTMLImageElement,
  size: number,
  config: EmoteConfig,
  subCanvas?: HTMLCanvasElement
): { output: HTMLCanvasElement; hiRes: HTMLCanvasElement } {
  // 1-5: Same pipeline as processEmote, but at GIF_HI_RES for animation source
  let hiResCanvas = centerAndResize(source, GIF_HI_RES, config.padding ?? 0.05);

  if (config.subImage.mode !== "none" && subCanvas) {
    const prev = hiResCanvas;
    hiResCanvas = compositeImages(hiResCanvas, subCanvas, config.subImage.mode, GIF_HI_RES, config.subImage.scale, config.subImage.offsetX, config.subImage.offsetY);
    if (hiResCanvas !== prev) releaseCanvas(prev);
  }

  {
    const prev = hiResCanvas;
    hiResCanvas = applyBorder(hiResCanvas, config.outline.style, config.outline.width, config.outline.color);
    if (hiResCanvas !== prev) releaseCanvas(prev);
  }

  {
    const prev = hiResCanvas;
    hiResCanvas = applyFrame(hiResCanvas, config.frame.type);
    if (hiResCanvas !== prev) releaseCanvas(prev);
  }

  const textToRender = resolveTextToRender(config);
  if (textToRender && size > 32) {
    const prev = hiResCanvas;
    hiResCanvas = applyTextOverlay(hiResCanvas, {
      text: textToRender,
      font: config.text.font,
      fillColor: config.text.fillColor,
      strokeColor: config.text.strokeColor,
      position: config.text.position,
      userFontSize: config.text.fontSize,
      offsetX: config.text.offsetX,
      offsetY: config.text.offsetY,
      outlineWidth: config.text.outlineWidth,
    }, GIF_HI_RES);
    releaseCanvas(prev);
  }

  // Downscale for the regular output
  const output = size < GIF_HI_RES ? downscale(hiResCanvas, size) : hiResCanvas;

  return { output, hiRes: hiResCanvas };
}
