import { BadgeSettings, BadgeSize, BorderStyle, CompositeMode, FrameType } from "@/types/emote";
import { TextOverlayOptions, releaseCanvas } from "./types";
import { centerAndResize } from "./backgroundRemoval";

// --- Border ---

/**
 * 8-direction stamp offsets, normalized so diagonals are at the same radial
 * distance as cardinals (1/√2 along each axis). This avoids diagonal corners
 * sticking out further than cardinals on rounded shapes.
 */
const STAMP_8: ReadonlyArray<readonly [number, number]> = (() => {
  const inv = 1 / Math.SQRT2;
  return [
    [0, -1],   [inv, -inv],
    [1, 0],    [inv, inv],
    [0, 1],    [-inv, inv],
    [-1, 0],   [-inv, -inv],
  ];
})();

/** 4-direction stamp offsets — used for animated frames to keep cost down. */
const STAMP_4: ReadonlyArray<readonly [number, number]> = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
];

/**
 * 16-direction stamp offsets at half angular spacing (every 22.5°), used for
 * the "dotted" style where alternating positions are skipped to create gaps.
 */
const STAMP_16: ReadonlyArray<readonly [number, number]> = (() => {
  const arr: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2; // start at top
    arr.push([Math.cos(a), Math.sin(a)]);
  }
  return arr;
})();

// --- Shared helpers (used by all border styles) ---

/** Compute borderWidth in canvas-px space, applying the size-adaptive floor. */
function computeBorderWidth(
  size: number,
  effectiveOutputSize: number,
  userBorderWidth: number | undefined,
): number {
  const userOutputBorder = userBorderWidth != null
    ? userBorderWidth * (effectiveOutputSize / 112)
    : effectiveOutputSize * 0.027;
  const minBorderAtOutput =
    effectiveOutputSize <= 28 ? 2 :
    effectiveOutputSize <= 56 ? 3 :
    0;
  const effectiveOutputBorder = Math.max(userOutputBorder, minBorderAtOutput);
  return Math.max(1, Math.round(effectiveOutputBorder * (size / effectiveOutputSize)));
}

/** Build a solid-color silhouette of the shape on a fresh canvas. */
function buildSilhouette(canvas: HTMLCanvasElement, fillStyle: string | CanvasGradient): HTMLCanvasElement {
  const size = canvas.width;
  const sil = document.createElement("canvas");
  sil.width = size;
  sil.height = size;
  const ctx = sil.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = fillStyle;
  ctx.fillRect(0, 0, size, size);
  return sil;
}

/**
 * Stamp a silhouette in N directions on an oversized buffer and carve out the
 * inner area to leave just the border ring. Returns the big canvas + pad info
 * so callers can composite it onto a result canvas.
 */
function stampRing(
  silhouette: HTMLCanvasElement,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
  ringColor: string,
  options?: { skipAlternating?: boolean; skipCenterCarve?: boolean }
): { big: HTMLCanvasElement; pad: number } {
  const size = silhouette.width;
  const pad = borderWidth + 2;
  const bigSize = size + pad * 2;
  const big = document.createElement("canvas");
  big.width = bigSize;
  big.height = bigSize;
  const bigCtx = big.getContext("2d")!;

  // Choose stamp pattern.
  let offsets: ReadonlyArray<readonly [number, number]>;
  if (options?.skipAlternating) {
    // Use STAMP_16 every other one → 8 dots at 45° intervals (visible gaps).
    offsets = STAMP_16.filter((_, i) => i % 2 === 0);
  } else {
    offsets = isAnimated ? STAMP_4 : STAMP_8;
  }

  for (const [dx, dy] of offsets) {
    bigCtx.drawImage(silhouette, pad + dx * borderWidth, pad + dy * borderWidth);
  }

  // AA blur supplement (size-aware decay), skipped for dotted to keep gaps sharp.
  if (!options?.skipAlternating) {
    const blurDecay =
      effectiveOutputSize <= 28 ? 0 :
      effectiveOutputSize <= 56 ? 0.5 :
      1.0;
    if (blurDecay > 0) {
      const aaBlur = borderWidth * 0.25 * blurDecay;
      const softened = document.createElement("canvas");
      softened.width = bigSize;
      softened.height = bigSize;
      const softCtx = softened.getContext("2d")!;
      softCtx.shadowColor = ringColor;
      softCtx.shadowBlur = aaBlur;
      softCtx.drawImage(big, 0, 0);
      bigCtx.clearRect(0, 0, bigSize, bigSize);
      bigCtx.drawImage(softened, 0, 0);
      releaseCanvas(softened);
    }
  }

  // Carve out the original silhouette → leaves only the border ring.
  if (!options?.skipCenterCarve) {
    bigCtx.globalCompositeOperation = "destination-out";
    bigCtx.drawImage(silhouette, pad, pad);
  }

  return { big, pad };
}

