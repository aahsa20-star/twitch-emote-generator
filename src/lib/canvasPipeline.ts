import { BorderStyle, CompositeMode, EmoteConfig, FrameType, TextConfig, TextPosition, TEXT_PRESETS } from "@/types/emote";

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
  outlineWidth?: number;
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

  const { text, font, fillColor, strokeColor, position, userFontSize, offsetX = 0, offsetY = 0, outlineWidth: userOutlineWidth } = options;

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
  const outlineWidth = userOutlineWidth != null
    ? userOutlineWidth * (canvasSize / 112)
    : Math.max(1, canvasSize * 0.025);

  if (outlineWidth > 0) {
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
  }

  // Text fill on top
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);

  return result;
}

// --- Composite helpers ---

export function compositeImages(
  mainCanvas: HTMLCanvasElement,
  subCanvas: HTMLCanvasElement,
  mode: CompositeMode,
  size: number
): HTMLCanvasElement {
  if (mode === "none") return mainCanvas;

  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  if (mode === "overlay-br" || mode === "overlay-bl") {
    ctx.drawImage(mainCanvas, 0, 0);

    const subSize = Math.round(size * 0.38);
    const subCentered = centerAndResize(subCanvas, subSize);

    const x = mode === "overlay-br" ? Math.round(size * 0.58) : Math.round(size * 0.04);
    const y = Math.round(size * 0.58);

    // White border via shadowBlur
    ctx.save();
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = Math.max(1, Math.round(subSize * 0.025));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    for (let i = 0; i < 3; i++) {
      ctx.drawImage(subCentered, x, y);
    }
    ctx.restore();
    ctx.drawImage(subCentered, x, y);

    return result;
  }

  if (mode === "sidebyside") {
    const padding = Math.round(size * 0.04);
    const halfW = Math.floor(size / 2);
    const innerSize = halfW - padding * 2;
    const yOffset = Math.round((size - innerSize) / 2);

    const mainSmall = centerAndResize(mainCanvas, innerSize);
    const subSmall = centerAndResize(subCanvas, innerSize);

    ctx.drawImage(mainSmall, padding, yOffset);
    ctx.drawImage(subSmall, halfW + padding, yOffset);

    return result;
  }

  return mainCanvas;
}

// --- Frame helpers ---

function drawStar5(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const innerR = r * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : innerR;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
}

function drawSparkle4(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const innerR = r * 0.25;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const radius = i % 2 === 0 ? r : innerR;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  ctx.closePath();
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.translate(cx, cy - r * 0.15);
  const w = r;
  const h = r * 1.1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.35);
  ctx.bezierCurveTo(0, h * 0.05, -w, -h * 0.3, -w, h * 0.1);
  ctx.bezierCurveTo(-w, h * 0.55, 0, h * 0.7, 0, h);
  ctx.bezierCurveTo(0, h * 0.7, w, h * 0.55, w, h * 0.1);
  ctx.bezierCurveTo(w, -h * 0.3, 0, h * 0.05, 0, h * 0.35);
  ctx.closePath();
  ctx.restore();
}

