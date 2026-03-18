"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { EmoteConfig, DEFAULT_BADGE_SETTINGS } from "@/types/emote";
import { processEmote } from "@/lib/canvasPipeline";
import { generateGif } from "@/lib/gifEncoder";

interface AutoPattern {
  label: string;
  config: EmoteConfig;
}

const defaultConfig: EmoteConfig = {
  outline: { style: "none", width: 4, color: "#ffffff" },
  frame: { type: "none" },
  subImage: { mode: "none", scale: 38, offsetX: 0, offsetY: 0 },
  text: {
    preset: null,
    customText: "",
    font: "Noto Sans JP",
    fillColor: "#ffffff",
    strokeColor: "#000000",
    position: "bottom",
    fontSize: 20,
    offsetX: 0,
    offsetY: 0,
    outlineWidth: 3,
  },
  animation: { type: "none", speed: "normal" },
  badge: { ...DEFAULT_BADGE_SETTINGS },
  padding: 0.05,
};

const AUTO_PATTERNS: AutoPattern[] = [
  {
    label: "白フチ",
    config: { ...defaultConfig, outline: { ...defaultConfig.outline, style: "white" } },
  },
  {
    label: "黒フチ",
    config: { ...defaultConfig, outline: { ...defaultConfig.outline, style: "black" } },
  },
  {
    label: "影付き",
    config: { ...defaultConfig, outline: { ...defaultConfig.outline, style: "shadow" } },
  },
  {
    label: "白フチ+揺れ",
    config: {
      ...defaultConfig,
      outline: { ...defaultConfig.outline, style: "white" },
      animation: { ...defaultConfig.animation, type: "sway" },
    },
  },
];

interface PatternPreview {
  staticDataUrl: string;
  animatedBlob: Blob | null;
  animatedUrl: string | null;
}

interface RecommendedPatternsProps {
  bgRemovedCanvas: HTMLCanvasElement;
  onApply: (config: EmoteConfig) => void;
}

export default function RecommendedPatterns({ bgRemovedCanvas, onApply }: RecommendedPatternsProps) {
  const [previews, setPreviews] = useState<(PatternPreview | null)[]>(
    AUTO_PATTERNS.map(() => null)
  );
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    setPreviews(AUTO_PATTERNS.map(() => null));

    async function generate() {
      await document.fonts.ready;
      const results: (PatternPreview | null)[] = [];

      for (const pattern of AUTO_PATTERNS) {
        if (cancelled) return;

        try {
          const canvas = processEmote(bgRemovedCanvas, 112, pattern.config);
          const staticDataUrl = canvas.toDataURL("image/png");

          let animatedBlob: Blob | null = null;
          let animatedUrl: string | null = null;
          if (pattern.config.animation.type !== "none") {
            animatedBlob = await generateGif(canvas, pattern.config.animation.type, 112, pattern.config.animation.speed);
            if (cancelled) return;
            animatedUrl = URL.createObjectURL(animatedBlob);
            blobUrlsRef.current.push(animatedUrl);
          }

          results.push({ staticDataUrl, animatedBlob, animatedUrl });
        } catch (err) {
          console.error("Auto-generate pattern failed:", err);
          results.push(null);
        }
      }

      if (!cancelled) {
        setPreviews(results);
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [bgRemovedCanvas]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleDownload = useCallback((index: number) => {
    const preview = previews[index];
    if (!preview) return;
    const pattern = AUTO_PATTERNS[index];
    const isAnimated = pattern.config.animation.type !== "none" && preview.animatedBlob;

    let url: string;
    let needsRevoke = false;
    if (isAnimated && preview.animatedBlob) {
      url = URL.createObjectURL(preview.animatedBlob);
      needsRevoke = true;
    } else {
      url = preview.staticDataUrl;
    }

    const ext = isAnimated ? "gif" : "png";
    const a = document.createElement("a");
    a.href = url;
    a.download = `emote_pattern${index + 1}_112x112.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (needsRevoke) URL.revokeObjectURL(url);
    }, 1000);
  }, [previews]);

  const generatedCount = previews.filter(Boolean).length;

  return (
    <div className="w-full mt-6 pt-6 border-t border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-gray-300">おすすめパターン</h3>
        {generatedCount < AUTO_PATTERNS.length && (
          <span className="text-xs text-gray-500">
            ({generatedCount}/{AUTO_PATTERNS.length})
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
        {AUTO_PATTERNS.map((pattern, i) => {
          const preview = previews[i];
          const src = preview?.animatedUrl ?? preview?.staticDataUrl;

          return (
            <div
              key={pattern.label}
              className="flex flex-col items-center gap-1 bg-gray-800/50 rounded-lg p-1.5 min-w-0"
            >
              <div className="checkerboard rounded aspect-square w-full">
                {src ? (
                  <img
                    src={src}
                    alt={pattern.label}
                    className="block w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <svg
                      className="animate-spin h-4 w-4 text-gray-500"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 leading-tight text-center truncate w-full">{pattern.label}</span>
              <div className="flex gap-0.5 w-full min-w-0">
                <button
                  onClick={() => onApply(pattern.config)}
                  className="flex-1 min-w-0 text-xs px-0.5 py-0.5 min-h-[44px] md:min-h-0 rounded bg-purple-600/80 text-white hover:bg-purple-500 transition-colors truncate"
                  title="この設定を使う"
                >
                  適用
                </button>
                <button
                  onClick={() => handleDownload(i)}
                  disabled={!preview}
                  className="text-xs px-0.5 py-0.5 min-h-[44px] md:min-h-0 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pattern.config.animation.type !== "none" ? "GIF" : "PNG"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