/**
 * Pick a contrast color for "double" style's inner ring. Bright outer →
 * dark inner; dark outer → light inner. Uses simple luminance threshold.
 */
function pickContrastColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#000000";
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 140 ? "#000000" : "#ffffff";
}

/**
 * Apply a border (white / black / custom solid color, or drop shadow).
 *
 * @param outputSize  Final downscaled output size (28 / 56 / 112). When omitted,
 *                    falls back to canvas.width (e.g. PreviewArea single-stage).
 *                    Used for size-adaptive minimum border width.
 * @param isAnimated  When true, reduces stamp count from 8 → 4 directions to
 *                    keep per-frame cost manageable for GIF/video sources
 *                    (called inside `processFrameWithBounds`). Default false.
 *
 * Size-adaptive minimum border width (in OUTPUT-px space):
 * - 28px output: >= 2px
 * - 56px output: >= 3px
 * - 112px output: user spec respected, no floor
 *
 * Rendering technique: stamp filter (silhouette stamped at borderWidth offset
 * in 8 / 4 directions), with optional shadowBlur supplement for AA at larger
 * outputs. At 28px the supplement is 0 (sharp corners read better than blur).
 */
export function applyBorder(
  canvas: HTMLCanvasElement,
  style: BorderStyle,
  userBorderWidth?: number,
  customBorderColor?: string,
  outputSize?: number,
  isAnimated?: boolean
): HTMLCanvasElement {
  if (style === "none") return canvas;

  const size = canvas.width;
  const effectiveOutputSize = outputSize ?? size;

  // Drop-shadow style — separate from solid border, kept with size-aware decay.
  if (style === "shadow") {
    return applyDropShadowStyle(canvas, userBorderWidth, effectiveOutputSize);
  }

  const borderWidth = computeBorderWidth(size, effectiveOutputSize, userBorderWidth);

  // Resolve user-color base used by most styles. White/black are aliases.
  const userColor =
    style === "white" ? "#ffffff" :
    style === "black" ? "#000000" :
    (customBorderColor || "#ffffff");

  switch (style) {
    case "white":
    case "black":
    case "custom":
      return composeStandardBorder(canvas, userColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "neon": {
      // Default cyan when user hasn't picked a color (color stays subscriber-gated).
      // Free users get a recognizable neon look out of the box.
      const neonColor = userColor === "#ffffff" ? "#00ffff" : userColor;
      return composeNeonBorder(canvas, neonColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    }
    case "double":
      return composeDoubleBorder(canvas, userColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "sticker":
      return composeStickerBorder(canvas, userColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "outline-only":
      return composeOutlineOnly(canvas, userColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "gradient":
      return composeGradientBorder(canvas, userColor, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "chrome":
      return composeChromeBorder(canvas, borderWidth, isAnimated ?? false, effectiveOutputSize);
    case "dotted":
      return composeDottedBorder(canvas, userColor, borderWidth, effectiveOutputSize);
    default:
      // Exhaustiveness fallback — should never hit at runtime.
      return canvas;
  }
}

// === Style implementations ===

/** Drop-shadow style (existing fix4 behavior, unchanged). */
function applyDropShadowStyle(
  canvas: HTMLCanvasElement,
  userBorderWidth: number | undefined,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const shadowScale = userBorderWidth != null ? (userBorderWidth / 4) : 1;
  const blurDecay =
    effectiveOutputSize <= 28 ? 0.3 :
    effectiveOutputSize <= 56 ? 0.6 :
    1.0;
  const blurAtOutput = effectiveOutputSize * 0.03 * shadowScale * blurDecay;
  const offsetAtOutput = effectiveOutputSize * 0.015 * shadowScale * blurDecay;
  const toCanvas = size / effectiveOutputSize;
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = Math.max(2, blurAtOutput * toCanvas);
  ctx.shadowOffsetX = Math.max(1, offsetAtOutput * toCanvas);
  ctx.shadowOffsetY = Math.max(1, offsetAtOutput * toCanvas);
  ctx.drawImage(canvas, 0, 0);
  return result;
}

/** Standard solid-color border (replaces fix4's white/black/custom path). */
function composeStandardBorder(
  canvas: HTMLCanvasElement,
  borderColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const sil = buildSilhouette(canvas, borderColor);
  const { big, pad } = stampRing(sil, borderWidth, isAnimated, effectiveOutputSize, borderColor);
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);
  releaseCanvas(sil);
  releaseCanvas(big);
  return result;
}

/**
 * Neon style: bright outline + 3-layer additive glow at increasing radius.
 * Uses the user color as glow tint. Produces a saturated halo around the shape.
 */
function composeNeonBorder(
  canvas: HTMLCanvasElement,
  glowColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const sil = buildSilhouette(canvas, glowColor);
  const { big, pad } = stampRing(sil, borderWidth, isAnimated, effectiveOutputSize, glowColor);

  // Three glow passes at increasing blur, drawn additively on a temp buffer.
  const glowSize = size + pad * 2;
  const glow = document.createElement("canvas");
  glow.width = glowSize;
  glow.height = glowSize;
  const glowCtx = glow.getContext("2d")!;
  glowCtx.globalCompositeOperation = "lighter";

  for (const r of [borderWidth * 1.5, borderWidth * 2.5, borderWidth * 4]) {
    glowCtx.shadowColor = glowColor;
    glowCtx.shadowBlur = r;
    glowCtx.globalAlpha = 0.6;
    glowCtx.drawImage(sil, pad, pad);
  }
  glowCtx.globalAlpha = 1.0;
  glowCtx.shadowBlur = 0;

  // Composite: glow under, ring on top, original on top.
  ctx.drawImage(glow, -pad, -pad);
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);

  releaseCanvas(sil);
  releaseCanvas(big);
  releaseCanvas(glow);
  return result;
}

/**
 * Double border: outer ring at 1.5× width in user color, inner ring at 0.5×
 * width in auto-contrast color. Two stamps composited from outer-most inward.
 */
function composeDoubleBorder(
  canvas: HTMLCanvasElement,
  outerColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const innerColor = pickContrastColor(outerColor);
  const outerWidth = Math.max(2, Math.round(borderWidth * 1.5));
  const innerWidth = Math.max(1, Math.round(borderWidth * 0.5));

  const outerSil = buildSilhouette(canvas, outerColor);
  const outerRing = stampRing(outerSil, outerWidth, isAnimated, effectiveOutputSize, outerColor);

  const innerSil = buildSilhouette(canvas, innerColor);
  const innerRing = stampRing(innerSil, innerWidth, isAnimated, effectiveOutputSize, innerColor);

  ctx.drawImage(outerRing.big, -outerRing.pad, -outerRing.pad);
  ctx.drawImage(innerRing.big, -innerRing.pad, -innerRing.pad);
  ctx.drawImage(canvas, 0, 0);

  releaseCanvas(outerSil);
  releaseCanvas(outerRing.big);
  releaseCanvas(innerSil);
  releaseCanvas(innerRing.big);
  return result;
}

/**
 * Sticker style: thick white border + drop shadow offset down-right.
 * The Twitch emote classic look — feels "punched out" of a sticker sheet.
 */
function composeStickerBorder(
  canvas: HTMLCanvasElement,
  borderColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const ringWidth = Math.max(2, Math.round(borderWidth * 1.5));
  // Sticker borders default to white if user picked black (looks weird).
  const finalColor = borderColor === "#000000" ? "#ffffff" : borderColor;

  const sil = buildSilhouette(canvas, finalColor);
  const { big, pad } = stampRing(sil, ringWidth, isAnimated, effectiveOutputSize, finalColor);

  // Drop shadow: offset and blur derived from output size.
  const toCanvas = size / effectiveOutputSize;
  const shadowOffset = Math.max(1, Math.round(effectiveOutputSize * 0.04 * toCanvas));
  const shadowBlur = Math.max(1, Math.round(borderWidth * 1.2));

  // Compose the "stickered" image (border + content) onto a temp canvas first
  // so we can render it with a shadow.
  const stickered = document.createElement("canvas");
  stickered.width = size;
  stickered.height = size;
  const stickeredCtx = stickered.getContext("2d")!;
  stickeredCtx.drawImage(big, -pad, -pad);
  stickeredCtx.drawImage(canvas, 0, 0);

  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = shadowOffset;
  ctx.shadowOffsetY = shadowOffset;
  ctx.drawImage(stickered, 0, 0);

  releaseCanvas(sil);
  releaseCanvas(big);
  releaseCanvas(stickered);
  return result;
}

/**
 * Outline-only: render the border ring without the original content.
 * Result is a colored silhouette outline on transparent background.
 */
function composeOutlineOnly(
  canvas: HTMLCanvasElement,
  borderColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const sil = buildSilhouette(canvas, borderColor);
  const { big, pad } = stampRing(sil, borderWidth, isAnimated, effectiveOutputSize, borderColor);
  // Only the ring — no original image composite.
  ctx.drawImage(big, -pad, -pad);

  releaseCanvas(sil);
  releaseCanvas(big);
  return result;
}

/**
 * Gradient border: stamp ring filled with a vertical linear gradient from
 * userColor (top) to a lighter shade (bottom). Reads as a 2-tone outline.
 */
function composeGradientBorder(
  canvas: HTMLCanvasElement,
  baseColor: string,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  // Build a gradient fill: baseColor → contrastColor (top → bottom).
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  const tmpCtx = tmp.getContext("2d")!;
  const grad = tmpCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, baseColor);
  grad.addColorStop(1, pickContrastColor(baseColor));

  const sil = buildSilhouette(canvas, grad);
  releaseCanvas(tmp);

  const { big, pad } = stampRing(sil, borderWidth, isAnimated, effectiveOutputSize, baseColor);
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);

  releaseCanvas(sil);
  releaseCanvas(big);
  return result;
}

/**
 * Chrome border: 4-stop vertical gradient (dark → silver → light → silver)
 * giving a metallic sheen. Color param is ignored — chrome is always silver.
 */
function composeChromeBorder(
  canvas: HTMLCanvasElement,
  borderWidth: number,
  isAnimated: boolean,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  const tmpCtx = tmp.getContext("2d")!;
  const grad = tmpCtx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, "#5a5a5a");   // dark top
  grad.addColorStop(0.35, "#f5f5f5");  // bright highlight band
  grad.addColorStop(0.55, "#a8a8a8");  // mid silver
  grad.addColorStop(1.0, "#dedede");   // light bottom

  const sil = buildSilhouette(canvas, grad);
  releaseCanvas(tmp);

  const { big, pad } = stampRing(sil, borderWidth, isAnimated, effectiveOutputSize, "#a8a8a8");
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);

  releaseCanvas(sil);
  releaseCanvas(big);
  return result;
}

