import { EmoteVariant, TextPosition } from "@/types/emote";
import { useCallback, useEffect, useState } from "react";
import { checkVisibility, VisibilityResult } from "@/lib/visibilityChecker";

interface PreviewCardProps {
  variant: EmoteVariant;
  hasText?: boolean;
  textPosition?: TextPosition;
}

export default function PreviewCard({ variant, hasText = false, textPosition = "bottom" }: PreviewCardProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [visibilityResult, setVisibilityResult] = useState<VisibilityResult | null>(null);

  useEffect(() => {
    if (variant.animatedBlob) {
      const url = URL.createObjectURL(variant.animatedBlob);
      setGifUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setGifUrl(null);
    }
  }, [variant.animatedBlob]);

  // Visibility check for 28px only
  useEffect(() => {
    if (variant.size !== 28) {
      setVisibilityResult(null);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 28;
      canvas.height = 28;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 28, 28);
      setVisibilityResult(checkVisibility(canvas, hasText, textPosition));
    };
    img.src = variant.staticDataUrl;
  }, [variant.staticDataUrl, variant.size, hasText, textPosition]);

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
  }, [variant]);

  const format = variant.animatedBlob ? "GIF" : "PNG";

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-400 font-mono">
        {variant.size}x{variant.size}
      </span>
      <div
        className="group relative checkerboard rounded flex items-center justify-center cursor-pointer"
        style={{
          width: Math.max(variant.size + 16, 60),
          height: Math.max(variant.size + 16, 60),
        }}
        onClick={handleDownload}
      >
        <img
          src={displayUrl}
          alt={`${variant.size}px preview`}
          width={variant.size}
          height={variant.size}
          style={{ imageRendering: variant.size <= 28 ? "pixelated" : "auto" }}
        />
        <div className="absolute inset-0 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-xs font-semibold text-white bg-purple-600 px-3 py-1.5 rounded-md whitespace-nowrap">
            ↓ {variant.size}px {format}
          </span>
        </div>
      </div>
      {visibilityResult && !visibilityResult.ok && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-400">
          {"\u26a0\ufe0f"} {visibilityResult.message}
        </span>
      )}
    </div>
  );
}
