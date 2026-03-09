"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface BrushEditorProps {
  bgRemovedBlob: Blob;
  originalBlob: Blob;
  onConfirm: (adjustedBlob: Blob) => void;
  onSkip: () => void;
}

const PC_CANVAS_SIZE = 320;
const MOBILE_MAX = 300;
const MOBILE_PADDING = 48;
const INTERNAL_SIZE = 320;
const CHECK_SIZE = 10;
const MAX_UNDO = 20;

type BrushMode = "eraser" | "restore";

function computeDisplaySize(): number {
  if (typeof window === "undefined") return PC_CANVAS_SIZE;
  const w = window.innerWidth;
  if (w >= 768) return PC_CANVAS_SIZE;
  return Math.min(MOBILE_MAX, w - MOBILE_PADDING);
}

export default function BrushEditor({
  bgRemovedBlob,
  originalBlob,
  onConfirm,
  onSkip,
}: BrushEditorProps) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);

  const [brushMode, setBrushMode] = useState<BrushMode>("eraser");
  const [brushSize, setBrushSize] = useState(20);
  const [undoCount, setUndoCount] = useState(0);
  const [displaySize, setDisplaySize] = useState(computeDisplaySize);
  const [loaded, setLoaded] = useState(false);

  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Responsive display size
  useEffect(() => {
    const handleResize = () => setDisplaySize(computeDisplaySize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load images
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [bgImg, origImg] = await Promise.all([
        createImageBitmap(bgRemovedBlob),
        createImageBitmap(originalBlob),
      ]);
      if (cancelled) return;

      // Working canvas (bg-removed, scaled to INTERNAL_SIZE)
      const working = document.createElement("canvas");
      working.width = INTERNAL_SIZE;
      working.height = INTERNAL_SIZE;
      const wCtx = working.getContext("2d")!;
      wCtx.drawImage(bgImg, 0, 0, INTERNAL_SIZE, INTERNAL_SIZE);
      workingCanvasRef.current = working;

      // Original canvas (for restore brush)
      const orig = document.createElement("canvas");
      orig.width = INTERNAL_SIZE;
      orig.height = INTERNAL_SIZE;
      const oCtx = orig.getContext("2d")!;
      oCtx.drawImage(origImg, 0, 0, INTERNAL_SIZE, INTERNAL_SIZE);
      originalCanvasRef.current = orig;

      undoStackRef.current = [];
      setUndoCount(0);
      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [bgRemovedBlob, originalBlob]);

  // Draw display canvas
  const redraw = useCallback(() => {
    const display = displayCanvasRef.current;
    const working = workingCanvasRef.current;
    if (!display || !working) return;
    const ctx = display.getContext("2d")!;

    // Checkerboard
    for (let y = 0; y < INTERNAL_SIZE; y += CHECK_SIZE) {
      for (let x = 0; x < INTERNAL_SIZE; x += CHECK_SIZE) {
        ctx.fillStyle =
          (Math.floor(x / CHECK_SIZE) + Math.floor(y / CHECK_SIZE)) % 2 === 0
            ? "#2a2a2a"
            : "#3a3a3a";
        ctx.fillRect(x, y, CHECK_SIZE, CHECK_SIZE);
      }
    }

    // Working image on top
    ctx.drawImage(working, 0, 0);
  }, []);

  useEffect(() => {
    if (loaded) redraw();
  }, [loaded, redraw]);

  // Push undo
  const pushUndo = useCallback(() => {
    const working = workingCanvasRef.current;
    if (!working) return;
    const ctx = working.getContext("2d")!;
    const data = ctx.getImageData(0, 0, INTERNAL_SIZE, INTERNAL_SIZE);
    const stack = undoStackRef.current;
    if (stack.length >= MAX_UNDO) stack.shift();
    stack.push(data);
    setUndoCount(stack.length);
  }, []);

  // Undo
  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    const working = workingCanvasRef.current;
    if (stack.length === 0 || !working) return;
    const data = stack.pop()!;
    const ctx = working.getContext("2d")!;
    ctx.putImageData(data, 0, 0);
    setUndoCount(stack.length);
    redraw();
  }, [redraw]);

  // Get canvas coords from client coords
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * INTERNAL_SIZE,
      y: ((clientY - rect.top) / rect.height) * INTERNAL_SIZE,
    };
  }, []);

  // Draw brush stroke at position
  const drawAt = useCallback(
    (x: number, y: number) => {
      const working = workingCanvasRef.current;
      const original = originalCanvasRef.current;
      if (!working) return;
      const ctx = working.getContext("2d")!;

      if (brushMode === "eraser") {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (brushMode === "restore" && original) {
        // Copy pixels from original in brush area
        const oCtx = original.getContext("2d")!;
        const r = brushSize / 2;
        const sx = Math.max(0, Math.floor(x - r));
        const sy = Math.max(0, Math.floor(y - r));
        const ex = Math.min(INTERNAL_SIZE, Math.ceil(x + r));
        const ey = Math.min(INTERNAL_SIZE, Math.ceil(y + r));
        const w = ex - sx;
        const h = ey - sy;
        if (w <= 0 || h <= 0) return;

        const origData = oCtx.getImageData(sx, sy, w, h);
        const workData = ctx.getImageData(sx, sy, w, h);
        const r2 = r * r;

        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            const dx = sx + px - x;
            const dy = sy + py - y;
            if (dx * dx + dy * dy <= r2) {
              const i = (py * w + px) * 4;
              workData.data[i] = origData.data[i];
              workData.data[i + 1] = origData.data[i + 1];
              workData.data[i + 2] = origData.data[i + 2];
              workData.data[i + 3] = origData.data[i + 3];
            }
          }
        }
        ctx.putImageData(workData, sx, sy);
      }

      redraw();
    },
    [brushMode, brushSize, redraw]
  );

  // Interpolated line drawing
  const drawLine = useCallback(
    (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / (brushSize / 4)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        drawAt(from.x + dx * t, from.y + dy * t);
      }
    },
    [drawAt, brushSize]
  );

  // Pointer handlers
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      pushUndo();
      isDrawingRef.current = true;
      const pos = getCanvasCoords(clientX, clientY);
      lastPosRef.current = pos;
      drawAt(pos.x, pos.y);
    },
    [pushUndo, getCanvasCoords, drawAt]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawingRef.current) return;
      const pos = getCanvasCoords(clientX, clientY);
      if (lastPosRef.current) {
        drawLine(lastPosRef.current, pos);
      }
      lastPosRef.current = pos;
    },
    [getCanvasCoords, drawLine]
  );

  const handlePointerUp = useCallback(() => {
    isDrawingRef.current = false;
    lastPosRef.current = null;
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handlePointerMove(e.clientX, e.clientY);

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  // Confirm
  const handleConfirm = useCallback(() => {
    const working = workingCanvasRef.current;
    if (!working) return;
    working.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, "image/png");
  }, [onConfirm]);

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg className="animate-spin h-5 w-5 text-purple-400" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
        </svg>
        <span className="text-xs text-gray-400">ブラシエディタを読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-sm font-semibold text-gray-300">
        透過の微調整（ブラシ）
      </h3>

      {/* Brush mode toggle */}
      <div className="flex gap-2 w-full" style={{ maxWidth: displaySize }}>
        {([
          { value: "eraser" as BrushMode, label: "消しゴム", desc: "透明にする" },
          { value: "restore" as BrushMode, label: "復元", desc: "元画像に戻す" },
        ]).map(({ value, label, desc }) => (
          <button
            key={value}
            onClick={() => setBrushMode(value)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors border ${
              brushMode === value
                ? "border-purple-500 bg-purple-600/20 text-purple-300"
                : "border-gray-600 bg-transparent text-gray-400 hover:border-gray-400 hover:text-gray-200"
            }`}
          >
            <span className="block font-medium">{label}</span>
            <span className="block text-[10px] opacity-70">{desc}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={displayCanvasRef}
        width={INTERNAL_SIZE}
        height={INTERNAL_SIZE}
        className="rounded-lg border border-gray-600 touch-none"
        style={{
          width: displaySize,
          height: displaySize,
          cursor: "crosshair",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />

      {/* Brush size slider */}
      <div className="w-full" style={{ maxWidth: displaySize }}>
        <label className="text-xs text-gray-400 block mb-1">
          ブラシサイズ: {brushSize}px
        </label>
        <input
          type="range"
          min={5}
          max={60}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleUndo}
          disabled={undoCount === 0}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors min-h-[44px] md:min-h-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          元に戻す
        </button>
        <button
          onClick={handleConfirm}
          className="px-4 py-2 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors min-h-[44px] md:min-h-0"
        >
          完了
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded text-gray-500 text-sm hover:text-gray-300 transition-colors min-h-[44px] md:min-h-0"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
