/**
 * Cheap structural check of a picked GIF (12 §3): parse the container (no
 * frame decoding) so a broken file is rejected *before* it replaces the
 * current work. The full decode still happens in the processing hook.
 */
import { parseGIF } from "gifuct-js";

export type GifCheck = { ok: true; frames: number } | { ok: false; message: string };

export async function validateGifFile(file: File): Promise<GifCheck> {
  try {
    const buf = await file.arrayBuffer();
    const gif = parseGIF(buf);
    const frames = gif.frames.filter((f) => "image" in f && f.image).length;
    if (frames === 0) return { ok: false, message: "この GIF にはコマがありません。別のファイルを選んでください。" };
    return { ok: true, frames };
  } catch {
    return { ok: false, message: "GIF を読み込めませんでした。壊れているか、対応していない形式です。別のファイルを選んでください。" };
  }
}
