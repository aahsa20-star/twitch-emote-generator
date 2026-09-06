import { describe, expect, it } from "vitest";
import { parseGIF, decompressFrames } from "gifuct-js";
import { encodeGifSync, type GifFrameInput } from "./encoder-core";

type Px = [number, number, number, number];

function frame(w: number, h: number, fill: (x: number, y: number) => Px, delayMs = 50): GifFrameInput {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = fill(x, y);
    const i = (y * w + x) * 4;
    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
  }
  return { rgba, width: w, height: h, delayMs };
}

/** Decode with gifuct-js; returns per-frame full RGBA patches (alpha 0 = transparent index). */
function decode(bytes: Uint8Array) {
  const parsed = parseGIF(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const frames = decompressFrames(parsed, true);
  return { parsed, frames };
}

const alphaStats = (patch: Uint8ClampedArray) => {
  let opaque = 0, transparent = 0;
  for (let i = 3; i < patch.length; i += 4) {
    if (patch[i] === 0) transparent++;
    else opaque++;
  }
  return { opaque, transparent };
};

const BLACK: Px = [0, 0, 0, 255];
const CLEAR: Px = [0, 0, 0, 0];

describe("encodeGifSync — index-level transparency (R2 §1)", () => {
  it("a fully opaque solid-black frame has NO transparent pixels and stays black", () => {
    const { bytes, reports } = encodeGifSync([frame(16, 16, () => BLACK)]);
    expect(reports[0]).toEqual({ transparentPixels: 0, transparentIndex: null, remappedOpaque: 0 });
    const { frames } = decode(bytes);
    expect(frames).toHaveLength(1);
    const s = alphaStats(frames[0].patch);
    expect(s.transparent).toBe(0);
    expect(s.opaque).toBe(256);
    for (let i = 0; i < frames[0].patch.length; i += 4) {
      expect(frames[0].patch[i]).toBeLessThan(8);
    }
  });

  it("a photo-like multi-color opaque frame (>256 colors) has no transparent pixels", () => {
    const f = frame(64, 64, (x, y) => [(x * 37 + y * 11) % 256, (x * 91 + y * 3) % 256, (x * 53 + y * 71) % 256, 255]);
    const { bytes } = encodeGifSync([f]);
    const { frames } = decode(bytes);
    expect(alphaStats(frames[0].patch).transparent).toBe(0);
    // colors stay close to the source (mean abs error per channel < 24)
    let err = 0;
    for (let i = 0; i < f.rgba.length; i += 4) err += Math.abs(f.rgba[i] - frames[0].patch[i]) + Math.abs(f.rgba[i + 1] - frames[0].patch[i + 1]) + Math.abs(f.rgba[i + 2] - frames[0].patch[i + 2]);
    expect(err / (64 * 64 * 3)).toBeLessThan(24);
  });

  it("black eyes on a transparent background: eyes opaque black, background transparent", () => {
    const eyes = (x: number, y: number): Px => (x >= 4 && x < 6 && y >= 5 && y < 9) || (x >= 10 && x < 12 && y >= 5 && y < 9) ? BLACK : x > 2 && x < 13 && y > 2 && y < 13 ? [255, 220, 120, 255] : CLEAR;
    const { bytes, reports } = encodeGifSync([frame(16, 16, eyes), frame(16, 16, eyes)]);
    expect(reports[0].transparentIndex).not.toBeNull();
    const { frames } = decode(bytes);
    for (const fr of frames) {
      const p = fr.patch;
      const at = (x: number, y: number) => Array.from(p.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4));
      expect(at(0, 0)[3]).toBe(0);
      expect(at(15, 15)[3]).toBe(0);
      expect(at(4, 6)[3]).toBe(255);
      expect(at(4, 6)[0]).toBeLessThan(16);
      expect(at(8, 8)[3]).toBe(255);
      expect(alphaStats(p).transparent).toBe(256 - 100);
    }
  });

  it("mixed sequence: opaque → transparent → opaque frames keep their own alpha; disposal is 2", () => {
    const mixed = [
      frame(16, 16, () => BLACK),
      frame(16, 16, (x) => (x < 8 ? BLACK : CLEAR)),
      frame(16, 16, () => [255, 255, 255, 255]),
    ];
    const { bytes, reports } = encodeGifSync(mixed);
    expect(reports.map((r) => r.transparentPixels)).toEqual([0, 128, 0]);
    const { frames } = decode(bytes);
    expect(frames.map((f) => alphaStats(f.patch).transparent)).toEqual([0, 128, 0]);
    expect(frames.every((f) => f.disposalType === 2)).toBe(true);
  });

  it("an all-transparent frame decodes as fully transparent", () => {
    const { bytes, reports } = encodeGifSync([frame(8, 8, () => CLEAR)]);
    expect(reports[0].transparentPixels).toBe(64);
    const { frames } = decode(bytes);
    expect(alphaStats(frames[0].patch)).toEqual({ opaque: 0, transparent: 64 });
  });

  it("alpha 127 is transparent, alpha 128 is opaque", () => {
    const f = frame(4, 1, (x) => (x === 0 ? [10, 20, 30, 127] : x === 1 ? [10, 20, 30, 128] : x === 2 ? [10, 20, 30, 0] : [10, 20, 30, 255]));
    const { bytes } = encodeGifSync([f]);
    const { frames } = decode(bytes);
    const a = (x: number) => frames[0].patch[x * 4 + 3];
    expect([a(0), a(1), a(2), a(3)]).toEqual([0, 255, 0, 255]);
  });

  it("frees a palette entry by remapping when opaque pixels use all 256 entries", () => {
    // 256+ distinct opaque colors plus a transparent strip
    const f = frame(64, 64, (x, y) => (y < 4 ? CLEAR : [(x * 4) % 256, (y * 4) % 256, ((x + y) * 8) % 256, 255]));
    const { bytes, reports } = encodeGifSync([f], { dither: false });
    const { frames } = decode(bytes);
    expect(alphaStats(frames[0].patch).transparent).toBe(64 * 4);
    expect(reports[0].transparentIndex).not.toBeNull();
    // every opaque pixel is opaque after decode, whatever the remap count
    for (let y = 4; y < 64; y++) expect(frames[0].patch[(y * 64) * 4 + 3]).toBe(255);
  });

  it("delays and loop count are written; sequence of 20 frames round-trips", () => {
    const frames20 = Array.from({ length: 20 }, (_, i) => frame(8, 8, (x) => (x < i % 8 ? BLACK : CLEAR), 80));
    const { bytes } = encodeGifSync(frames20, { repeat: 0 });
    const { frames } = decode(bytes);
    expect(frames).toHaveLength(20);
    expect(frames.every((f) => f.delay === 80)).toBe(true);
    expect(frames[0].dims).toMatchObject({ width: 8, height: 8 });
  });

  it("rejects mismatched frame sizes", () => {
    expect(() => encodeGifSync([frame(4, 4, () => BLACK), frame(5, 4, () => BLACK)])).toThrow();
  });
});
