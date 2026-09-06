import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal canvas stand-ins so the cache logic can run in node.
type Fake = { width: number; height: number; getContext: () => unknown };
const makeCanvas = (): Fake => ({
  width: 56,
  height: 56,
  getContext: () => ({ drawImage() {}, imageSmoothingQuality: "" }),
});
vi.stubGlobal("document", { createElement: () => makeCanvas() });
vi.stubGlobal("performance", { now: () => Date.now() });
vi.mock("./index", () => ({
  FRAME_COUNT: 20,
  getFrameGenerator: () => () => makeCanvas(),
}));

import { MAX_CACHED, _previewCacheStats, _resetPreviewCache, acquirePreview, renderStaticFrame, disposeCanvas } from "./preview";

const base = (w = 200): HTMLCanvasElement => ({ width: w, height: w } as unknown as HTMLCanvasElement);

describe("preview cache pinning (R2 §2)", () => {
  beforeEach(() => _resetPreviewCache());

  it("a playing (pinned) entry survives hovering more than MAX_CACHED other cards", () => {
    const b = base();
    const selected = acquirePreview(b, "bounce");
    for (let i = 0; i < MAX_CACHED + 8; i++) {
      const h = acquirePreview(b, `anim-${i}` as never);
      h.release();
    }
    const stats = _previewCacheStats();
    expect(stats.pinned).toBe(1);
    expect(stats.unpinned).toBeLessThanOrEqual(MAX_CACHED);
    expect(selected.frames.every((f) => f.width > 0)).toBe(true);
    selected.release();
  });

  it("released entries become evictable; the cap is enforced", () => {
    const b = base();
    for (let i = 0; i < 30; i++) acquirePreview(b, `a${i}` as never).release();
    expect(_previewCacheStats().size).toBeLessThanOrEqual(MAX_CACHED);
  });

  it("two overlapping acquisitions of the same id share one entry and it is disposed only after both release", () => {
    const b = base();
    const h1 = acquirePreview(b, "sway");
    const h2 = acquirePreview(b, "sway");
    expect(h1.frames).toBe(h2.frames);
    expect(_previewCacheStats().pinned).toBe(1);
    h1.release();
    expect(_previewCacheStats().pinned).toBe(1);
    expect(h2.frames.every((f) => f.width > 0)).toBe(true);
    h2.release();
    expect(_previewCacheStats().pinned).toBe(0);
    h2.release(); // double release is a no-op
    expect(_previewCacheStats().pinned).toBe(0);
  });

  it("changing the base image disposes unpinned entries now and pinned entries on release", () => {
    const b1 = base(200), b2 = base(300);
    const pinned = acquirePreview(b1, "spin");
    acquirePreview(b1, "shake").release();
    acquirePreview(b2, "blink").release(); // base switch
    expect(pinned.frames.every((f) => f.width > 0)).toBe(true); // still playable
    const fresh = acquirePreview(b2, "spin");
    expect(fresh.frames).not.toBe(pinned.frames); // new base → new frames
    pinned.release();
    expect(pinned.frames.every((f) => f.width === 0)).toBe(true); // disposed once released
    fresh.release();
  });

  it("renderStaticFrame returns a canvas the caller owns", () => {
    const f = renderStaticFrame(base(), "bounce", 10);
    expect(f.width).toBe(56);
    disposeCanvas(f);
    expect(f.width).toBe(0);
  });
});
