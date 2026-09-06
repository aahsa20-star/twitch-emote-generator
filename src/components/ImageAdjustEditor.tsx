"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { primaryBtn, textBtn } from "@/components/ui/classes";

/** Crop / zoom / offset in editor space (INTERNAL_SIZE square). */
export interface AdjustState {
  zoom: number;
  offset: { x: number; y: number };
  crop: CropRect;
}

interface ImageAdjustEditorProps {
  file: File;
  /** Last confirmed state when re-entering; null = defaults. */
  initialState?: AdjustState | null;
  /** 「この範囲で使う」 / 「変更を適用」 */
  confirmLabel: string;
  /** 「調整せず使う」 / 「変更せず戻る」 */
  secondaryLabel: string;
  onConfirm: (adjustedFile: File, state: AdjustState) => void;
  onSecondary: () => void;
  /** Extra controls (background handling) rendered above the confirm button. */
  children?: ReactNode;
}

const INTERNAL_SIZE = 320; // Internal resolution (always square)
const CHECK_SIZE = 10;
const HANDLE_SIZE = 12;
const HANDLE_SIZE_ACTIVE = 16;
const HANDLE_HALF = HANDLE_SIZE / 2;
const HANDLE_HALF_ACTIVE = HANDLE_SIZE_ACTIVE / 2;
const MIN_CROP = 40;
const HANDLE_HIT = HANDLE_HALF + 6;

export const DEFAULT_ADJUST_STATE: AdjustState = { zoom: 100, offset: { x: 0, y: 0 }, crop: { x: 0, y: 0, w: INTERNAL_SIZE, h: INTERNAL_SIZE } };

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

