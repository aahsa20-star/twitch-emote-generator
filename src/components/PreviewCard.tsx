import { EmoteVariant, TextPosition } from "@/types/emote";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkVisibility, VisibilityResult } from "@/lib/visibilityChecker";

type BgMode = "checker" | "dark" | "light";

interface PreviewCardProps {
  variant: EmoteVariant;
  hasText?: boolean;
  textPosition?: TextPosition;
  bgMode?: BgMode;
  onDownloadComplete?: () => void;
  onContentAdjust?: (dx: number, dy: number, ds: number) => void;
}

export default function PreviewCard({ variant, hasText = false, textPosition = "bottom", bgMode = "checker", onDownloadComplete, onContentAdjust }: PreviewCardProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [visibilityResult, setVisibilityResult] = useState<VisibilityResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartRef = useRef<number | null>(null);
  const isLargest = variant.size >= 112;
  const interactive = isLargest && !!onContentAdjust;

  // Visual-only transform for instant feedback during drag (GPU-accelerated CSS transform)
  const visualOffsetRef = useRef({ x: 0, y: 0, scale: 1 });
  const imgRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number | null>(null);

  // Apply CSS transform via requestAnimationFrame
  const applyVisualTransform = useCallback(() => {
    if (imgRef.current) {
      const { x, y, scale } = visualOffsetRef.current;
      if (x === 0 && y === 0 && scale === 1) {
        imgRef.current.style.transform = "";
      } else {
        imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      }
    }
    rafRef.current = null;
  }, []);

  const scheduleVisualUpdate = useCallback(() => {
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(applyVisualTransform);
    }
  }, [applyVisualTransform]);

  // Reset visual transform when pipeline completes (variant changes)
  useEffect(() => {
    // Cancel any pending rAF to prevent stale rafRef blocking future schedules
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    visualOffsetRef.current = { x: 0, y: 0, scale: 1 };
    if (imgRef.current) {
      imgRef.current.style.transform = "";
    }
  }, [variant.staticDataUrl]);

  useEffect(() => {
    if (variant.animatedBlob) {
      const url = URL.createObjectURL(variant.animatedBlob);
      setGifUrl(url);
      return () => {
        setTimeout(() => URL.revokeObjectURL(url), 100);
      };
    } else {
      setGifUrl(null);
    }
  }, [variant.animatedBlob]);

  // Visibility check for smallest size only (28px or 32px)
  useEffect(() => {
    if (variant.size > 32) {
      setVisibilityResult(null);
      return;
    }

    let cancelled = false;
    const checkSize = variant.size;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = checkSize;
        canvas.height = checkSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, checkSize, checkSize);
        setVisibilityResult(checkVisibility(canvas, hasText, textPosition));
        canvas.width = 0;
        canvas.height = 0;
      } catch {
        // Ignore errors from unmounted state or detached DOM nodes
      }
    };
    img.src = variant.staticDataUrl;
    return () => { cancelled = true; };
  }, [variant.staticDataUrl, variant.size, hasText, textPosition]);

  // ESC to close modal
  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modalOpen]);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const displayUrl = gifUrl || variant.staticDataUrl;

  const handleDownload = useCallback(() => {
    let url: string;
    let needsRevoke = false;

    if (variant.animatedBlob) {
      url = URL.createObjectURL(variant.animatedBlob);
      needsRevoke = true;
    } else {
      url = variant.staticDataUrl;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = variant.filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (needsRevoke) URL.revokeObjectURL(url);
    }, 1000);
    onDownloadComplete?.();
  }, [variant, onDownloadComplete]);

  const format = variant.animatedBlob ? "GIF" : "PNG";

  const handleCardClick = useCallback(() => {
    if (isDragging) return;
    if (isLargest && window.matchMedia("(min-width: 768px)").matches) {
      setModalOpen(true);
    } else if (!interactive) {
      handleDownload();
    }
  }, [isLargest, handleDownload, isDragging, interactive]);

  // --- Drag handlers (PC) ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(false);
  }, [interactive]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interactive || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      setIsDragging(true);
    }
    // Instant visual feedback via CSS transform
    visualOffsetRef.current.x += dx;
    visualOffsetRef.current.y += dy;
    scheduleVisualUpdate();

    // Send normalized delta to pipeline (debounced)
    const displaySize = Math.max(variant.size + 16, 60);
    const ndx = dx / displaySize * 0.5;
    const ndy = dy / displaySize * 0.5;
    onContentAdjust?.(ndx, ndy, 0);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  }, [interactive, onContentAdjust, variant.size, scheduleVisualUpdate]);

  const handleMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  // --- Scroll handler (PC zoom) ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    // Instant visual feedback
    visualOffsetRef.current.scale = Math.max(0.5, Math.min(2.0, visualOffsetRef.current.scale + delta));
    scheduleVisualUpdate();

    onContentAdjust?.(0, 0, delta);
  }, [interactive, onContentAdjust, scheduleVisualUpdate]);

  // --- Touch handlers (mobile) ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!interactive) return;
    if (e.touches.length === 1) {
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartRef.current = dist;
    }
  }, [interactive]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!interactive) return;
    if (e.touches.length === 1 && dragStartRef.current && !pinchStartRef.current) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setIsDragging(true);
      // Instant visual feedback
      visualOffsetRef.current.x += dx;
      visualOffsetRef.current.y += dy;
      scheduleVisualUpdate();

      const displaySize = Math.max(variant.size + 16, 60);
      const ndx = dx / displaySize * 0.5;
      const ndy = dy / displaySize * 0.5;
      onContentAdjust?.(ndx, ndy, 0);
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && pinchStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (dist - pinchStartRef.current) * 0.005;
      // Instant visual feedback
      visualOffsetRef.current.scale = Math.max(0.5, Math.min(2.0, visualOffsetRef.current.scale + delta));
      scheduleVisualUpdate();

      onContentAdjust?.(0, 0, delta);
      pinchStartRef.current = dist;
    }
  }, [interactive, onContentAdjust, variant.size, scheduleVisualUpdate]);

  const handleTouchEnd = useCallback(() => {
    dragStartRef.current = null;
    pinchStartRef.current = null;
    setTimeout(() => setIsDragging(false), 50);
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">
        {variant.size}x{variant.size}
      </span>
      <div
        className={`group relative rounded flex items-center justify-center overflow-hidden ${
          interactive ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"
        } ${bgMode === "checker" ? "checkerboard" : ""}`}
        style={{
          width: Math.max(variant.size + 16, 60),
          height: Math.max(variant.size + 16, 60),
          ...(bgMode === "dark" ? { background: "#1a1a2e" } : {}),
          ...(bgMode === "light" ? { background: "#f0f0f0" } : {}),
          touchAction: interactive ? "none" : "auto",
        }}
        onClick={handleCardClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imgRef}
          src={displayUrl}
          alt={`${variant.size}px preview`}
          width={variant.size}
          height={variant.size}
          style={{
            imageRendering: variant.size <= 28 ? "pixelated" : "auto",
            pointerEvents: "none",
            willChange: interactive ? "transform" : "auto",
          }}
          draggable={false}
        />
        {/* PC: largest shows hint or expand, others show download overlay */}
        {isLargest ? (
          <div className="hidden md:flex absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center">
            <span className="text-xs text-gray-300">
              {interactive ? "ドラッグで移動 / スクロールでズーム" : "クリックで拡大"}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center overflow-hidden">
            <span className="text-xs font-semibold text-white bg-purple-600 px-2 py-1 rounded-md whitespace-nowrap">
              ↓ {variant.size}px {format}
            </span>
          </div>
        )}
      </div>
      {/* Hint text for mobile */}
      {interactive && (
        <span className="md:hidden text-xs text-gray-500">ドラッグで移動 / ピンチでズーム</span>
      )}

      {/* Enlarged modal (PC only) — portal to body to escape contain:layout */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setModalOpen(false)}>
          <div className="relative checkerboard rounded-lg p-6 max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={displayUrl}
              alt="enlarged preview"
              width={variant.size * 2}
              height={variant.size * 2}
              style={{ imageRendering: "auto", display: "block", maxWidth: "80vw", maxHeight: "80vh", objectFit: "contain" }}
            />
            <button
              onClick={handleDownload}
              className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs transition-colors"
            >
              ↓ {variant.size}px {format} ダウンロード
            </button>
          </div>
        </div>,
        document.body
      )}
      {/* Mobile-only download button (no hover on touch devices) */}
      <button
        onClick={handleDownload}
        className="md:hidden flex items-center gap-1 px-2.5 py-1 min-h-[44px] rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
        </svg>
        {variant.size}px {format}
      </button>
      {visibilityResult && !visibilityResult.ok && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400">
          {visibilityResult.message}
        </span>
      )}
    </div>
  );
}
