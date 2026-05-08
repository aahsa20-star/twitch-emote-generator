import { findContentBounds, releaseCanvas, type Bounds } from "./types";

export interface ContentAdjustment {
  offsetX?: number;  // normalized -1 to 1 (fraction of targetSize)
  offsetY?: number;  // normalized -1 to 1
  scale?: number;    // multiplier, default 1.0
}

export function centerAndResize(
  source: HTMLCanvasElement | HTMLImageElement,
  targetSize: number,
  padding: number = 0.05,
  adjustment?: ContentAdjustment
): HTMLCanvasElement {
  const tempCanvas = document.createElement("canvas");
  const sw = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
  const sh = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.drawImage(source, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, sw, sh);
  const bounds = findContentBounds(imageData);

  const result = drawWithBounds(tempCanvas, targetSize, padding, bounds, adjustment);
  releaseCanvas(tempCanvas);
  return result;
}

/**
 * Same as centerAndResize but uses pre-computed bounds. Used by the GIF
 * pipeline where every frame must apply the *same* center/scale transform
 * to avoid jitter (otherwise each frame's content bounds differ as the
 * subject moves, and the result wobbles).
 *
 * Bounds are expressed in source-canvas pixel coordinates.
 */
export function centerAndResizeWithBounds(
  source: HTMLCanvasElement,
  targetSize: number,
  padding: number,
  bounds: Bounds,
  adjustment?: ContentAdjustment
): HTMLCanvasElement {
  return drawWithBounds(source, targetSize, padding, bounds, adjustment);
}

/**
 * Compute the union of content bounds across multiple canvases. Use this
 * to produce a stable bounding box for animated sequences before passing it
 * to centerAndResizeWithBounds.
 */
export function computeUnionBounds(canvases: HTMLCanvasElement[]): Bounds {
  if (canvases.length === 0) {
    return { top: 0, left: 0, right: 0, bottom: 0 };
  }
  let top = Infinity;
  let left = Infinity;
  let right = 0;
  let bottom = 0;

  for (const c of canvases) {
    const ctx = c.getContext("2d")!;
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const b = findContentBounds(data);
    if (b.right === b.left || b.bottom === b.top) continue;
    if (b.top < top) top = b.top;
    if (b.left < left) left = b.left;
    if (b.right > right) right = b.right;
    if (b.bottom > bottom) bottom = b.bottom;
  }

  if (top === Infinity) {
    return { top: 0, left: 0, right: canvases[0].width, bottom: canvases[0].height };
  }
  return { top, left, right, bottom };
}

function drawWithBounds(
  source: HTMLCanvasElement,
  targetSize: number,
  padding: number,
  bounds: Bounds,
  adjustment?: ContentAdjustment
): HTMLCanvasElement {
  const contentWidth = bounds.right - bounds.left;
  const contentHeight = bounds.bottom - bounds.top;
  const maxDim = Math.max(contentWidth, contentHeight);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d")!;

  const paddingPx = targetSize * padding;
  const availableSize = targetSize - paddingPx * 2;
  const baseScale = availableSize / maxDim;

  // Apply user scale adjustment (center-based zoom)
  const userScale = adjustment?.scale ?? 1.0;
  const finalScale = baseScale * userScale;

  const drawWidth = contentWidth * finalScale;
  const drawHeight = contentHeight * finalScale;

  // Center position + user offset
  const userOffsetXPx = (adjustment?.offsetX ?? 0) * targetSize;
  const userOffsetYPx = (adjustment?.offsetY ?? 0) * targetSize;
  const offsetX = (targetSize - drawWidth) / 2 + userOffsetXPx;
  const offsetY = (targetSize - drawHeight) / 2 + userOffsetYPx;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    bounds.left,
    bounds.top,
    contentWidth,
    contentHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  return canvas;
}