export default function ImageAdjustEditor({ file, initialState, confirmLabel, secondaryLabel, onConfirm, onSecondary, children }: ImageAdjustEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [zoom, setZoom] = useState(initialState?.zoom ?? 100);
  const [offset, setOffset] = useState(initialState?.offset ?? { x: 0, y: 0 });
  const [crop, setCrop] = useState<CropRect>(initialState?.crop ?? DEFAULT_ADJUST_STATE.crop);
  const [activeHandle, setActiveHandle] = useState<HandleId | null>(null);

  const dragModeRef = useRef<DragMode>({ type: "none" });
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    offsetX: 0,
    offsetY: 0,
    crop: { ...DEFAULT_ADJUST_STATE.crop },
  });

  // Load image from file. The draft (zoom / offset / crop) is only reset when
  // the file itself changes, never by the parent re-rendering.
  useEffect(() => {
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setLoadError(false);
      setImage(img);
    };
    // A revoked URL (effect re-run) also fires onerror: only report real failures.
    img.onerror = () => {
      if (!cancelled) setLoadError(true);
    };
    img.src = url;
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
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

    for (let y = 0; y < INTERNAL_SIZE; y += CHECK_SIZE) {
      for (let x = 0; x < INTERNAL_SIZE; x += CHECK_SIZE) {
        ctx.fillStyle = (Math.floor(x / CHECK_SIZE) + Math.floor(y / CHECK_SIZE)) % 2 === 0 ? "#292a33" : "#30313b";
        ctx.fillRect(x, y, CHECK_SIZE, CHECK_SIZE);
      }
    }

    const params = getDrawParams();
    if (params) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, params.drawX, params.drawY, params.drawW, params.drawH);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, INTERNAL_SIZE, crop.y);
    ctx.fillRect(0, crop.y + crop.h, INTERNAL_SIZE, INTERNAL_SIZE - crop.y - crop.h);
    ctx.fillRect(0, crop.y, crop.x, crop.h);
    ctx.fillRect(crop.x + crop.w, crop.y, INTERNAL_SIZE - crop.x - crop.w, crop.h);

    ctx.strokeStyle = "#c8b5ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x + 1, crop.y + 1, crop.w - 2, crop.h - 2);
    // thirds guide
    ctx.strokeStyle = "rgba(231, 213, 255, 0.25)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(crop.x + (crop.w * i) / 3, crop.y);
      ctx.lineTo(crop.x + (crop.w * i) / 3, crop.y + crop.h);
      ctx.moveTo(crop.x, crop.y + (crop.h * i) / 3);
      ctx.lineTo(crop.x + crop.w, crop.y + (crop.h * i) / 3);
      ctx.stroke();
    }

    const handles = getHandlePositions(crop);
    for (const [id, pos] of Object.entries(handles)) {
      const isActive = activeHandle === id;
      const size = isActive ? HANDLE_SIZE_ACTIVE : HANDLE_SIZE;
      const half = isActive ? HANDLE_HALF_ACTIVE : HANDLE_HALF;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = isActive ? "#c8b5ff" : "#ffffff";
      ctx.fillRect(pos.x - half, pos.y - half, size, size);
      ctx.restore();
    }
  }, [image, zoom, offset, crop, getDrawParams, activeHandle]);

  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * INTERNAL_SIZE,
      y: ((clientY - rect.top) / rect.height) * INTERNAL_SIZE,
    };
  }, []);

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      const { x: cx, y: cy } = getCanvasCoords(clientX, clientY);
      const handle = hitTestHandle(cx, cy, crop);
      if (handle) {
        dragModeRef.current = { type: "handle", id: handle };
        setActiveHandle(handle);
        dragStartRef.current = { x: clientX, y: clientY, offsetX: offset.x, offsetY: offset.y, crop: { ...crop } };
        return;
      }
      if (cx >= crop.x && cx <= crop.x + crop.w && cy >= crop.y && cy <= crop.y + crop.h) {
        dragModeRef.current = { type: "image" };
        dragStartRef.current = { x: clientX, y: clientY, offsetX: offset.x, offsetY: offset.y, crop: { ...crop } };
      }
    },
    [offset, crop, getCanvasCoords],
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      const mode = dragModeRef.current;
      if (mode.type === "none") return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (mode.type === "image") {
        setOffset({ x: dragStartRef.current.offsetX + dx, y: dragStartRef.current.offsetY + dy });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sdx = (dx / rect.width) * INTERNAL_SIZE;
      const sdy = (dy / rect.height) * INTERNAL_SIZE;
      const prev = dragStartRef.current.crop;
      const right = prev.x + prev.w;
      const bottom = prev.y + prev.h;
      let nx = prev.x, ny = prev.y, nw = prev.w, nh = prev.h;
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
    },
    [],
  );

  const handlePointerUp = useCallback(() => {
    dragModeRef.current = { type: "none" };
    setActiveHandle(null);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragModeRef.current.type === "none") {
      const canvas = canvasRef.current;
      if (canvas) {
        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
        const handle = hitTestHandle(x, y, crop);
        canvas.style.cursor = handle
          ? HANDLE_CURSORS[handle]
          : x >= crop.x && x <= crop.x + crop.w && y >= crop.y && y <= crop.y + crop.h
            ? "grab"
            : "default";
      }
    }
    handlePointerMove(e.clientX, e.clientY);
  };
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
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
    setCrop({ ...DEFAULT_ADJUST_STATE.crop });
  };

  const handleConfirm = () => {
    if (!image) return;
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
    const output = document.createElement("canvas");
    output.width = INTERNAL_SIZE;
    output.height = INTERNAL_SIZE;
    const outCtx = output.getContext("2d")!;
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(temp, crop.x, crop.y, crop.w, crop.h, 0, 0, INTERNAL_SIZE, INTERNAL_SIZE);
    temp.width = 0;
    temp.height = 0;
    output.toBlob((blob) => {
      output.width = 0;
      output.height = 0;
      if (blob) {
        onConfirm(new File([blob], file.name, { type: "image/png" }), { zoom, offset, crop: { ...crop } });
      }
    }, "image/png");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4 md:gap-6 max-w-[1060px] mx-auto">
      <div className="relative rounded-[18px] checkerboard grid place-items-center p-4 md:p-6 min-h-[310px]">
        {loadError ? (
          <p className="text-[12px] text-studio-danger" role="alert">画像を読み込めませんでした。別の画像を選んでください。</p>
        ) : (
          <canvas
            ref={canvasRef}
            width={INTERNAL_SIZE}
            height={INTERNAL_SIZE}
            className="w-full max-w-[420px] aspect-square rounded-[6px] touch-none shadow-lg"
            role="img"
            aria-label="切り取り範囲。ドラッグで移動、四隅と辺のハンドルで範囲を変更"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={handlePointerUp}
            onTouchCancel={handlePointerUp}
          />
        )}
        <span className="absolute bottom-3 md:bottom-4 px-3 py-1 rounded-[7px] text-[11px] bg-[#201928df] text-studio-text">
          正方形の仕上がり範囲
        </span>
      </div>

      <div className="bg-studio-surface border border-studio-stroke rounded-studio p-5 md:p-6">
        <h2 className="text-[17px] font-bold mb-3">画像を整える</h2>
        <label className="flex justify-between text-[12px] mt-3" htmlFor="adjust-zoom">
          大きさ <output className="text-studio-accent">{zoom}%</output>
        </label>
        <input
          id="adjust-zoom"
          type="range"
          min={50}
          max={200}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-[11px] text-studio-muted mt-2 leading-relaxed">
          画像をドラッグして位置を、ハンドルで範囲を変えられます。
        </p>
        <button type="button" onClick={handleReset} className={textBtn}>
          中央に戻す
        </button>

        {children}

        <button type="button" onClick={handleConfirm} disabled={!image} className={`${primaryBtn} w-full mt-5`}>
          {confirmLabel} →
        </button>
        <button type="button" onClick={onSecondary} className={`${textBtn} w-full justify-center mt-1`}>
          {secondaryLabel}
        </button>
      </div>
    </div>
  );
}
