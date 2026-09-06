import { describe, expect, it } from "vitest";
import { ALPHA_THRESHOLD, flattenAlphaForGif, pickTransparentColor, type RgbaFrame } from "./transparency";

function frame(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): RgbaFrame {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a] = fill(x, y);
    const i = (y * w + x) * 4;
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
  }
  return { data, width: w, height: h };
}

describe("GIF transparency (B12)", () => {
  it("never picks black when black is used, and never picks a color present in the frame", () => {
    // black eyes + white face on transparent
    const f = frame(16, 16, (x) => (x < 4 ? [0, 0, 0, 255] : x < 8 ? [255, 255, 255, 255] : [0, 0, 0, 0]));
    const t = pickTransparentColor([f]);
    expect(t).not.toBe(0x000000);
    expect(t).not.toBe(0xffffff);
    expect(t).toBe(0xff00ff); // first candidate is free
  });

  it("skips candidates that are close to used colors (neighbouring 4-bit bins)", () => {
    const f = frame(8, 8, () => [250, 10, 250, 255]); // near magenta
    const t = pickTransparentColor([f]);
    expect(t).not.toBe(0xff00ff);
    expect(t).toBe(0x00ff00);
  });

  it("considers every frame", () => {
    const f1 = frame(4, 4, () => [255, 0, 255, 255]);
    const f2 = frame(4, 4, () => [0, 255, 0, 255]);
    expect(pickTransparentColor([f1, f2])).toBe(0x00ffff);
  });

  it("ignores transparent pixels' RGB when picking (they may carry garbage)", () => {
    const f = frame(4, 4, () => [255, 0, 255, 0]);
    expect(pickTransparentColor([f])).toBe(0xff00ff);
  });

  it("flattens alpha: >=128 kept with original color, <128 becomes the sentinel; source untouched", () => {
    const f = frame(2, 2, (x, y) => (x === 0 && y === 0 ? [0, 0, 0, 255] : x === 1 && y === 0 ? [10, 20, 30, 128] : x === 0 ? [40, 50, 60, 127] : [255, 255, 255, 0]));
    const before = Array.from(f.data);
    const out = flattenAlphaForGif(f, 0xff00ff);
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0, 0, 255]);       // opaque black survives
    expect(Array.from(out.slice(4, 8))).toEqual([10, 20, 30, 255]);    // alpha 128 → opaque
    expect(Array.from(out.slice(8, 12))).toEqual([255, 0, 255, 255]);  // alpha 127 → sentinel
    expect(Array.from(out.slice(12, 16))).toEqual([255, 0, 255, 255]); // alpha 0 → sentinel
    expect(Array.from(f.data)).toEqual(before);
    expect(ALPHA_THRESHOLD).toBe(128);
  });

  it("falls back to a free bin when all candidates are taken", () => {
    const colors = [0xff00ff, 0x00ff00, 0x00ffff, 0xff8000, 0x8000ff, 0x0080ff, 0xff0080, 0x80ff00, 0x0000ff, 0xffff00, 0xff0000, 0x00ff80, 0xff80ff, 0x80ffff, 0xffff80, 0x808080];
    const f = frame(16, 1, (x) => [(colors[x] >> 16) & 255, (colors[x] >> 8) & 255, colors[x] & 255, 255]);
    const t = pickTransparentColor([f]);
    expect(colors).not.toContain(t);
    expect(t).toBeGreaterThanOrEqual(0);
  });
});
