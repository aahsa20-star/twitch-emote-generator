"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ImageAdjustEditorProps {
  file: File;
  onConfirm: (adjustedFile: File) => void;
  onSkip: () => void;
}

const PC_CANVAS_SIZE = 320;
const MOBILE_MAX = 300;
const MOBILE_PADDING = 48;
const INTERNAL_SIZE = 320; // Internal resolution (always square)
const CHECK_SIZE = 10;
const HANDLE_SIZE = 12;
const HANDLE_SIZE_ACTIVE = 16;
const HANDLE_HALF = HANDLE_SIZE / 2;
const HANDLE_HALF_ACTIVE = HANDLE_SIZE_ACTIVE / 2;
const MIN_CROP = 40;
const HANDLE_HIT = HANDLE_HALF + 6;

type HandleId = "tl" | "tc" | "tr" | "ml" | "mr" | "bl" | "bc" | "br";
type DragMode =
  | { type: "none" }
  | { type: "image" }
  | { type: "handle"; id: HandleId };

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function getHandlePositions(crop: CropRect) {
  const { x, y, w, h } = crop;
  return {
    tl: { x, y },
    tc: { x: x + w / 2, y },
    tr: { x: x + w, y },
    ml: { x, y: y + h / 2 },
    mr: { x: x + w, y: y + h / 2 },
    bl: { x, y: y + h },
    bc: { x: x + w / 2, y: y + h },
    br: { x: x + w, y: y + h },
  };
}

function hitTestHandle(px: number, py: number, crop: CropRect): HandleId | null {
  const handles = getHandlePositions(crop);
  for (const [id, pos] of Object.entries(handles)) {
    if (Math.abs(px - pos.x) <= HANDLE_HIT && Math.abs(py - pos.y) <= HANDLE_HIT) {
      return id as HandleId;
    }
  }
  return null;
}

const HANDLE_CURSORS: Record<HandleId, string> = {
  tl: "nwse-resize",
  tr: "nesw-resize",
  bl: "nesw-resize",
  br: "nwse-resize",
  tc: "ns-resize",
  bc: "ns-resize",
  ml: "ew-resize",
  mr: "ew-resize",
};

function computeCanvasDisplaySize(): number {
  if (typeof window === "undefined") return PC_CANVAS_SIZE;
  const w = window.innerWidth;
  // md breakpoint = 768px
  if (w >= 768) return PC_CANVAS_SIZE;
  return Math.min(MOBILE_MAX, w - MOBILE_PADDING);
}