/**
 * Dotted border: stamp at 16 evenly-spaced angles, but skip every other
 * position → 8 stamps with 45° gaps. After downscale this reads as a
 * dashed/dotted ring. AA blur is intentionally disabled so gaps stay crisp.
 *
 * Always uses the 16-direction pattern regardless of isAnimated; the dotted
 * look needs the angular spacing and the cost is comparable to STAMP_8.
 */
function composeDottedBorder(
  canvas: HTMLCanvasElement,
  borderColor: string,
  borderWidth: number,
  effectiveOutputSize: number,
): HTMLCanvasElement {
  const size = canvas.width;
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  const sil = buildSilhouette(canvas, borderColor);
  const { big, pad } = stampRing(
    sil, borderWidth, /* isAnimated unused with skipAlternating */ false,
    effectiveOutputSize, borderColor,
    { skipAlternating: true }
  );
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);

  releaseCanvas(sil);
  releaseCanvas(big);
  return result;
}

// --- Text overlay ---

/**
 * Render text overlay onto an emote canvas.
 *
 * @param canvasSize  Render-canvas size in px (HI_RES for the main pipeline,
 *                    GIF_HI_RES for animated frames, or output size for
 *                    direct one-shot renders like PreviewArea).
 * @param outputSize  Final output size in px (28 / 56 / 112). Defaults to
 *                    canvasSize when omitted (single-stage renders). Used to
 *                    apply size-aware minimum fontSize and outline guarantees
 *                    so text remains readable at 28px / 56px after downscale.
 *
 * Size-adaptive minimums (in OUTPUT px space, not canvas px):
 * - 28px output: fontSize >= 14, outline >= 2
 * - 56px output: fontSize >= 22, outline >= 3
 * - 112px output: user spec respected, no floor applied
 *
 * Minimums are *floors*: max(userSpec, minimum). Users specifying larger sizes
 * are honored as-is. The function draws at canvasSize, scaling the effective
 * output-space size by (canvasSize / outputSize).
 */
