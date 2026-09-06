"use client";

import { useEffect, useRef, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import { ANIMATION_CATALOG, ANIMATION_CATEGORIES } from "@/lib/animations/catalog";
import { generators, registryConsistency, FRAME_COUNT } from "@/lib/animations/index";
import { generateGif } from "@/lib/gifEncoder";
import type { AnimationSpeed, AnimationType } from "@/types/emote";

const STRIP = [0, 4, 8, 12, 16, 19];

type Row = {
  id: string;
  label: string;
  category: string;
  frameMs: number;
  /** representative-frame content coverage relative to the base (R2 §3) */
  repCoverage: number;
  repFrame: number;
  /** loop seam: |frame19 − frame0| relative to the mean consecutive-frame difference (07: ループのつなぎ) */
  seamRatio: number;
  seamAbs: number;
  gif?: { url: string; bytes: number; frames: number; w: number; h: number; ms: number; speeds: Record<AnimationSpeed, number> };
  error?: string;
};

type BaseKind = "face" | "black" | "white" | "wide" | "tall" | "photo" | "text";

function makeBase(kind: BaseKind, SIZE: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext("2d")!;
  if (kind === "photo") {
    // fully opaque, many colors: gradient + deterministic noise
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const i = (y * SIZE + x) * 4;
      const n = ((x * 7919 + y * 104729) % 97) - 48;
      img.data[i] = Math.max(0, Math.min(255, (x / SIZE) * 255 + n));
      img.data[i + 1] = Math.max(0, Math.min(255, (y / SIZE) * 255 + n));
      img.data[i + 2] = Math.max(0, Math.min(255, 180 - (x + y) / (2 * SIZE) * 160 + n));
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  if (kind === "text") {
    ctx.font = `bold ${Math.round(SIZE * 0.5)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(2, SIZE * 0.08); ctx.strokeStyle = "#000"; ctx.lineJoin = "round";
    ctx.strokeText("GG", SIZE / 2, SIZE / 2);
    ctx.fillStyle = "#ffcc00"; ctx.fillText("GG", SIZE / 2, SIZE / 2);
    return c;
  }
  const face = kind === "black" ? "#111" : kind === "white" ? "#fff" : "#ffcc66";
  const eye = kind === "black" ? "#fff" : "#000";
  const w = kind === "wide" ? 0.46 : kind === "tall" ? 0.22 : 0.36;
  const h = kind === "wide" ? 0.22 : kind === "tall" ? 0.46 : 0.36;
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.ellipse(SIZE / 2, SIZE / 2, SIZE * w, SIZE * h, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = eye;
  ctx.fillRect(SIZE * 0.4, SIZE * 0.42, SIZE * 0.06, SIZE * 0.1);
  ctx.fillRect(SIZE * 0.56, SIZE * 0.42, SIZE * 0.06, SIZE * 0.1);
  ctx.strokeStyle = eye; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(SIZE / 2, SIZE * 0.58, SIZE * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  return c;
}

/** Mean absolute RGBA difference per channel (0..1) between two same-size canvases. */
function frameDiff(a: HTMLCanvasElement, b: HTMLCanvasElement): number {
  const da = a.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, a.width, a.height).data;
  const db = b.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, b.width, b.height).data;
  let sum = 0;
  for (let i = 0; i < da.length; i++) sum += Math.abs(da[i] - db[i]);
  return sum / (da.length * 255);
}

/** Fraction of pixels with alpha > 16. */
function coverage(c: HTMLCanvasElement): number {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 16) n++;
  return n / (c.width * c.height);
}

export default function AnimationSheet() {
  // dev-only handles for automated acceptance scripts (frame strips / playback sampling)
  if (typeof window !== "undefined") {
    (window as unknown as { __animDev?: unknown }).__animDev = { generators, catalog: ANIMATION_CATALOG, FRAME_COUNT, makeBase };
  }
  // Query params let automated runs pick the scenario: ?base=photo&size=112&gif=1
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("rendering…");
  const [withGif, setWithGif] = useState(q?.get("gif") === "1");
  const [baseKind, setBaseKind] = useState<BaseKind>((q?.get("base") as BaseKind) || "face");
  const [SIZE, setSize] = useState(Number(q?.get("size")) || 64);
  const stripRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const baseRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cons = registryConsistency();
      const base = makeBase(baseKind, SIZE);
      const baseCoverage = coverage(base);
      baseRef.current = base;
      const out: Row[] = [];
      const t0 = performance.now();
      for (const entry of ANIMATION_CATALOG) {
        if (cancelled) return;
        const gen = generators[entry.id];
        const s = performance.now();
        const frames: HTMLCanvasElement[] = [];
        let error: string | undefined;
        try {
          for (let i = 0; i < FRAME_COUNT; i++) frames.push(gen(base, i, FRAME_COUNT));
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
        }
        const frameMs = performance.now() - s;
        const repFrame = (entry as { previewFrame?: number }).previewFrame ?? 0;
        let seamRatio = 0, seamAbs = 0;
        if (!error) {
          const diffs: number[] = [];
          for (let i = 1; i < frames.length; i++) diffs.push(frameDiff(frames[i - 1], frames[i]));
          const mean = diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length);
          seamAbs = frameDiff(frames[frames.length - 1], frames[0]);
          seamRatio = seamAbs / Math.max(0.002, mean);
        }
        // relative to the base image's own coverage (1.0 = as much content visible as the input)
        const repCoverage = error ? 0 : coverage(frames[repFrame]) / Math.max(0.01, baseCoverage);
        const row: Row = { id: entry.id, label: entry.label, category: entry.category, frameMs, error, repCoverage, repFrame, seamRatio, seamAbs };
        // draw strip: representative frame first (highlighted), then the 6 sample frames
        const strip = stripRefs.current.get(entry.id);
        if (strip && !error) {
          const ctx = strip.getContext("2d")!;
          ctx.clearRect(0, 0, strip.width, strip.height);
          ctx.drawImage(frames[repFrame], 0, 0);
          ctx.strokeStyle = repCoverage < 0.25 ? "#ff4d4d" : "#7c3aed";
          ctx.lineWidth = 2;
          ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
          STRIP.forEach((fi, k) => ctx.drawImage(frames[fi], (k + 1) * (SIZE + 2), 0));
        }
        for (const f of frames) if (f !== base) { f.width = 0; f.height = 0; }
        if (withGif && !error) {
          const speeds: Record<AnimationSpeed, number> = { slow: 0, normal: 0, fast: 0 };
          let blob: Blob | null = null;
          for (const sp of ["slow", "normal", "fast"] as AnimationSpeed[]) {
            const b = await generateGif(base, entry.id as AnimationType, SIZE, sp);
            speeds[sp] = b.size;
            if (sp === "normal") blob = b;
          }
          const gms = performance.now() - s - frameMs;
          const parsed = parseGIF(await blob!.arrayBuffer());
          const fr = decompressFrames(parsed, false);
          row.gif = { url: URL.createObjectURL(blob!), bytes: blob!.size, frames: fr.length, w: parsed.lsd.width, h: parsed.lsd.height, ms: gms, speeds };
        }
        out.push(row);
        // Update the UI every 10 rows; yield with a microtask (setTimeout is
        // throttled to ~1/min in hidden tabs, which stalled automated runs).
        if (out.length % 10 === 0) setRows([...out]);
        await Promise.resolve();
      }
      setRows([...out]);
      const total = performance.now() - t0;
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      setStatus(`done: ${out.length} animations, registry ${cons.ok ? "OK" : "MISMATCH " + JSON.stringify(cons)}, total ${Math.round(total)} ms, errors ${out.filter((r) => r.error).length}${mem ? `, heap ${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB` : ""}`);
    })();
    return () => { cancelled = true; };
  }, [withGif, baseKind, SIZE]);

  const byCat = ANIMATION_CATEGORIES.map((c) => ({ ...c, rows: rows.filter((r) => r.category === c.id) }));

  return (
    <main className="p-4 text-xs text-gray-200 space-y-3">
      <h1 className="text-base font-bold">Animation sheet (dev only) — {ANIMATION_CATALOG.length} presets</h1>
      <div className="flex gap-3 items-center flex-wrap">
        <label className="flex items-center gap-1"><input type="checkbox" checked={withGif} onChange={(e) => setWithGif(e.target.checked)} /> encode GIF (slow/normal/fast) + decode check</label>
        <label className="flex items-center gap-1">base:
          <select value={baseKind} onChange={(e) => setBaseKind(e.target.value as BaseKind)} className="bg-gray-800 rounded px-1">
            {["face", "black", "white", "wide", "tall", "photo", "text"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">size:
          <select value={SIZE} onChange={(e) => setSize(Number(e.target.value))} className="bg-gray-800 rounded px-1">
            {[28, 64, 112].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <span id="sheet-status">{status}</span>
        <span id="sheet-blank">blank static cards (coverage &lt; 25%): {rows.filter((r) => r.repCoverage < 0.25).map((r) => r.id).join(", ") || "none"}</span>
        <span id="sheet-seam">loop seams (19→0 diff &gt; 3× mean step and &gt; 2%): {rows.filter((r) => r.seamRatio > 3 && r.seamAbs > 0.02).map((r) => `${r.id}(${r.seamRatio.toFixed(1)}×, ${(r.seamAbs * 100).toFixed(1)}%)`).join(", ") || "none"}</span>
      </div>
      <pre id="sheet-json" className="hidden">{JSON.stringify(rows.map((r) => ({ id: r.id, frameMs: Math.round(r.frameMs), error: r.error, repFrame: r.repFrame, repCoverage: +r.repCoverage.toFixed(2), seamRatio: +r.seamRatio.toFixed(2), seamAbs: +r.seamAbs.toFixed(4), gif: r.gif && { bytes: r.gif.bytes, frames: r.gif.frames, w: r.gif.w, h: r.gif.h, ms: Math.round(r.gif.ms), speeds: r.gif.speeds } })))}</pre>
      {byCat.map((c) => (
        <section key={c.id}>
          <h2 className="font-semibold text-gray-300 mt-2 mb-1">{c.label} ({ANIMATION_CATALOG.filter((a) => a.category === c.id).length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {ANIMATION_CATALOG.filter((a) => a.category === c.id).map((entry) => {
              const row = rows.find((r) => r.id === entry.id);
              return (
                <div key={entry.id} className="flex items-center gap-2 bg-gray-900 rounded p-1">
                  <canvas
                    ref={(el) => { if (el) stripRefs.current.set(entry.id, el); }}
                    width={(STRIP.length + 1) * (SIZE + 2)}
                    height={SIZE}
                    className="checkerboard rounded"
                    style={{ width: (STRIP.length + 1) * (SIZE + 2) * (SIZE <= 28 ? 1.5 : 0.5), height: SIZE * (SIZE <= 28 ? 1.5 : 0.5) }}
                  />
                  {row?.gif && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.gif.url} width={SIZE / 2} height={SIZE / 2} alt="" className="checkerboard rounded" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate"><span className="text-gray-500">{entry.id}</span> {entry.label}</div>
                    <div className="text-gray-500">
                      {row ? `${Math.round(row.frameMs)}ms/20f` : "…"}
                      {row?.gif && ` · gif ${Math.round(row.gif.ms)}ms ${(row.gif.bytes / 1024).toFixed(1)}KB ${row.gif.frames}f ${row.gif.w}px`}
                      {row?.error && <span className="text-red-400"> ERROR {row.error}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
