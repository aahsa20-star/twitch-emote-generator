"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ImageAdjustEditorProps {
  file: File;
  onConfirm: (adjustedFile: File) => void;
  onSkip: () => void;
}

const CANVAS_SIZE = 280;
const CHECK_SIZE = 10;

export default function ImageAdjustEditor({ file, onConfirm, onSkip }: ImageAdjustEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  // Load image from file
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(100);
      setOffset({ x: 0, y: 0 });
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
      drawW = CANVAS_SIZE * scale;
      drawH = (CANVAS_SIZE / aspect) * scale;
    } else {
      drawH = CANVAS_SIZE * scale;
      drawW = CANVAS_SIZE * aspect * scale;
    }
    const drawX = (CANVAS_SIZE - drawW) / 2 + offset.x;
    const drawY = (CANVAS_SIZE - drawH) / 2 + offset.y;
    return { drawX, drawY, drawW, drawH };
  }, [image, zoom, offset]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d")!;

    // Checkerboard
    for (let y = 0; y < CANVAS_SIZE; y += CHECK_SIZE) {
      for (let x = 0; x < CANVAS_SIZE; x += CHECK_SIZE) {
        ctx.fillStyle =
          (Math.floor(x / CHECK_SIZE) + Math.floor(y / CHECK_SIZE)) % 2 === 0
            ? "#2a2a2a"
            : "#3a3a3a";
        ctx.fillRect(x, y, CHECK_SIZE, CHECK_SIZE);
      }
    }

    // Image
    const params = getDrawParams();
    if (params) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, params.drawX, params.drawY, params.drawW, params.drawH);
    }
  }, [image, zoom, offset, getDrawParams]);

  // Pointer handlers (unified mouse+touch)
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      draggingRef.current = true;
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    },
    [offset]
  );

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!draggingRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const onMouseDown = (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handlePointerMove(e.clientX, e.clientY);

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
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
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
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg cursor-grab active:cursor-grabbing border border-gray-600 touch-none"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handlePointerUp}
      />

      <div className="w-full max-w-[280px]">
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
          className="px-4 py-2 rounded bg-purple-600 text-white text-sm font-medium hover:bg-purple-500 transition-colors"
        >
          この位置で確定
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
        >
          リセット
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
