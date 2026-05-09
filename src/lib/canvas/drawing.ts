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
  const result = document.createElement("canvas");
  result.width = size;
  result.height = size;
  const ctx = result.getContext("2d")!;

  // Drop-shadow style — separate from solid border, kept with size-aware decay.
  if (style === "shadow") {
    const shadowScale = userBorderWidth != null ? (userBorderWidth / 4) : 1;
    // Light decay: drop shadow stays partially visible at 28 (vs 0 for solid borders).
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

  // Solid color border — stamp filter implementation.
  const borderColor = style === "custom" ? (customBorderColor || "#ffffff") : style === "white" ? "#ffffff" : "#000000";

  // 1. Compute user-intended border width in OUTPUT-px space.
  //    userBorderWidth is "display px at 112px output" by convention.
  let userOutputBorder: number;
  if (userBorderWidth != null) {
    userOutputBorder = userBorderWidth * (effectiveOutputSize / 112);
  } else {
    userOutputBorder = effectiveOutputSize * 0.027; // ~3% default
  }

  // 2. Apply size-adaptive minimum (floor).
  const minBorderAtOutput =
    effectiveOutputSize <= 28 ? 2 :
    effectiveOutputSize <= 56 ? 3 :
    0;
  const effectiveOutputBorder = Math.max(userOutputBorder, minBorderAtOutput);

  // 3. Scale to canvas (HI_RES) for actual stamping.
  const borderWidth = Math.max(1, Math.round(effectiveOutputBorder * (size / effectiveOutputSize)));

  // 4. Build a solid-color silhouette of the shape.
  const silhouette = document.createElement("canvas");
  silhouette.width = size;
  silhouette.height = size;
  const silCtx = silhouette.getContext("2d")!;
  silCtx.drawImage(canvas, 0, 0);
  silCtx.globalCompositeOperation = "source-in";
  silCtx.fillStyle = borderColor;
  silCtx.fillRect(0, 0, size, size);

  // 5. Oversized buffer so stamps near the edge don't clip.
  const pad = borderWidth + 2;
  const bigSize = size + pad * 2;
  const big = document.createElement("canvas");
  big.width = bigSize;
  big.height = bigSize;
  const bigCtx = big.getContext("2d")!;

  // 6. Stamp filter — N-direction silhouette stamps at borderWidth offset.
  //    Static: 8 dirs (cardinal + diagonal, radially normalized).
  //    Animated: 4 dirs (cardinal only) for per-frame cost reduction.
  const offsets = isAnimated ? STAMP_4 : STAMP_8;
  for (const [dx, dy] of offsets) {
    bigCtx.drawImage(
      silhouette,
      pad + dx * borderWidth,
      pad + dy * borderWidth,
    );
  }

  // 7. Optional shadowBlur supplement for AA at larger outputs.
  //    At 28px the stamp's faceted edges read better sharp; at 112px a
  //    light blur smooths the polygonal corners.
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
    softCtx.shadowColor = borderColor;
    softCtx.shadowBlur = aaBlur;
    softCtx.drawImage(big, 0, 0);
    bigCtx.clearRect(0, 0, bigSize, bigSize);
    bigCtx.drawImage(softened, 0, 0);
    releaseCanvas(softened);
  }

  // 8. Carve out the original silhouette → leaves only the border ring.
  bigCtx.globalCompositeOperation = "destination-out";
  bigCtx.drawImage(silhouette, pad, pad);

  // 9. Composite: border ring beneath the original image.
  ctx.drawImage(big, -pad, -pad);
  ctx.drawImage(canvas, 0, 0);
  releaseCanvas(silhouette);
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
