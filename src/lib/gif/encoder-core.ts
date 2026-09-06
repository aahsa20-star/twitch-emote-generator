/**
 * GIF encoder core with index-level transparency (R2 レビュー 06 §1).
 *
 * Why not gif.js's worker path: gif.js maps its `transparent` option to the
 * palette entry closest to that color among *used* entries
 * (`findClosest(transparent, true)`). Even when no input pixel has that color,
 * some real color is picked — for a fully opaque black frame every pixel ends
 * up on the transparent index (reproduced 2026-09-06 with gif.js 0.2.0).
 *
 * This module drives gif.js's GIFEncoder directly and, after quantisation and
 * dithering, rewrites the indexed pixels from the alpha mask:
 *  - frames with no transparent pixels are written WITHOUT a transparency flag
 *  - otherwise a palette index T is chosen that no opaque pixel uses (the entry
 *    the sentinel-colored transparent pixels mapped to, when possible); if every
 *    entry is used by opaque pixels, the least-used one is freed by remapping
 *    those few opaque pixels to their nearest other palette color
 *  - every transparent pixel gets index T, every opaque pixel is guaranteed
 *    not to have index T
 *  - disposal is always 2 (restore to background) so a transparent frame never
 *    shows the previous frame through its holes
 *
 * Pure JS (no DOM): runs in a Web Worker in the browser and directly in node
 * tests, which decode the real output with gifuct-js.
 */
import GIFEncoder from "gif.js/src/GIFEncoder.js";
import { ALPHA_THRESHOLD, flattenAlphaForGif, pickTransparentColor } from "./transparency";

export interface GifFrameInput {
  rgba: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  /** Frame delay in ms. */
  delayMs: number;
}

export interface GifEncodeOptions {
  /** gif.js convention: 0 = loop forever, -1 = play once, N = N additional loops. */
  repeat?: number;
  /** NeuQuant sample factor (1 = best, 10 = default). */
  quality?: number;
  dither?: "FloydSteinberg" | false;
  alphaThreshold?: number;
}

export interface GifFrameReport {
  transparentPixels: number;
  /** Palette index used for transparency, null when the frame is opaque. */
  transparentIndex: number | null;
  /** Opaque pixels that had to move to another palette entry to free T. */
  remappedOpaque: number;
}

export interface GifEncodeResult {
  bytes: Uint8Array;
  reports: GifFrameReport[];
}

const PAGE_SIZE = 4096;

