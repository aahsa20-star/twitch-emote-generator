/// <reference lib="webworker" />
/**
 * Web Worker entry for encodeGifSync (keeps quantisation + LZW off the main thread).
 */
import { encodeGifSync, type GifEncodeOptions, type GifFrameInput } from "./encoder-core";

interface Req { id: number; frames: GifFrameInput[]; opts: GifEncodeOptions }

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, frames, opts } = e.data;
  try {
    const { bytes, reports } = encodeGifSync(frames, opts);
    (self as unknown as Worker).postMessage({ id, ok: true, bytes, reports }, [bytes.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
