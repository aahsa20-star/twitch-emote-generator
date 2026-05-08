import { parseGIF, decompressFrames, type ParsedFrame } from "gifuct-js";

export interface DecodedGif {
  /** Fully composited frame canvases at the GIF's logical screen size. */
  frames: HTMLCanvasElement[];
  /** Per-frame delay in ms (parallel to `frames`). */
  delays: number[];
  /** GIF logical screen width. */
  width: number;
  /** GIF logical screen height. */
  height: number;
  /** Number of frames in the *original* file (before any sampling). */
  originalFrameCount: number;
}

/** Hard cap on frames passed to the rest of the pipeline.
 *  Twitch animated emotes are 1MB-bound; ~60 frames is a sane practical limit. */
export const MAX_FRAMES = 60;

/**
 * Decode a GIF file into a series of fully-composited frame canvases.
 *
 * gifuct-js gives us per-frame patch data plus disposal metadata; we walk the
 * frames in order, applying the standard GIF disposal rules so each output
 * canvas is a complete frame as it would be rendered in a viewer.
 *
 * If the source has more than MAX_FRAMES, we sample uniformly and accumulate
 * delays so the resulting GIF plays at the original wall-clock speed.
 */
export async function decodeGif(file: File): Promise<DecodedGif> {
  const buffer = await file.arrayBuffer();
  const parsed = parseGIF(buffer);
  const rawFrames = decompressFrames(parsed, true);

  if (rawFrames.length === 0) {
    throw new Error("GIFにフレームが含まれていません");
  }

  const width = parsed.lsd.width;
  const height = parsed.lsd.height;

  // Step 1: render all source frames into full-size canvases (handle disposal).
  const fullFrames: HTMLCanvasElement[] = [];
  const fullDelays: number[] = [];

  // Working canvas: holds the "current" composite as the GIF would display it.
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const workCtx = work.getContext("2d")!;

  // Patch canvas: temporary scratch for each frame's patch data.
  const patchCanvas = document.createElement("canvas");
  const patchCtx = patchCanvas.getContext("2d")!;

  // For disposal type 3 (restore to previous), we need to remember the state
  // *before* this frame was drawn.
  let savedState: ImageData | null = null;

  for (const frame of rawFrames) {
    // Snapshot for disposal type 3 (capture before draw).
    if (frame.disposalType === 3) {
      savedState = workCtx.getImageData(0, 0, width, height);
    }

    drawPatch(patchCanvas, patchCtx, frame);
    workCtx.drawImage(
      patchCanvas,
      frame.dims.left,
      frame.dims.top
    );

    // Snapshot the composited frame.
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out.getContext("2d")!.drawImage(work, 0, 0);
    fullFrames.push(out);
    // gifuct-js delay is already in ms; clamp to a sane minimum.
    fullDelays.push(Math.max(20, frame.delay || 100));

    // Apply disposal AFTER capturing this frame's output.
    switch (frame.disposalType) {
      case 2: {
        // Restore to background (transparent for our purposes).
        workCtx.clearRect(
          frame.dims.left,
          frame.dims.top,
          frame.dims.width,
          frame.dims.height
        );
        break;
      }
      case 3: {
        // Restore to previous.
        if (savedState) {
          workCtx.putImageData(savedState, 0, 0);
          savedState = null;
        }
        break;
      }
      // 0 (unspecified) and 1 (do not dispose): leave canvas as-is.
    }
  }

  // Free the working canvases.
  work.width = 0;
  work.height = 0;
  patchCanvas.width = 0;
  patchCanvas.height = 0;

  // Step 2: cap frame count by uniform sampling (preserve total runtime by
  // accumulating dropped delays into the kept frame).
  const originalFrameCount = fullFrames.length;
  if (fullFrames.length <= MAX_FRAMES) {
    return {
      frames: fullFrames,
      delays: fullDelays,
      width,
      height,
      originalFrameCount,
    };
  }

  const sampledFrames: HTMLCanvasElement[] = [];
  const sampledDelays: number[] = [];
  const step = fullFrames.length / MAX_FRAMES;
  let nextKeep = 0;
  let accumulatedDelay = 0;

  for (let i = 0; i < fullFrames.length; i++) {
    accumulatedDelay += fullDelays[i];
    if (i >= Math.floor(nextKeep)) {
      sampledFrames.push(fullFrames[i]);
      sampledDelays.push(accumulatedDelay);
      accumulatedDelay = 0;
      nextKeep += step;
    } else {
      // Discard this frame (and roll its delay into the next kept one).
      fullFrames[i].width = 0;
      fullFrames[i].height = 0;
    }
  }

  // If trailing time leaked past the last kept frame, push it onto the last delay.
  if (accumulatedDelay > 0 && sampledDelays.length > 0) {
    sampledDelays[sampledDelays.length - 1] += accumulatedDelay;
  }

  return {
    frames: sampledFrames,
    delays: sampledDelays,
    width,
    height,
    originalFrameCount,
  };
}

function drawPatch(
  patchCanvas: HTMLCanvasElement,
  patchCtx: CanvasRenderingContext2D,
  frame: ParsedFrame
): void {
  const { width, height } = frame.dims;
  if (patchCanvas.width !== width || patchCanvas.height !== height) {
    patchCanvas.width = width;
    patchCanvas.height = height;
  } else {
    patchCtx.clearRect(0, 0, width, height);
  }
  // Copy into a fresh Uint8ClampedArray<ArrayBuffer> — gifuct-js's typed array
  // is generic over ArrayBufferLike (could be SharedArrayBuffer), which the
  // ImageData constructor type doesn't accept.
  const buf = new Uint8ClampedArray(frame.patch);
  const imageData = new ImageData(buf, width, height);
  patchCtx.putImageData(imageData, 0, 0);
}

/** Free all canvas memory held by a DecodedGif. */
export function releaseDecodedGif(decoded: DecodedGif): void {
  for (const c of decoded.frames) {
    c.width = 0;
    c.height = 0;
  }
}
