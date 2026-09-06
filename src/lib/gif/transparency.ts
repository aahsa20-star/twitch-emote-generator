/**
 * GIF transparency helpers (B12 → R2 §1).
 *
 * gif.js drops the alpha channel and maps its `transparent` option to the
 * nearest *used* palette entry — so a fixed key (black) made opaque black
 * pixels transparent, and even a dynamic key is not a guarantee after
 * quantisation. The guarantee now lives in `encoder-core.ts`, which rewrites
 * the palette indices from the alpha mask after quantisation/dithering.
 *
 * What this file provides:
 *  - `pickTransparentColor`: a *heuristic* sentinel color far from the opaque
 *    colors, used only so transparent pixels quantise onto (ideally) one
 *    unused palette entry. It is best effort (4-bit histogram, sampling for big
 *    frames, fallbacks when every bin is taken) — it does NOT by itself prevent
 *    collisions and is never relied on for correctness.
 *  - `flattenAlphaForGif`: alpha >= ALPHA_THRESHOLD → opaque with original RGB,
 *    otherwise the sentinel. GIF has 1-bit transparency; semi-transparent
 *    pixels are kept (>= 128) or dropped (< 128), never pre-multiplied against
 *    a matte, so the emote looks the same on dark and light chat backgrounds.
 */

export const ALPHA_THRESHOLD = 128;

/** Structural subset of ImageData usable in node tests. */
export interface RgbaFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Candidates far apart in RGB space, tried in order. */
const CANDIDATES = [
  0xff00ff, 0x00ff00, 0x00ffff, 0xff8000, 0x8000ff, 0x0080ff, 0xff0080, 0x80ff00,
  0x0000ff, 0xffff00, 0xff0000, 0x00ff80, 0xff80ff, 0x80ffff, 0xffff80, 0x808080,
];

/** 4 bits per channel → 4096 bins. */
function binOf(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
}

/**
 * Pick an RGB value (0xRRGGBB) that no sampled opaque pixel of any frame is
 * close to ("close" = same 4-bit bin or a neighbouring bin). Heuristic only —
 * see the file header; correctness is enforced at the index level.
 */
export function pickTransparentColor(frames: RgbaFrame[], alphaThreshold = ALPHA_THRESHOLD): number {
  const used = new Uint8Array(4096);
  for (const f of frames) {
    const d = f.data;
    const stride = d.length > 4 * 512 * 512 ? 8 : 4; // sample big frames
    for (let i = 0; i < d.length; i += stride) {
      if (d[i + 3] >= alphaThreshold) used[binOf(d[i], d[i + 1], d[i + 2])] = 1;
    }
  }
  const nearUsed = (color: number): boolean => {
    const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
    const br = r >> 4, bg = g >> 4, bb = b >> 4;
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const rr = br + dr, gg = bg + dg, bbb = bb + db;
      if (rr < 0 || rr > 15 || gg < 0 || gg > 15 || bbb < 0 || bbb > 15) continue;
      if (used[(rr << 8) | (gg << 4) | bbb]) return true;
    }
    return false;
  };
  for (const c of CANDIDATES) if (!nearUsed(c)) return c;

  // Fallback: any bin with no used neighbours (search from saturated corners inward).
  for (let r = 0; r < 16; r++) for (let g = 0; g < 16; g++) for (let b = 0; b < 16; b++) {
    const c = (((r << 4) | 8) << 16) | (((g << 4) | 8) << 8) | ((b << 4) | 8);
    if (!nearUsed(c)) return c;
  }
  // Every bin neighbourhood is in use (pathological): least-used exact bin.
  let best = 0xff00ff;
  for (let bin = 0; bin < 4096; bin++) {
    if (!used[bin]) {
      best = ((((bin >> 8) & 15) << 4 | 8) << 16) | ((((bin >> 4) & 15) << 4 | 8) << 8) | (((bin & 15) << 4) | 8);
      break;
    }
  }
  return best;
}

/**
 * Return a NEW RGBA buffer where alpha is flattened: transparent pixels carry
 * the sentinel (alpha 255), opaque pixels keep their color (alpha 255).
 * The source is not modified (元画像を書き換えない).
 */
export function flattenAlphaForGif(frame: RgbaFrame, transparent: number, alphaThreshold = ALPHA_THRESHOLD): Uint8ClampedArray {
  const tr = (transparent >> 16) & 0xff, tg = (transparent >> 8) & 0xff, tb = transparent & 0xff;
  const src = frame.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] >= alphaThreshold) {
      out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2];
    } else {
      out[i] = tr; out[i + 1] = tg; out[i + 2] = tb;
    }
    out[i + 3] = 255;
  }
  return out;
}

/** Read RGBA from a canvas (browser only). */
export function canvasToRgba(canvas: HTMLCanvasElement): RgbaFrame {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: img.width, height: img.height };
}