function seededRand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function applyFrame(
  canvas: HTMLCanvasElement,
  frameType: FrameType
): HTMLCanvasElement {
  if (frameType === "none") return canvas;

  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);

  switch (frameType) {
    case "stars": {
      const starR = size * 0.06;
      const margin = size * 0.08;
      const mid = size / 2;
      const positions = [
        [margin, margin], [mid, margin], [size - margin, margin],
        [margin, mid], [size - margin, mid],
        [margin, size - margin], [mid, size - margin], [size - margin, size - margin],
      ];
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = starR * 0.8;
      for (const [x, y] of positions) {
        drawStar5(ctx, x, y, starR);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
      break;
    }

    case "hearts": {
      const heartR = size * 0.06;
      const margin = size * 0.08;
      const corners = [
        { x: margin, y: margin, rot: -15 },
        { x: size - margin, y: margin, rot: 15 },
        { x: margin, y: size - margin, rot: 15 },
        { x: size - margin, y: size - margin, rot: -15 },
      ];
      ctx.fillStyle = "#FF6B9D";
      for (const c of corners) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate((c.rot * Math.PI) / 180);
        ctx.translate(-c.x, -c.y);
        drawHeart(ctx, c.x, c.y, heartR);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case "gaming": {
      const lw = Math.max(1, size * 0.025);
      const offset = lw / 2;
      // Top: red → green
      const gradTop = ctx.createLinearGradient(0, 0, size, 0);
      gradTop.addColorStop(0, "#ff0000");
      gradTop.addColorStop(1, "#00ff00");
      ctx.strokeStyle = gradTop;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(0, offset); ctx.lineTo(size, offset); ctx.stroke();
      // Right: green → blue
      const gradRight = ctx.createLinearGradient(0, 0, 0, size);
      gradRight.addColorStop(0, "#00ff00");
      gradRight.addColorStop(1, "#0000ff");
      ctx.strokeStyle = gradRight;
      ctx.beginPath(); ctx.moveTo(size - offset, 0); ctx.lineTo(size - offset, size); ctx.stroke();
      // Bottom: blue → purple
      const gradBottom = ctx.createLinearGradient(size, 0, 0, 0);
      gradBottom.addColorStop(0, "#0000ff");
      gradBottom.addColorStop(1, "#9900ff");
      ctx.strokeStyle = gradBottom;
      ctx.beginPath(); ctx.moveTo(size, size - offset); ctx.lineTo(0, size - offset); ctx.stroke();
      // Left: purple → red
      const gradLeft = ctx.createLinearGradient(0, size, 0, 0);
      gradLeft.addColorStop(0, "#9900ff");
      gradLeft.addColorStop(1, "#ff0000");
      ctx.strokeStyle = gradLeft;
      ctx.beginPath(); ctx.moveTo(offset, size); ctx.lineTo(offset, 0); ctx.stroke();
      break;
    }

    case "sparkles": {
      const margin = size * 0.05;
      for (let i = 0; i < 12; i++) {
        const t = i / 12;
        const side = Math.floor(t * 4);
        const sideT = (t * 4) - side;
        let x: number, y: number;
        switch (side) {
          case 0: x = sideT * size; y = margin; break;
          case 1: x = size - margin; y = sideT * size; break;
          case 2: x = (1 - sideT) * size; y = size - margin; break;
          default: x = margin; y = (1 - sideT) * size; break;
        }
        x += (seededRand(i * 2) - 0.5) * size * 0.04;
        y += (seededRand(i * 2 + 1) - 0.5) * size * 0.04;
        const r = size * (0.03 + seededRand(i * 3) * 0.015);

        ctx.save();
        const hue = 50 + seededRand(i * 7) * 20;
        const light = 85 + seededRand(i * 11) * 15;
        ctx.fillStyle = `hsl(${hue}, 100%, ${light}%)`;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = r * 1.5;
        drawSparkle4(ctx, x, y, r);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case "rainbow": {
      const lw = Math.max(1, size * 0.04);
      const offset = lw / 2;
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, "#ff0000");
      grad.addColorStop(0.17, "#ff8800");
      grad.addColorStop(0.33, "#ffff00");
      grad.addColorStop(0.5, "#00cc00");
      grad.addColorStop(0.67, "#0066ff");
      grad.addColorStop(0.83, "#8800ff");
      grad.addColorStop(1, "#ff0088");
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.strokeRect(offset, offset, size - lw, size - lw);
      break;
    }

    case "dots": {
      const dotR = size * 0.02;
      const count = 16;
      const margin = size * 0.03;
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const side = Math.floor(t * 4);
        const sideT = (t * 4) - side;
        let x: number, y: number;
        const span = size - 2 * margin;
        switch (side) {
          case 0: x = sideT * span + margin; y = margin; break;
          case 1: x = size - margin; y = sideT * span + margin; break;
          case 2: x = (1 - sideT) * span + margin; y = size - margin; break;
          default: x = margin; y = (1 - sideT) * span + margin; break;
        }
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(i * 360) / count}, 80%, 60%)`;
        ctx.fill();
      }
      break;
    }
  }

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
  size: number,
  config: EmoteConfig,
  subCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  // 1. Center and resize at high resolution
  let canvas = centerAndResize(source, HI_RES);

  // 2. Composite with sub image (if applicable)
  if (config.compositeMode !== "none" && subCanvas) {
    canvas = compositeImages(canvas, subCanvas, config.compositeMode, HI_RES);
  }

  // 3. Apply border at high resolution
  canvas = applyBorder(canvas, config.border, config.borderWidth, config.borderColor);

  // 4. Apply frame at high resolution
  canvas = applyFrame(canvas, config.frameType);

  // 5. Apply text overlay at high resolution (skip for ≤32px — text is unreadable)
  const textToRender = resolveTextToRender(config);
  if (textToRender && size > 32) {
    canvas = applyTextOverlay(canvas, {
      text: textToRender,
      font: config.text.font,
      fillColor: config.text.fillColor,
      strokeColor: config.text.strokeColor,
      position: config.text.position,
      userFontSize: config.fontSize,
      offsetX: config.textOffsetX,
      offsetY: config.textOffsetY,
      outlineWidth: config.textOutlineWidth,
    }, HI_RES);
  }

  // 6. Downscale to target size (multi-step for quality)
  if (size < HI_RES) {
    canvas = downscale(canvas, size);
  }

  return canvas;
}