export default function ImageAdjustEditor({ file, onConfirm, onSkip }: ImageAdjustEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: INTERNAL_SIZE, h: INTERNAL_SIZE });
  const [canvasDisplaySize, setCanvasDisplaySize] = useState(computeCanvasDisplaySize);
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);

  const dragModeRef = useRef<DragMode>({ type: "none" });
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    crop: { x: 0, y: 0, w: INTERNAL_SIZE, h: INTERNAL_SIZE },
  });

  // Responsive canvas size
  useEffect(() => {
    const handleResize = () => setCanvasDisplaySize(computeCanvasDisplaySize());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(100);
      setOffset({ x: 0, y: 0 });
      setCrop({ x: 0, y: 0, w: INTERNAL_SIZE, h: INTERNAL_SIZE });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compute draw params
  const getDrawParams = useCallback(() => {
    if (!image) return null;
    const scale = zoom / 100;
    const aspect = image.naturalWidth / image.naturalHeight;
    let drawW: number, drawH: number;
    if (aspect >= 1) {
      drawW = INTERNAL_SIZE * scale;
      drawH = (INTERNAL_SIZE / aspect) * scale;
    } else {
      drawH = INTERNAL_SIZE * scale;
      drawW = INTERNAL_SIZE * aspect * scale;
    }
    const drawX = (INTERNAL_SIZE - drawW) / 2 + offset.x;
    const drawY = (INTERNAL_SIZE - drawH) / 2 + offset.y;
    return { drawX, drawY, drawW, drawH };
  }, [image, zoom, offset]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d")!;

    // 1. Checkerboard
    for (let y = 0; y < INTERNAL_SIZE; y += CHECK_SIZE) {
      for (let x = 0; x < INTERNAL_SIZE; x += CHECK_SIZE) {
        ctx.fillStyle =
          (Math.floor(x / CHECK_SIZE) + Math.floor(y / CHECK_SIZE)) % 2 === 0
            ? "#2a2a2a"
            : "#3a3a3a";
        ctx.fillRect(x, y, CHECK_SIZE, CHECK_SIZE);
      }
    }

    // 2. Image
    const params = getDrawParams();
    if (params) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, params.drawX, params.drawY, params.drawW, params.drawH);
    }

    // 3. Dark overlay outside crop
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, INTERNAL_SIZE, crop.y); // top
    ctx.fillRect(0, crop.y + crop.h, INTERNAL_SIZE, INTERNAL_SIZE - crop.y - crop.h); // bottom
    ctx.fillRect(0, crop.y, crop.x, crop.h); // left
    ctx.fillRect(crop.x + crop.w, crop.y, INTERNAL_SIZE - crop.x - crop.w, crop.h); // right

    // 4. Crop border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);

    // 5. Handles (active handle highlighted)
    const handles = getHandlePositions(crop);
    for (const [id, pos] of Object.entries(handles)) {
      const isActive = activeHandle === id;
      const size = isActive ? HANDLE_SIZE_ACTIVE : HANDLE_SIZE;
      const half = isActive ? HANDLE_HALF_ACTIVE : HANDLE_HALF;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = isActive ? "#9146FF" : "#ffffff";
      ctx.fillRect(pos.x - half, pos.y - half, size, size);
      ctx.restore();
    }
  }, [image, zoom, offset, crop, getDrawParams, activeHandle]);

  // Get canvas-relative coordinates from client coordinates
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * INTERNAL_SIZE,
      y: ((clientY - rect.top) / rect.height) * INTERNAL_SIZE,
    };
  }, []);

  // Pointer down: determine drag mode
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      const { x: cx, y: cy } = getCanvasCoords(clientX, clientY);

      // Priority 1: handle
      const handle = hitTestHandle(cx, cy, crop);
      if (handle) {
        dragModeRef.current = { type: "handle", id: handle };
        setActiveHandle(handle);
        dragStartRef.current = {
          x: clientX,
          y: clientY,
          offsetX: offset.x,
          offsetY: offset.y,
          crop: { ...crop },
        };
        return;
      }

      // Priority 2: inside crop → image drag
      if (cx >= crop.x && cx <= crop.x + crop.w && cy >= crop.y && cy <= crop.y + crop.h) {
        dragModeRef.current = { type: "image" };
        dragStartRef.current = {
          x: clientX,
          y: clientY,
          offsetX: offset.x,
          offsetY: offset.y,
          crop: { ...crop },
        };
      }
    },
    [offset, crop, getCanvasCoords]
  );

  // Pointer move: apply drag
  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const mode = dragModeRef.current;
      if (mode.type === "none") return;

      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (mode.type === "image") {
        setOffset({
          x: dragStartRef.current.offsetX + dx,
          y: dragStartRef.current.offsetY + dy,
        });
        return;
      }

      if (mode.type === "handle") {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const sdx = (dx / rect.width) * INTERNAL_SIZE;
        const sdy = (dy / rect.height) * INTERNAL_SIZE;
        const prev = dragStartRef.current.crop;
        const right = prev.x + prev.w;
        const bottom = prev.y + prev.h;

        let nx = prev.x,
          ny = prev.y,
          nw = prev.w,
          nh = prev.h;

        switch (mode.id) {
          case "tl":
            nx = Math.max(0, Math.min(prev.x + sdx, right - MIN_CROP));
            ny = Math.max(0, Math.min(prev.y + sdy, bottom - MIN_CROP));
            nw = right - nx;
            nh = bottom - ny;
            break;
          case "tc":
            ny = Math.max(0, Math.min(prev.y + sdy, bottom - MIN_CROP));
            nh = bottom - ny;
            break;
          case "tr":
            ny = Math.max(0, Math.min(prev.y + sdy, bottom - MIN_CROP));
            nw = Math.max(MIN_CROP, Math.min(prev.w + sdx, INTERNAL_SIZE - prev.x));
            nh = bottom - ny;
            break;
          case "ml":
            nx = Math.max(0, Math.min(prev.x + sdx, right - MIN_CROP));
            nw = right - nx;
            break;
          case "mr":
            nw = Math.max(MIN_CROP, Math.min(prev.w + sdx, INTERNAL_SIZE - prev.x));
            break;
          case "bl":
            nx = Math.max(0, Math.min(prev.x + sdx, right - MIN_CROP));
            nw = right - nx;
            nh = Math.max(MIN_CROP, Math.min(prev.h + sdy, INTERNAL_SIZE - prev.y));
            break;
          case "bc":
            nh = Math.max(MIN_CROP, Math.min(prev.h + sdy, INTERNAL_SIZE - prev.y));
            break;
          case "br":
            nw = Math.max(MIN_CROP, Math.min(prev.w + sdx, INTERNAL_SIZE - prev.x));
            nh = Math.max(MIN_CROP, Math.min(prev.h + sdy, INTERNAL_SIZE - prev.y));
            break;
        }

        setCrop({ x: nx, y: ny, w: nw, h: nh });
      }
    },
    [getCanvasCoords]
  );

  const handlePointerUp = useCallback(() => {
    dragModeRef.current = { type: "none" };
    setActiveHandle(null);
  }, []);

  // Mouse events with dynamic cursor
  const onMouseDown = (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => {
    // Update cursor when not dragging
    if (dragModeRef.current.type === "none") {
      const canvas = canvasRef.current;
      if (canvas) {
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        const handle = hitTestHandle(x, y, crop);
        if (handle) {
          canvas.style.cursor = HANDLE_CURSORS[handle];
        } else if (x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h) {
          canvas.style.cursor = "grab";
        } else {
          canvas.style.cursor = "default";
        }
      }
    }
    handlePointerMove(e.clientX, e.clientY);
  };

  // Touch events
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleReset = () => {
    setZoom(100);
    setOffset({ x: 0, y: 0 });
    setCrop({ x: 0, y: 0, w: INTERNAL_SIZE, h: INTERNAL_SIZE });
  };

  const handleConfirm = () => {
    if (!image) return;

    // Render the image (without overlay) to a temp canvas
    const temp = document.createElement("canvas");
    temp.width = INTERNAL_SIZE;
    temp.height = INTERNAL_SIZE;
    const tempCtx = temp.getContext("2d")!;
    const params = getDrawParams();
    if (params) {
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";
      tempCtx.drawImage(image, params.drawX, params.drawY, params.drawW, params.drawH);
    }

    // Extract crop region → square output
    const output = document.createElement("canvas");
    output.width = INTERNAL_SIZE;
    output.height = INTERNAL_SIZE;
    const outCtx = output.getContext("2d")!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(
      temp,
      crop.x, crop.y, crop.w, crop.h,
      0, 0, INTERNAL_SIZE, INTERNAL_SIZE
    );

    output.toBlob((blob) => {
      if (blob) {
        onConfirm(new File([blob], file.name, { type: "image/png" }));
      }
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-sm font-semibold text-gray-300">
        画像の位置・サイズ調整
      </h3>

      <canvas
        ref={canvasRef}
        width={INTERNAL_SIZE}
        height={INTERNAL_SIZE}
        className="rounded-lg border border-gray-600 touch-none"
        style={{ width: canvasDisplaySize, height: canvasDisplaySize }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />

      <div className="w-full" style={{ maxWidth: canvasDisplaySize }}>
        <label className="text-xs text-gray-400 block mb-1">
          ズーム: {zoom}%
        </label>
        <input
          type="range"
          min={50}
          max={200}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          className="px-4 py-2 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors min-h-[44px] md:min-h-0"
        >
          この位置で確定
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors min-h-[44px] md:min-h-0"
        >
          リセット
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors min-h-[44px] md:min-h-0"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
