"use client";

import { useEffect, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import { generateGif } from "@/lib/gifEncoder";
import { encodeAnimatedGif } from "@/lib/gif/animatedEncoder";

type Check = {
  name: string;
  frames: number;
  width: number;
  height: number;
  transparentIndexSet: boolean;
  eyePixel: [number, number, number, number];
  bgPixel: [number, number, number, number];
  opaqueBlackCount: number;
  transparentCount: number;
  pass: boolean;
};

/** Composite frame 0 of a GIF into RGBA via gifuct-js (transparent → alpha 0). */
async function decodeFirstFrame(blob: Blob): Promise<{ frames: number; width: number; height: number; rgba: Uint8ClampedArray; transparentIndexSet: boolean }> {
  const buf = await blob.arrayBuffer();
  const parsed = parseGIF(buf);
  const frames = decompressFrames(parsed, true);
  const f0 = frames[0];
  const w = parsed.lsd.width, h = parsed.lsd.height;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const patch = f0.patch; // RGBA already, transparent pixels alpha 0
  const { left, top, width: pw, height: ph } = f0.dims;
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const si = (y * pw + x) * 4;
    const di = ((top + y) * w + (left + x)) * 4;
    rgba[di] = patch[si]; rgba[di + 1] = patch[si + 1]; rgba[di + 2] = patch[si + 2]; rgba[di + 3] = patch[si + 3];
  }
  return { frames: frames.length, width: w, height: h, rgba, transparentIndexSet: f0.transparentIndex !== undefined && f0.transparentIndex !== null };
}

/** Decode every frame: counts of transparent / opaque / near-black pixels and disposal. */
async function decodeAll(blob: Blob): Promise<Array<{ transparent: number; opaque: number; black: number; blackOpaque: number; disposal: number }>> {
  const buf = await blob.arrayBuffer();
  const parsed = parseGIF(buf);
  const frames = decompressFrames(parsed, true);
  return frames.map((f) => {
    let transparent = 0, opaque = 0, black = 0, blackOpaque = 0;
    const p = f.patch;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) transparent++;
      else {
        opaque++;
        if (p[i] < 16 && p[i + 1] < 16 && p[i + 2] < 16) { black++; blackOpaque++; }
      }
    }
    return { transparent, opaque, black, blackOpaque, disposal: f.disposalType };
  });
}

function makeFace(size: number, face: string, eye: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = eye;
  ctx.fillRect(size * 0.35, size * 0.4, size * 0.08, size * 0.12);
  ctx.fillRect(size * 0.57, size * 0.4, size * 0.08, size * 0.12);
  return c;
}

