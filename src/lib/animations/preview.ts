/**
 * Lightweight live previews for the picker (コミット C → R2 §2).
 *
 * - No gif.js: frames are drawn straight to a small canvas with the same
 *   FrameGenerator the export uses.
 * - Frame sets are cached per animation id with an LRU cap. Entries that are
 *   currently being played are *pinned* (reference-counted) and never evicted;
 *   the cap therefore bounds only unpinned entries (players are already capped
 *   at MAX_CONCURRENT_PREVIEWS by the UI).
 * - Releasing the last reference makes the entry evictable again; the base
 *   image changing disposes everything (pinned entries are disposed lazily
 *   once released).
 */
import type { AnimationType } from "@/types/emote";
import { getFrameGenerator, FRAME_COUNT } from "./index";

export const PREVIEW_SIZE = 56;
export const MAX_CONCURRENT_PREVIEWS = 2;
export const MAX_CACHED = 12;

interface CacheEntry {
  base: HTMLCanvasElement;
  frames: HTMLCanvasElement[];
  lastUsed: number;
  refs: number;
  /** Set when the base changed while pinned: dispose on release. */
  stale: boolean;
}

export interface PreviewHandle {
  frames: readonly HTMLCanvasElement[];
  release(): void;
}

let cacheBase: HTMLCanvasElement | null = null;
let smallBase: HTMLCanvasElement | null = null;
const cache = new Map<string, CacheEntry>();

function disposeEntry(e: CacheEntry) {
  for (const f of e.frames) {
    if (f !== smallBase) {
      f.width = 0;
      f.height = 0;
    }
  }
  e.frames = [];
}

function switchBase(base: HTMLCanvasElement) {
  if (cacheBase === base) return;
  for (const [k, e] of cache) {
    if (e.refs > 0) e.stale = true; // still playing: dispose when released
    else {
      disposeEntry(e);
      cache.delete(k);
    }
  }
  cacheBase = base;
  smallBase = null;
}

/** Square, contain-fit downscale of the base for previews (cached per base). */
export function previewBase(base: HTMLCanvasElement): HTMLCanvasElement {
  switchBase(base);
  if (!smallBase) {
    const c = document.createElement("canvas");
    c.width = PREVIEW_SIZE;
    c.height = PREVIEW_SIZE;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const s = Math.min(PREVIEW_SIZE / base.width, PREVIEW_SIZE / base.height);
    const w = base.width * s, h = base.height * s;
    ctx.drawImage(base, (PREVIEW_SIZE - w) / 2, (PREVIEW_SIZE - h) / 2, w, h);
    smallBase = c;
  }
  return smallBase;
}

function evictIfNeeded() {
  let unpinned = 0;
  for (const e of cache.values()) if (e.refs === 0) unpinned++;
  while (unpinned > MAX_CACHED) {
    let victim: string | null = null, oldest = Infinity;
    for (const [k, e] of cache) {
      if (e.refs === 0 && e.lastUsed < oldest) {
        oldest = e.lastUsed;
        victim = k;
      }
    }
    if (victim === null) break;
    disposeEntry(cache.get(victim)!);
    cache.delete(victim);
    unpinned--;
  }
}

/**
 * Acquire the frame set of an animation for playback. The entry stays alive
 * until `release()` is called (even across evictions of other entries).
 */
export function acquirePreview(base: HTMLCanvasElement, id: AnimationType): PreviewHandle {
  const small = previewBase(base);
  let entry = cache.get(id);
  if (entry && (entry.stale || entry.base !== base)) {
    // a pinned entry from a previous base: give this caller a fresh set
    entry = undefined;
  }
  if (!entry) {
    const gen = getFrameGenerator(id);
    const frames: HTMLCanvasElement[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) frames.push(gen ? gen(small, i, FRAME_COUNT) : small);
    entry = { base, frames, lastUsed: performance.now(), refs: 0, stale: false };
    const existing = cache.get(id);
    if (existing && existing.refs === 0) disposeEntry(existing);
    if (!existing || existing.refs === 0) cache.set(id, entry);
    // (if an old pinned entry exists under this id, the new one lives outside the map until released)
  }
  entry.refs++;
  entry.lastUsed = performance.now();
  evictIfNeeded();
  const e = entry;
  let released = false;
  return {
    frames: e.frames,
    release() {
      if (released) return;
      released = true;
      e.refs--;
      e.lastUsed = performance.now();
      if (e.refs === 0 && (e.stale || cache.get(id) !== e)) {
        disposeEntry(e);
        if (cache.get(id) === e) cache.delete(id);
      }
      evictIfNeeded();
    },
  };
}

/**
 * Render ONE representative frame for a static card. The caller owns the
 * returned canvas (draw it, then dispose with `disposeCanvas`).
 */
export function renderStaticFrame(base: HTMLCanvasElement, id: AnimationType, frameIndex: number): HTMLCanvasElement {
  const small = previewBase(base);
  const gen = getFrameGenerator(id);
  return gen ? gen(small, Math.max(0, Math.min(FRAME_COUNT - 1, frameIndex)), FRAME_COUNT) : small;
}

export function disposeCanvas(c: HTMLCanvasElement) {
  if (c !== smallBase) {
    c.width = 0;
    c.height = 0;
  }
}

/** Diagnostics for tests / dev pages. */
export function _previewCacheStats(): { size: number; pinned: number; unpinned: number } {
  let pinned = 0;
  for (const e of cache.values()) if (e.refs > 0) pinned++;
  return { size: cache.size, pinned, unpinned: cache.size - pinned };
}
export function _resetPreviewCache() {
  for (const e of cache.values()) disposeEntry(e);
  cache.clear();
  cacheBase = null;
  smallBase = null;
}
