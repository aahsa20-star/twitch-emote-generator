import { EmoteVariant, TextPosition } from "@/types/emote";
import { useCallback, useEffect, useState } from "react";
import { checkVisibility, VisibilityResult } from "@/lib/visibilityChecker";

type BgMode = "checker" | "dark" | "light";

interface PreviewCardProps {
  variant: EmoteVariant;
  hasText?: boolean;
  textPosition?: TextPosition;
  bgMode?: BgMode;
  onDownloadComplete?: () => void;
}

export default function PreviewCard({ variant, hasText = false, textPosition = "bottom", bgMode = "checker", onDownloadComplete }: PreviewCardProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [visibilityResult, setVisibilityResult] = useState<VisibilityResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const isLargest = variant.size >= 112;

  useEffect(() => {
    if (variant.animatedBlob) {
      const url = URL.createObjectURL(variant.animatedBlob);
      setGifUrl(url);
      return () => {
        // Delay revoke to prevent flash when switching between blobs
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
    if (isLargest && window.matchMedia("(min-width: 768px)").matches) {
      setModalOpen(true);
    } else {
      handleDownload();
    }
  }, [isLargest, handleDownload]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">
        {variant.size}x{variant.size}
      </span>
      <div
        className={`group relative rounded flex items-center justify-center cursor-pointer ${bgMode === "checker" ? "checkerboard" : ""}`}
        style={{
          width: Math.max(variant.size + 16, 60),
          height: Math.max(variant.size + 16, 60),
          ...(bgMode === "dark" ? { background: "#1a1a2e" } : {}),
          ...(bgMode === "light" ? { background: "#f0f0f0" } : {}),
        }}
        onClick={handleCardClick}
      >
        <img
          src={displayUrl}
          alt={`${variant.size}px preview`}
          width={variant.size}
          height={variant.size}
          style={{ imageRendering: variant.size <= 28 ? "pixelated" : "auto" }}
        />
        {/* PC: largest shows "クリックで拡大", others show download overlay */}
        {isLargest ? (
          <div className="hidden md:flex absolute inset-0 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity items-center justify-center">
            <span className="text-[10px] text-gray-300">クリックで拡大</span>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center overflow-hidden">
            <span className="text-[10px] font-semibold text-white bg-purple-600 px-2 py-1 rounded-md whitespace-nowrap">
              ↓ {variant.size}px {format}
            </span>
          </div>
        )}
      </div>

      {/* Enlarged modal (PC only) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setModalOpen(false)}>
          <div className="relative checkerboard rounded-lg p-6" onClick={(e) => e.stopPropagation()}>
            <img
              src={displayUrl}
              alt="enlarged preview"
              width={variant.size * 2}
              height={variant.size * 2}
              style={{ imageRendering: "auto", display: "block" }}
            />
            <button
              onClick={handleDownload}
              className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs transition-colors"
            >
              ↓ {variant.size}px {format} ダウンロード
            </button>
          </div>
        </div>
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