export default function GifCheck() {
  const [result, setResult] = useState<string>("running…");

  useEffect(() => {
    (async () => {
      const out: Check[] = [];
      const size = 112;
      const cases: Array<[string, string, string, "static" | "animated"]> = [
        ["black eyes on white face (static bounce)", "#ffffff", "#000000", "static"],
        ["white eyes on black face (static bounce)", "#000000", "#ffffff", "static"],
        ["black eyes on white face (animated encoder)", "#ffffff", "#000000", "animated"],
        ["magenta face + black eyes (sentinel must avoid magenta)", "#ff00ff", "#000000", "static"],
      ];
      for (const [name, face, eye, kind] of cases) {
        const base = makeFace(size, face, eye);
        const blob =
          kind === "static"
            ? await generateGif(base, "bounce", size, "normal")
            : await encodeAnimatedGif([base, base, base], [50, 50, 50], size, 0);
        const d = await decodeFirstFrame(blob);
        const px = (x: number, y: number): [number, number, number, number] => {
          const i = (y * d.width + x) * 4;
          return [d.rgba[i], d.rgba[i + 1], d.rgba[i + 2], d.rgba[i + 3]];
        };
        const eyePixel = px(Math.round(size * 0.39), Math.round(size * 0.46));
        const bgPixel = px(2, 2);
        let opaqueBlackCount = 0, transparentCount = 0;
        for (let i = 0; i < d.rgba.length; i += 4) {
          if (d.rgba[i + 3] === 0) transparentCount++;
          else if (d.rgba[i] < 16 && d.rgba[i + 1] < 16 && d.rgba[i + 2] < 16) opaqueBlackCount++;
        }
        const eyeIsBlack = eye === "#000000";
        const pass =
          d.frames >= 3 && d.width === size && d.height === size && d.transparentIndexSet &&
          bgPixel[3] === 0 && eyePixel[3] === 255 &&
          (eyeIsBlack ? eyePixel[0] < 40 && eyePixel[1] < 40 && eyePixel[2] < 40 : eyePixel[0] > 200) &&
          (eyeIsBlack ? opaqueBlackCount > 50 : true);
        out.push({ name, frames: d.frames, width: d.width, height: d.height, transparentIndexSet: d.transparentIndexSet, eyePixel, bgPixel, opaqueBlackCount, transparentCount, pass });
      }

      // R2 §1 cases: fully opaque frames must not get a transparent index,
      // mixed sequences keep per-frame alpha, alpha 127/128 boundary.
      const solid = (color: string) => { const c = document.createElement("canvas"); c.width = size; c.height = size; const x = c.getContext("2d")!; x.fillStyle = color; x.fillRect(0, 0, size, size); return c; };
      const noise = () => { const c = document.createElement("canvas"); c.width = size; c.height = size; const x = c.getContext("2d")!; const img = x.createImageData(size, size); for (let i = 0; i < img.data.length; i += 4) { const p = i / 4; img.data[i] = (p * 37) % 256; img.data[i + 1] = (p * 91) % 256; img.data[i + 2] = (p * 53) % 256; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); return c; };
      const halfAlpha = () => { const c = document.createElement("canvas"); c.width = size; c.height = size; const x = c.getContext("2d")!; const img = x.createImageData(size, size); for (let i = 0; i < img.data.length; i += 4) { const col = (i / 4) % size; img.data[i] = 20; img.data[i + 1] = 40; img.data[i + 2] = 60; img.data[i + 3] = col < size / 2 ? 127 : 128; } x.putImageData(img, 0, 0); return c; };
      const extra: Array<[string, HTMLCanvasElement[], (frames: Awaited<ReturnType<typeof decodeAll>>) => boolean]> = [
        ["opaque solid black × 3 frames: zero transparent pixels", [solid("#000"), solid("#000"), solid("#000")], (fr) => fr.every((f) => f.transparent === 0 && f.opaque === size * size && f.black === size * size)],
        ["opaque photo-like noise: zero transparent pixels", [noise(), noise()], (fr) => fr.every((f) => f.transparent === 0)],
        ["mixed: opaque black → face on transparent → opaque white", [solid("#000"), makeFace(size, "#fff", "#000"), solid("#fff")], (fr) => fr[0].transparent === 0 && fr[1].transparent > 0 && fr[1].blackOpaque > 50 && fr[2].transparent === 0 && fr.every((f) => f.disposal === 2)],
        ["all-transparent frame", [(() => { const c = document.createElement("canvas"); c.width = size; c.height = size; return c; })()], (fr) => fr[0].transparent === size * size],
        ["alpha 127 (left half) transparent / 128 (right half) opaque", [halfAlpha()], (fr) => fr[0].transparent === (size * size) / 2 && fr[0].opaque === (size * size) / 2],
      ];
      for (const [name, canvases, check] of extra) {
        const blob = await encodeAnimatedGif(canvases, canvases.map(() => 50), size, 0);
        const fr = await decodeAll(blob);
        const pass = check(fr);
        out.push({ name, frames: fr.length, width: size, height: size, transparentIndexSet: fr.some((f) => f.transparent > 0), eyePixel: [0, 0, 0, 0], bgPixel: [0, 0, 0, 0], opaqueBlackCount: fr[0].black, transparentCount: fr[0].transparent, pass });
        for (const c of canvases) { c.width = 0; c.height = 0; }
      }
      setResult(JSON.stringify({ allPass: out.every((c) => c.pass), checks: out }, null, 2));
    })().catch((e) => setResult("ERROR: " + (e instanceof Error ? e.message : String(e))));
  }, []);

  return (
    <main className="p-6 text-xs text-gray-200">
      <h1 className="text-base font-bold mb-2">GIF transparency check (dev only)</h1>
      <pre id="gif-check-result" className="whitespace-pre-wrap bg-gray-900 p-3 rounded">{result}</pre>
    </main>
  );
}
