import { TextPosition } from "@/types/emote";

export interface VisibilityResult {
  ok: boolean;
  message: string;
}

export function checkVisibility(
  canvas: HTMLCanvasElement,
  hasText: boolean,
  textPosition: TextPosition = "bottom"
): VisibilityResult {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: true, message: "OK" };

  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData;
  const totalPixels = size * size;

  // Check 1: Transparent pixel ratio
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 10) transparentCount++;
  }
  const transparentRatio = transparentCount / totalPixels;
  if (transparentRatio >= 0.82) {
    return { ok: false, message: "余白が多すぎます" };
  }

  // Check 2: Edge contrast (Sobel-like check on luminance)
  const lum = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = data[idx + 3] / 255;
    lum[i] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) * a;
  }

  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      if (data[idx * 4 + 3] < 10) continue;
      const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gy = Math.abs(lum[idx + size] - lum[idx - size]);
      edgeSum += gx + gy;
      edgeCount++;
    }
  }
  const avgEdge = edgeCount > 0 ? edgeSum / edgeCount : 0;
  if (avgEdge < 3) {
    return { ok: false, message: "輪郭が弱いです" };
  }

  // Check 3: Text crushed at 28px
  if (hasText) {
    let textStartY: number;
    let textEndY: number;
    switch (textPosition) {
      case "top":
        textStartY = 0;
        textEndY = Math.floor(size * 0.35);
        break;
      case "center":
        textStartY = Math.floor(size * 0.33);
        textEndY = Math.floor(size * 0.67);
        break;
      case "bottom":
      default:
        textStartY = Math.floor(size * 0.65);
        textEndY = size;
        break;
    }
    let textVariance = 0;
    let textPixels = 0;
    let textMean = 0;

    for (let y = textStartY; y < textEndY; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        if (data[idx * 4 + 3] > 10) {
          textMean += lum[idx];
          textPixels++;
        }
      }
    }

    if (textPixels > 0) {
      textMean /= textPixels;
      for (let y = textStartY; y < textEndY; y++) {
        for (let x = 0; x < size; x++) {
          const idx = y * size + x;
          if (data[idx * 4 + 3] > 10) {
            const diff = lum[idx] - textMean;
            textVariance += diff * diff;
          }
        }
      }
      textVariance /= textPixels;
      // Very low variance means text details are crushed
      if (textVariance < 100) {
        return { ok: false, message: "文字が潰れています" };
      }
    }
  }

  return { ok: true, message: "視認性OK" };
}