export function applyTextOverlay(
  canvas: HTMLCanvasElement,
  options: TextOverlayOptions,
  canvasSize: number,
  outputSize: number = canvasSize
): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = canvasSize;
  result.height = canvasSize;
  const ctx = result.getContext("2d")!;

  ctx.drawImage(canvas, 0, 0);

  const { text, font, fillColor, strokeColor, userFontSize, offsetX = 0, offsetY = 0, outlineWidth: userOutlineWidth } = options;

  // 1. Compute user-intended font size in OUTPUT-px space.
  //    userFontSize is "display px at 112px output" by convention.
  let userOutputFontSize: number;
  if (userFontSize != null) {
    userOutputFontSize = userFontSize * (outputSize / 112);
  } else {
    const baseAuto = outputSize * 0.22;
    userOutputFontSize = text.length > 3
      ? Math.max(outputSize * 0.12, baseAuto * (3 / text.length))
      : baseAuto;
  }

  // 2. Apply size-adaptive minimum (floor).
  const minFontSizeAtOutput =
    outputSize <= 28 ? 14 :
    outputSize <= 56 ? 22 :
    0;
  const effectiveOutputFontSize = Math.max(userOutputFontSize, minFontSizeAtOutput);

  // 3. Scale to render canvas for crisp HI_RES drawing.
  const fontSize = effectiveOutputFontSize * (canvasSize / outputSize);

  const fontFamily = `"${font}", "Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif`;
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";

  // Offsets are also expressed in 112-display space; same canvas-space mapping.
  const scaledOffsetX = offsetX * (canvasSize / 112);
  const scaledOffsetY = offsetY * (canvasSize / 112);

  ctx.textBaseline = "middle";
  const x = canvasSize / 2 + scaledOffsetX;
  const y = canvasSize / 2 + scaledOffsetY;

  // Outline width with same size-adaptive minimum logic.
  let userOutputOutline: number;
  if (userOutlineWidth != null) {
    userOutputOutline = userOutlineWidth * (outputSize / 112);
  } else {
    userOutputOutline = Math.max(1, outputSize * 0.025);
  }
  const minOutlineAtOutput =
    outputSize <= 28 ? 2 :
    outputSize <= 56 ? 3 :
    0;
  const effectiveOutputOutline = Math.max(userOutputOutline, minOutlineAtOutput);
  const outlineWidth = effectiveOutputOutline * (canvasSize / outputSize);

  // Stroke first, then fill — fill must sit on top so the outline reads as a
  // halo around the visible glyph. Reversing the order hides the outline.
  if (outlineWidth > 0) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = outlineWidth * 2;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);
    ctx.restore();
  }

  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);

  return result;
}

