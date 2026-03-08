import { BorderStyle, EmoteConfig, EmoteSize, TextConfig, TextPosition, TEXT_PRESETS } from "@/types/emote";

interface Bounds {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

function findContentBounds(imageData: ImageData): Bounds {
  const { width, height, data } = imageData;
  let top = height,
    left = width,
    right = 0,
    bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (right === 0 && bottom === 0) {
    return { top: 0, left: 0, right: width, bottom: height };
  }

  return { top, left, right: right + 1, bottom: bottom + 1 };
}

export function centerAndResize(
  source: HTMLCanvasElement | HTMLImageElement,
  targetSize: number,
  padding: number = 0.08
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
  const scale = availableSize / maxDim;

  const drawWidth = contentWidth * scale;
  const drawHeight = contentHeight * scale;
  const offsetX = (targetSize - drawWidth) / 2;
  const offsetY = (targetSize - drawHeight) / 2;

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

  return canvas;
}

export function applyBorder(
  canvas: HTMLCanvasElement,
  style: BorderStyle,
  userBorderWidth?: number,
  customBorderColor?: string
): HTMLCanvasElement {
  if (style === "none") return canvas;

  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  if (style === "shadow") {
    const shadowScale = userBorderWidth != null ? (userBorderWidth / 4) : 1;
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = Math.max(2, size * 0.03 * shadowScale);
    ctx.shadowOffsetX = Math.max(1, size * 0.015 * shadowScale);
    ctx.shadowOffsetY = Math.max(1, size * 0.015 * shadowScale);
    ctx.drawImage(canvas, 0, 0);
    return result;
  }

  // Shadow-based smooth border: draw colored silhouette with shadowBlur for anti-aliased edges
  const borderColor = style === "custom" ? (customBorderColor || "#ffffff") : style === "white" ? "#ffffff" : "#000000";
  // Scale borderWidth: user value is in "display px" at 112px, scale to HI_RES
  const borderWidth = userBorderWidth != null
    ? Math.max(1, Math.round(userBorderWidth * (size / 112)))
    : Math.max(1, Math.round(size * 0.027));

  // Create a solid-color silhouette
  const silhouette = document.createElement("canvas");
  silhouette.width = size;
  silhouette.height = size;
  const silCtx = silhouette.getContext("2d")!;
  silCtx.drawImage(canvas, 0, 0);
  silCtx.globalCompositeOperation = "source-in";
  silCtx.fillStyle = borderColor;
  silCtx.fillRect(0, 0, size, size);

  // Use shadow to create smooth anti-aliased border
  // Draw on an oversized canvas so shadow doesn't clip
  const pad = borderWidth * 2 + 4;
  const bigSize = size + pad * 2;
  const big = document.createElement("canvas");
  big.width = bigSize;
  big.height = bigSize;
  const bigCtx = big.getContext("2d")!;

  bigCtx.shadowColor = borderColor;
  bigCtx.shadowBlur = borderWidth;
  // Draw multiple passes for opacity buildup (shadow alone is semi-transparent)
  for (let i = 0; i < 3; i++) {
    bigCtx.shadowOffsetX = 0;
    bigCtx.shadowOffsetY = 0;
    bigCtx.drawImage(silhouette, pad, pad);
  }
  // Clear the silhouette center so only the shadow border remains
  bigCtx.shadowColor = "transparent";
  bigCtx.globalCompositeOperation = "destination-out";
  bigCtx.drawImage(silhouette, pad, pad);

  // Composite: border shadow + original
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);
  return result;
}

export interface TextOverlayOptions {
  text: string;
  font: string;
  fillColor: string;
  strokeColor: string;
  position: TextPosition;
  userFontSize?: number;
  offsetX?: number;
  offsetY?: number;
}

export function applyTextOverlay(
  canvas: HTMLCanvasElement,
  options: TextOverlayOptions,
  canvasSize: number
): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = canvasSize;
  result.height = canvasSize;
  const ctx = result.getContext("2d")!;

  ctx.drawImage(canvas, 0, 0);

  const { text, font, fillColor, strokeColor, position, userFontSize, offsetX = 0, offsetY = 0 } = options;

  // Scale font size: userFontSize is in "display px" at 112px, scale to canvasSize
  let fontSize: number;
  if (userFontSize != null) {
    fontSize = userFontSize * (canvasSize / 112);
  } else {
    const baseFontSize = canvasSize * 0.22;
    fontSize = text.length > 3
      ? Math.max(canvasSize * 0.12, baseFontSize * (3 / text.length))
      : baseFontSize;
  }

  const fontFamily = `"${font}", "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";

  // Scale offsets from 112px display space to canvas space
  const scaledOffsetX = offsetX * (canvasSize / 112);
  const scaledOffsetY = offsetY * (canvasSize / 112);

  // Position
  let x = canvasSize / 2 + scaledOffsetX;
  let y: number;
  switch (position) {
    case "top":
      ctx.textBaseline = "top";
      y = canvasSize * 0.04 + scaledOffsetY;
      break;
    case "center":
      ctx.textBaseline = "middle";
      y = canvasSize / 2 + scaledOffsetY;
      break;
    case "bottom":
    default:
      ctx.textBaseline = "bottom";
      y = canvasSize - canvasSize * 0.04 + scaledOffsetY;
      break;
  }

  // Shadow-based text outline for smooth anti-aliased edges
  const outlineWidth = Math.max(1, canvasSize * 0.025);
  ctx.save();
  ctx.shadowColor = strokeColor;
  ctx.shadowBlur = outlineWidth;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = strokeColor;
  // Multiple passes for full opacity buildup
  for (let i = 0; i < 4; i++) {
    ctx.fillText(text, x, y);
  }
  ctx.restore();

  // Text fill on top
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);

  return result;
}

function resolveTextToRender(config: EmoteConfig): string | null {
  // Custom text takes priority
  if (config.text.customText.trim()) {
    return config.text.customText.trim();
  }
  // Fall back to preset
  if (config.textPreset) {
    const preset = TEXT_PRESETS.find((p) => p.id === config.textPreset);
    if (preset) return preset.text;
  }
  return null;
}

function downscale(
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
    current = half;
  }

  if (current.width === targetSize) return current;

  const final = document.createElement("canvas");
  final.width = targetSize;
  final.height = targetSize;
  const ctx = final.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, targetSize, targetSize);
  return final;
}

// Internal render size: process at high resolution for crisp borders/text
const HI_RES = 224;

export function processEmote(
  source: HTMLCanvasElement | HTMLImageElement,
  size: EmoteSize,
  config: EmoteConfig
): HTMLCanvasElement {
  // 1. Center and resize at high resolution
  let canvas = centerAndResize(source, HI_RES);

  // 2. Apply border at high resolution
  canvas = applyBorder(canvas, config.border, config.borderWidth, config.borderColor);

  // 3. Apply text overlay at high resolution (skip for 28px — text is unreadable)
  const textToRender = resolveTextToRender(config);
  if (textToRender && size > 28) {
    canvas = applyTextOverlay(canvas, {
      text: textToRender,
      font: config.text.font,
      fillColor: config.text.fillColor,
      strokeColor: config.text.strokeColor,
      position: config.text.position,
      userFontSize: config.fontSize,
      offsetX: config.textOffsetX,
      offsetY: config.textOffsetY,
    }, HI_RES);
  }

  // 4. Downscale to target size (multi-step for quality)
  if (size < HI_RES) {
    canvas = downscale(canvas, size);
  }

  return canvas;
}
