import GIF from "gif.js";

/**
 * Encode a series of pre-rendered frame canvases into an animated GIF.
 *
 * Used by the GIF-source pipeline: caller has already run each frame through
 * the emote pipeline at the target output size, so we just stack them with
 * the original per-frame delays.
 */
export async function encodeAnimatedGif(
  frames: HTMLCanvasElement[],
  delays: number[],
  size: number
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error("エンコード対象のフレームがありません");
  }
  if (frames.length !== delays.length) {
    throw new Error("frames と delays の数が一致しません");
  }

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: size,
      height: size,
      workerScript: "/gif.worker.js",
      transparent: 0x00000000 as unknown as string,
      repeat: 0,
    });

    for (let i = 0; i < frames.length; i++) {
      gif.addFrame(frames[i], { delay: delays[i], copy: true });
    }

    gif.on("finished", (blob: Blob) => resolve(blob));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gif as any).on("error", (err: Error) => reject(err));
    gif.render();
  });
}
