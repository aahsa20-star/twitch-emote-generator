/**
 * Shared drawing helpers for fixed animations (コミット C).
 * Every generator: reads `baseCanvas` only, returns a NEW canvas of the same
 * size. Randomness is seeded (`prng`) so identical settings regenerate
 * identical frames.
 */

export function newCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return [c, ctx];
}

/** mulberry32 — small deterministic PRNG. */
export function prng(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(clamp01(t) * Math.PI);
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 2;
export const easeIn = (t: number) => clamp01(t) ** 2;
export const easeOutBack = (t: number) => {
  const c1 = 1.70158, c3 = c1 + 1;
  const x = clamp01(t);
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
/** 0→1 on [a,b], clamped outside. */
export const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Stroke width that stays readable at 28px. */
export const lineWidth = (size: number, ratio = 0.03, min = 1.5) => Math.max(min, size * ratio);

export interface DrawOpts {
  dx?: number;
  dy?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  alpha?: number;
  /** Pivot in [0,1] canvas units (default center). */
  px?: number;
  py?: number;
}

/** Draw the base image transformed around a pivot. */
export function drawBase(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, o: DrawOpts = {}) {
  const size = base.width;
  const px = (o.px ?? 0.5) * size, py = (o.py ?? 0.5) * size;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(px + (o.dx ?? 0), py + (o.dy ?? 0));
  if (o.rotation) ctx.rotate(o.rotation);
  const s = o.scale ?? 1;
  ctx.scale((o.scaleX ?? 1) * s, (o.scaleY ?? 1) * s);
  ctx.drawImage(base, -px, -py);
  ctx.restore();
}

export function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, points = 5, inner = 0.5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Text with outline so symbols stay readable on any background at 28px. */
export function outlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, fill = "#fff", stroke = "#222", weight = "bold") {
  ctx.save();
  ctx.font = `${weight} ${px}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, px * 0.18);
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export interface Bounds { left: number; top: number; right: number; bottom: number; cx: number; cy: number; w: number; h: number }

const boundsCache = new WeakMap<HTMLCanvasElement, Bounds>();

/** Opaque content bounds of the base (cached per canvas — recomputed only when the input changes). */
export function contentBounds(base: HTMLCanvasElement): Bounds {
  const hit = boundsCache.get(base);
  if (hit) return hit;
  const size = base.width;
  const data = base.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, size, size).data;
  let left = size, top = size, right = -1, bottom = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (data[(y * size + x) * 4 + 3] > 16) {
      if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
    }
  }
  const b: Bounds = right < 0
    ? { left: 0, top: 0, right: size - 1, bottom: size - 1, cx: size / 2, cy: size / 2, w: size, h: size }
    : { left, top, right, bottom, cx: (left + right) / 2, cy: (top + bottom) / 2, w: right - left + 1, h: bottom - top + 1 };
  boundsCache.set(base, b);
  return b;
}

const silhouetteCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** Outline ring of the base's silhouette (cached per input). */
export function silhouetteOutline(base: HTMLCanvasElement, color: string, width: number): HTMLCanvasElement {
  const key = base;
  const cached = silhouetteCache.get(key);
  if (cached && cached.dataset.sig === `${color}|${width}`) return cached;
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  // stamp the silhouette in 12 directions
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.drawImage(base, Math.cos(a) * width, Math.sin(a) * width);
  }
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  // cut out the interior
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  c.dataset.sig = `${color}|${width}`;
  silhouetteCache.set(key, c);
  return c;
}
