import { canvasesToFrames, encodeGifFrames, type EncodeJobOptions } from "./encode";

/**
 * Encode a series of pre-rendered frame canvases into an animated GIF.
 *
 * Used by the GIF-source pipeline: caller has already run each frame through
 * the emote pipeline at the target output size, so we just stack them with
 * the original per-frame delays.
 *
 * `repeat` follows gif.js's wire convention:
 *  - `0`  = loop forever (default)
 *  - `-1` = play once, no looping
 *  - `N>0`= play 1 + N times total (i.e. repeat N additional times)
 *
 * Callers translate user-facing loop counts into this convention. See
 * `loopCountToRepeat` below for the canonical mapping.
 */
export async function encodeAnimatedGif(
  frames: HTMLCanvasElement[],
  delays: number[],
  size: number,
  repeat: number = 0,
  jobOpts: EncodeJobOptions = {}
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error("エンコード対象のフレームがありません");
  }
  if (frames.length !== delays.length) {
    throw new Error("frames と delays の数が一致しません");
  }

  // R2 §1: index-level transparency. 07 §1: the caller keeps `frames` alive
  // until this resolves, so a worker crash can rebuild from them.
  const { blob } = await encodeGifFrames(
    canvasesToFrames(frames, delays),
    { repeat, quality: 10, dither: "FloydSteinberg" },
    { ...jobOpts, rebuild: () => canvasesToFrames(frames, delays) },
  );
  return blob;
}

/** Translate a user-facing loop count into gif.js's `repeat` value.
 *  - 0  → 0   (infinite loop)
 *  - 1  → -1  (play once, no repeats)
 *  - N>=2 → N-1 (gif.js encodes the *additional* repeats, not total plays) */
export function loopCountToRepeat(loopCount: number): number {
  if (loopCount <= 0) return 0;
  if (loopCount === 1) return -1;
  return loopCount - 1;
}

/** Apply a playback-speed multiplier to a delay array.
 *  Higher speed → smaller delays. Floors at 20ms (most browsers clamp lower
 *  delays anyway, and going below GIF spec sanity invites buggy decoders). */
export function applySpeedToDelays(delays: number[], speed: number): number[] {
  if (!Number.isFinite(speed) || speed <= 0) return delays.slice();
  if (speed === 1) return delays.slice();
  return delays.map((d) => Math.max(20, Math.round(d / speed)));
}
