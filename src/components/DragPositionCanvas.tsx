"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { EmoteConfig, PartialEmoteConfig, TEXT_PRESETS } from "@/types/emote";
import { processEmote } from "@/lib/canvasPipeline";

const CANVAS_SIZE = 224; // Matches HI_RES in canvasPipeline
const CHECK_SIZE = 8;

interface DragPositionCanvasProps {
  bgRemovedCanvas: HTMLCanvasElement;
  config: EmoteConfig;
  subCanvas?: HTMLCanvasElement | null;
  onConfigChange: (partial: PartialEmoteConfig) => void;
}

function resolveText(config: EmoteConfig): string | null {
  if (config.text.customText.trim()) return config.text.customText.trim();
  if (config.text.preset) {
    const preset = TEXT_PRESETS.find((p) => p.id === config.text.preset);
    if (preset) return preset.text;
  }
  return null;
}

/** Compute text center position in canvas (CANVAS_SIZE) coordinates. */
function getTextCenter(config: EmoteConfig): { x: number; y: number } | null {
  const text = resolveText(config);
  if (!text) return null;

  const scale = CANVAS_SIZE / 112;
  const scaledOffsetX = config.text.offsetX * scale;
  const scaledOffsetY = config.text.offsetY * scale;

  return {
    x: CANVAS_SIZE / 2 + scaledOffsetX,
    y: CANVAS_SIZE / 2 + scaledOffsetY,
  };
}

/** Compute sub-image center position in canvas coordinates. */
function getSubImageCenter(config: EmoteConfig, hasSubCanvas: boolean): { x: number; y: number; size: number } | null {
  if (!hasSubCanvas) return null;
  if (config.subImage.mode !== "overlay-br" && config.subImage.mode !== "overlay-bl") return null;

  const scale = CANVAS_SIZE / 112;
  const subSize = Math.round(CANVAS_SIZE * config.subImage.scale / 100);
  const scaledOffsetX = Math.round(config.subImage.offsetX * scale);
  const scaledOffsetY = Math.round(config.subImage.offsetY * scale);

  // Center-based: free placement via offsets
  return {
    x: Math.round(CANVAS_SIZE / 2) + scaledOffsetX,
    y: Math.round(CANVAS_SIZE / 2) + scaledOffsetY,
    size: subSize,
  };
}

