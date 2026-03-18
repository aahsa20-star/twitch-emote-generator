import { findContentBounds, releaseCanvas } from "./types";

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
    tempCanvas,
    bounds.left,
    bounds.top,
    contentWidth,
    contentHeight,
    offsetX,
    offsetY,
    drawWidth,
    drawHeight
  );

  releaseCanvas(tempCanvas);
  return canvas;
}
