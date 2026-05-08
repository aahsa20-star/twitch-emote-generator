/**
 * Decode a video file into a series of frame canvases by seeking the
 * `<video>` element and drawing into a canvas.
 *
 * This approach trades raw speed for breadth of compatibility — it relies on
 * the browser's native video decoder, so any container/codec the browser
 * already plays (MP4/MOV/WebM with H.264/VP9/AV1/etc.) just works without an
 * extra demuxer dependency. Seeks are slow (a few seconds per 60 frames),
 * which we surface via the `onProgress` callback.
 *
 * Frames are captured into canvases capped at `MAX_OUTPUT_DIM` on the longer
 * side. Source resolutions above that are downscaled at extraction time
 * because the rest of the pipeline operates at ≤256px and there is no
 * quality benefit to keeping 4K frames in memory.
 */

/** Cap frame canvases at this dim on the longer side. */
const MAX_OUTPUT_DIM = 512;

/** Per-seek wait timeout — fallback poll bound (50ms × 100). */
const SEEK_POLL_MAX = 100;

export interface DecodedVideo {
  frames: HTMLCanvasElement[];
  /** Per-frame delay in ms (parallel to `frames`). */
  delays: number[];
  /** Frame canvas width (after MAX_OUTPUT_DIM downscale). */
  width: number;
  /** Frame canvas height. */
  height: number;
  /** Original video duration in ms. */
  durationMs: number;
}

export interface DecodeVideoOptions {
  /** Trim start in ms (clamped to 0). */
  startMs: number;
  /** Trim end in ms (clamped to duration). */
  endMs: number;
  /** Target frames per second. */
  fps: number;
  /** Reports (currentFrame, totalFrames). */
  onProgress?: (current: number, total: number) => void;
  /** Aborts extraction. */
  signal?: AbortSignal;
}

/** Seek the video and resolve once the target frame is decoded and ready.
 *  Mirrors the faceExtractor pattern: prefer the `seeked` event, fall back
 *  to polling readyState in case some browsers don't fire it reliably. */
async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  video.currentTime = time;
  await new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      if (video.readyState >= 2) done();
    };
    video.addEventListener("seeked", onSeeked);

    let polls = 0;
    const poll = () => {
      if (resolved) return;
      if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.5) {
        done();
        return;
      }
      if (++polls > SEEK_POLL_MAX) { done(); return; }
      setTimeout(poll, 50);
    };
    setTimeout(poll, 100);
  });
}

export async function decodeVideo(
  file: File,
  options: DecodeVideoOptions
): Promise<DecodedVideo> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("動画の読み込みに失敗しました"));
    });

    const durationMs = video.duration * 1000;
    const startMs = Math.max(0, options.startMs);
    const endMs = Math.min(durationMs, options.endMs);
    const rangeMs = endMs - startMs;
    if (rangeMs <= 0) {
      throw new Error("トリミング範囲が無効です");
    }

    const frameCount = Math.max(1, Math.round((rangeMs / 1000) * options.fps));
    const frameDelayMs = Math.round(1000 / options.fps);

    // Compute output dimensions (cap longer side at MAX_OUTPUT_DIM).
    const sw = video.videoWidth;
    const sh = video.videoHeight;
    if (sw === 0 || sh === 0) {
      throw new Error("動画のサイズを取得できませんでした");
    }
    const longer = Math.max(sw, sh);
    const scale = longer > MAX_OUTPUT_DIM ? MAX_OUTPUT_DIM / longer : 1;
    const outW = Math.round(sw * scale);
    const outH = Math.round(sh * scale);

    // Capture each target time.
    const frames: HTMLCanvasElement[] = [];
    const delays: number[] = [];
    for (let i = 0; i < frameCount; i++) {
      if (options.signal?.aborted) {
        for (const c of frames) { c.width = 0; c.height = 0; }
        throw new Error("aborted");
      }
      const t = (startMs + i * 1000 / options.fps) / 1000;
      // Clamp the very last target to endMs so we never seek past the trim.
      const clamped = Math.min(t, endMs / 1000 - 0.001);
      await seekTo(video, Math.max(0, clamped));

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, outW, outH);
      frames.push(canvas);
      delays.push(frameDelayMs);

      options.onProgress?.(i + 1, frameCount);
    }

    return { frames, delays, width: outW, height: outH, durationMs };
  } finally {
    video.src = "";
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** Free all canvas memory held by a DecodedVideo. */
export function releaseDecodedVideo(decoded: DecodedVideo): void {
  for (const c of decoded.frames) {
    c.width = 0;
    c.height = 0;
  }
}