// --- Composite helpers ---

export function compositeImages(
  mainCanvas: HTMLCanvasElement,
  subCanvas: HTMLCanvasElement,
  mode: CompositeMode,
  size: number,
  subScale: number = 38,
  subOffsetX: number = 0,
  subOffsetY: number = 0
): HTMLCanvasElement {
  if (mode === "none") return mainCanvas;

  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  if (mode === "overlay-br" || mode === "overlay-bl") {
    ctx.drawImage(mainCanvas, 0, 0);

    const subSize = Math.round(size * subScale / 100);
    const subCentered = centerAndResize(subCanvas, subSize);

    const scaledOffsetX = Math.round(subOffsetX * (size / 112));
    const scaledOffsetY = Math.round(subOffsetY * (size / 112));
    // Center-based: free placement via offsets
    const x = Math.round(size / 2 - subSize / 2) + scaledOffsetX;
    const y = Math.round(size / 2 - subSize / 2) + scaledOffsetY;

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
    releaseCanvas(subCentered);

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
    releaseCanvas(mainSmall);
    releaseCanvas(subSmall);

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
      const gradTop = ctx.createLinearGradient(0, 0, size, 0);
      gradTop.addColorStop(0, "#ff0000");
      gradTop.addColorStop(1, "#00ff00");
      ctx.strokeStyle = gradTop;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(0, offset); ctx.lineTo(size, offset); ctx.stroke();
      const gradRight = ctx.createLinearGradient(0, 0, 0, size);
      gradRight.addColorStop(0, "#00ff00");
      gradRight.addColorStop(1, "#0000ff");
      ctx.strokeStyle = gradRight;
      ctx.beginPath(); ctx.moveTo(size - offset, 0); ctx.lineTo(size - offset, size); ctx.stroke();
      const gradBottom = ctx.createLinearGradient(size, 0, 0, 0);
      gradBottom.addColorStop(0, "#0000ff");
      gradBottom.addColorStop(1, "#9900ff");
      ctx.strokeStyle = gradBottom;
      ctx.beginPath(); ctx.moveTo(size, size - offset); ctx.lineTo(0, size - offset); ctx.stroke();
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

// --- Badge rendering ---

export function renderBadge(
  sourceCanvas: HTMLCanvasElement,
  settings: BadgeSettings,
  outputSize: BadgeSize
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  const r = outputSize / 2;
  const cornerRadius = outputSize * 0.2;

  // Clipping path
  ctx.save();
  ctx.beginPath();
  if (settings.shape === "circle") {
    ctx.arc(r, r, r, 0, Math.PI * 2);
  } else if (settings.shape === "rounded") {
    ctx.roundRect(0, 0, outputSize, outputSize, cornerRadius);
  } else {
    ctx.rect(0, 0, outputSize, outputSize);
  }
  ctx.clip();

  // Background
  if (!settings.bgTransparent) {
    ctx.fillStyle = settings.bgColor;
    ctx.fillRect(0, 0, outputSize, outputSize);
  }

  // Image with padding (use centerAndResize to fit content)
  const pad = Math.round(outputSize * (settings.padding / 72));
  const drawSize = outputSize - pad * 2;
  if (drawSize > 0) {
    const centered = centerAndResize(sourceCanvas, drawSize);
    ctx.drawImage(centered, pad, pad);
    releaseCanvas(centered);
  }

  ctx.restore(); // release clip

  // Outline
  if (settings.outlineWidth > 0) {
    const lineWidth = Math.max(1, Math.round(settings.outlineWidth * outputSize / 72));
    ctx.strokeStyle = settings.outlineColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    if (settings.shape === "circle") {
      ctx.arc(r, r, r - lineWidth / 2, 0, Math.PI * 2);
    } else if (settings.shape === "rounded") {
      ctx.roundRect(lineWidth / 2, lineWidth / 2,
        outputSize - lineWidth, outputSize - lineWidth, cornerRadius);
    } else {
      ctx.rect(lineWidth / 2, lineWidth / 2,
        outputSize - lineWidth, outputSize - lineWidth);
    }
    ctx.stroke();
  }

  return canvas;
}