function nearestExcluding(r: number, g: number, b: number, colorTab: ArrayLike<number>, exclude: number): number {
  let best = -1, bestD = Infinity;
  const entries = colorTab.length / 3;
  for (let e = 0; e < entries; e++) {
    if (e === exclude) continue;
    const i = e * 3;
    const dr = r - colorTab[i], dg = g - colorTab[i + 1], db = b - colorTab[i + 2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best < 0 ? 0 : best;
}

/**
 * Rewrite `enc.indexedPixels` so that transparent pixels (mask=1) all use one
 * index T and no opaque pixel uses T. Returns the report for the frame.
 */
export function applyAlphaMaskToIndices(
  indexed: Uint8Array,
  colorTab: ArrayLike<number>,
  mask: Uint8Array,
  rgba: ArrayLike<number>,
): { transparentIndex: number; remappedOpaque: number } {
  const entries = colorTab.length / 3;
  const opaqueUse = new Uint32Array(entries);
  const transUse = new Uint32Array(entries);
  for (let i = 0; i < indexed.length; i++) {
    if (mask[i]) transUse[indexed[i]]++;
    else opaqueUse[indexed[i]]++;
  }
  // Prefer an entry no opaque pixel uses; among those, the one transparent pixels already map to.
  let T = -1, bestTrans = -1;
  for (let e = 0; e < entries; e++) {
    if (opaqueUse[e] === 0 && transUse[e] > bestTrans) {
      T = e;
      bestTrans = transUse[e];
    }
  }
  let remapped = 0;
  if (T === -1) {
    // Every entry is used by opaque pixels: free the least-used one.
    let min = Infinity;
    for (let e = 0; e < entries; e++) {
      if (opaqueUse[e] < min) {
        min = opaqueUse[e];
        T = e;
      }
    }
    for (let i = 0; i < indexed.length; i++) {
      if (!mask[i] && indexed[i] === T) {
        const p = i * 4;
        indexed[i] = nearestExcluding(rgba[p], rgba[p + 1], rgba[p + 2], colorTab, T);
        remapped++;
      }
    }
  }
  for (let i = 0; i < indexed.length; i++) if (mask[i]) indexed[i] = T;
  return { transparentIndex: T, remappedOpaque: remapped };
}

function collectBytes(out: { pages: Uint8Array[]; cursor: number }): Uint8Array {
  const pages = out.pages;
  if (pages.length === 0) return new Uint8Array(0);
  const len = (pages.length - 1) * PAGE_SIZE + out.cursor;
  const bytes = new Uint8Array(len);
  let offset = 0;
  for (let i = 0; i < pages.length; i++) {
    if (i === pages.length - 1) {
      bytes.set(pages[i].subarray(0, out.cursor), offset);
    } else {
      bytes.set(pages[i], offset);
      offset += PAGE_SIZE;
    }
  }
  return bytes;
}

/** Synchronous encoder (CPU-bound; call from a worker in the browser). */
export function encodeGifSync(frames: GifFrameInput[], opts: GifEncodeOptions = {}): GifEncodeResult {
  if (frames.length === 0) throw new Error("no frames");
  const { width, height } = frames[0];
  for (const f of frames) {
    if (f.width !== width || f.height !== height) throw new Error("frame size mismatch");
    if (f.rgba.length !== width * height * 4) throw new Error("rgba length mismatch");
  }
  const threshold = opts.alphaThreshold ?? ALPHA_THRESHOLD;
  const quality = opts.quality ?? 10;
  const dither = opts.dither === undefined ? "FloydSteinberg" : opts.dither;

  const enc = new GIFEncoder(width, height);
  enc.setRepeat(opts.repeat ?? 0);
  enc.setQuality(quality);
  enc.setDither(dither === false ? false : dither);
  enc.writeHeader();

  const reports: GifFrameReport[] = [];
  const n = width * height;

  for (const frame of frames) {
    const rgba = frame.rgba;
    const mask = new Uint8Array(n);
    let transparentPixels = 0;
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < threshold) {
        mask[i] = 1;
        transparentPixels++;
      }
    }
    const hasTransparency = transparentPixels > 0;

    let data: Uint8Array | Uint8ClampedArray = rgba;
    let sentinel: number | null = null;
    if (hasTransparency) {
      // Quantise transparent pixels as one sentinel color far from the opaque
      // colors so they collapse onto (ideally) a single unused palette entry.
      sentinel = pickTransparentColor([{ data: rgba as Uint8ClampedArray, width, height }], threshold);
      data = flattenAlphaForGif({ data: rgba as Uint8ClampedArray, width, height }, sentinel, threshold);
    }

    enc.setDelay(frame.delayMs);
    enc.setTransparent(hasTransparency ? sentinel : null);

    let report: GifFrameReport = { transparentPixels, transparentIndex: null, remappedOpaque: 0 };
    const proto = Object.getPrototypeOf(enc) as { analyzePixels: () => void };
    enc.analyzePixels = function (this: GIFEncoder) {
      proto.analyzePixels.call(this);
      if (hasTransparency) {
        const r = applyAlphaMaskToIndices(this.indexedPixels, this.colorTab!, mask, rgba);
        this.transIndex = r.transparentIndex;
        report = { transparentPixels, transparentIndex: r.transparentIndex, remappedOpaque: r.remappedOpaque };
      }
    };
    enc.writeGraphicCtrlExt = function (this: GIFEncoder) {
      this.out.writeByte(0x21);
      this.out.writeByte(0xf9);
      this.out.writeByte(4);
      // disposal 2 (restore to background) always; transparency flag only when needed
      this.out.writeByte((2 << 2) | (hasTransparency ? 1 : 0));
      this.writeShort(this.delay);
      this.out.writeByte(hasTransparency ? this.transIndex : 0);
      this.out.writeByte(0);
    };

    enc.addFrame(data);
    reports.push(report);
  }

  enc.finish();
  return { bytes: collectBytes(enc.out), reports };
}