export default function DragPositionCanvas({
  bgRemovedCanvas,
  config,
  subCanvas,
  onConfigChange,
}: DragPositionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragTarget, setDragTarget] = useState<"text" | "subimage" | null>(null);
  const [hoverTarget, setHoverTarget] = useState<"text" | "subimage" | null>(null);
  const dragStartRef = useRef({
    clientX: 0,
    clientY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });

  const hasText = !!resolveText(config);
  const hasSubOverlay = !!subCanvas && (config.subImage.mode === "overlay-br" || config.subImage.mode === "overlay-bl");

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Checkerboard background
    for (let cy = 0; cy < CANVAS_SIZE; cy += CHECK_SIZE) {
      for (let cx = 0; cx < CANVAS_SIZE; cx += CHECK_SIZE) {
        ctx.fillStyle =
          (Math.floor(cx / CHECK_SIZE) + Math.floor(cy / CHECK_SIZE)) % 2 === 0
            ? "#2a2a2a"
            : "#3a3a3a";
        ctx.fillRect(cx, cy, CHECK_SIZE, CHECK_SIZE);
      }
    }

    // Render emote at full HI_RES (no downscale since size = CANVAS_SIZE = HI_RES)
    const emote = processEmote(bgRemovedCanvas, CANVAS_SIZE, config, subCanvas ?? undefined);
    ctx.drawImage(emote, 0, 0);
    // Release GPU memory
    emote.width = 0;
    emote.height = 0;

    // Draw drag indicators
    const textCenter = getTextCenter(config);
    if (textCenter) {
      const fontSize = config.text.fontSize * (CANVAS_SIZE / 112);
      const text = resolveText(config)!;
      const fontFamily = `"${config.text.font}", "Noto Sans JP", sans-serif`;

      // Measure text width
      ctx.save();
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      const tw = metrics.width;
      const th = fontSize;
      ctx.restore();

      const isActive = dragTarget === "text" || hoverTarget === "text";
      ctx.save();
      ctx.strokeStyle = isActive ? "#9146FF" : "rgba(145, 70, 255, 0.5)";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        textCenter.x - tw / 2 - 4,
        textCenter.y - th / 2 - 4,
        tw + 8,
        th + 8
      );
      ctx.restore();
    }

    const subInfo = getSubImageCenter(config, !!subCanvas);
    if (subInfo) {
      const isActive = dragTarget === "subimage" || hoverTarget === "subimage";
      ctx.save();
      ctx.strokeStyle = isActive ? "#00cc66" : "rgba(0, 204, 102, 0.5)";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        subInfo.x - subInfo.size / 2 - 2,
        subInfo.y - subInfo.size / 2 - 2,
        subInfo.size + 4,
        subInfo.size + 4
      );
      ctx.restore();
    }
  }, [bgRemovedCanvas, config, subCanvas, dragTarget, hoverTarget]);

  // Canvas coords from client coords
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }, []);

  // Hit test
  const hitTest = useCallback(
    (canvasX: number, canvasY: number): "text" | "subimage" | null => {
      // Check sub-image first (usually on top)
      const subInfo = getSubImageCenter(config, !!subCanvas);
      if (subInfo) {
        const half = subInfo.size / 2 + 8;
        if (
          Math.abs(canvasX - subInfo.x) <= half &&
          Math.abs(canvasY - subInfo.y) <= half
        ) {
          return "subimage";
        }
      }

      // Check text
      const textCenter = getTextCenter(config);
      if (textCenter) {
        const fontSize = config.text.fontSize * (CANVAS_SIZE / 112);
        // Use generous hit area
        const hitW = Math.max(fontSize * 2, 40);
        const hitH = fontSize + 16;
        if (
          Math.abs(canvasX - textCenter.x) <= hitW / 2 &&
          Math.abs(canvasY - textCenter.y) <= hitH / 2
        ) {
          return "text";
        }
      }

      return null;
    },
    [config, subCanvas]
  );

  // Pointer handlers
  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getCanvasCoords(clientX, clientY);
      const target = hitTest(coords.x, coords.y);
      if (!target) return;

      setDragTarget(target);
      dragStartRef.current = {
        clientX,
        clientY,
        startOffsetX: target === "text" ? config.text.offsetX : config.subImage.offsetX,
        startOffsetY: target === "text" ? config.text.offsetY : config.subImage.offsetY,
      };
    },
    [getCanvasCoords, hitTest, config.text.offsetX, config.text.offsetY, config.subImage.offsetX, config.subImage.offsetY]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!dragTarget) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      // Convert pixel delta to 112px display space
      const scale = CANVAS_SIZE / rect.width;
      const dx112 = (clientX - dragStartRef.current.clientX) * scale * (112 / CANVAS_SIZE);
      const dy112 = (clientY - dragStartRef.current.clientY) * scale * (112 / CANVAS_SIZE);

      const newX = Math.round(Math.max(-56, Math.min(56, dragStartRef.current.startOffsetX + dx112)));
      const newY = Math.round(Math.max(-56, Math.min(56, dragStartRef.current.startOffsetY + dy112)));

      if (dragTarget === "text") {
        onConfigChange({ text: { offsetX: newX, offsetY: newY } });
      } else {
        onConfigChange({ subImage: { offsetX: newX, offsetY: newY } });
      }
    },
    [dragTarget, onConfigChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
  }, []);

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => handlePointerDown(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragTarget) {
      handlePointerMove(e.clientX, e.clientY);
    } else {
      const coords = getCanvasCoords(e.clientX, e.clientY);
      const target = hitTest(coords.x, coords.y);
      setHoverTarget(target);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = target ? "grab" : "default";
      }
    }
  };

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

  // Only show when there's something to drag
  if (!hasText && !hasSubOverlay) return null;

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 block">ドラッグで位置調整</label>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="rounded-lg border border-gray-600 touch-none w-full"
        style={{ maxWidth: 280 }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={() => { handlePointerUp(); setHoverTarget(null); }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />
      {hasText && hasSubOverlay && (
        <p className="text-xs text-gray-500">
          <span className="text-purple-400">■</span> テキスト
          <span className="text-green-400">■</span> サブ画像
        </p>
      )}
    </div>
  );
}
