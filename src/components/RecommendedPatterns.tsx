"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { EmoteConfig } from "@/types/emote";
import { processEmote } from "@/lib/canvasPipeline";
import { generateGif } from "@/lib/gifEncoder";

interface AutoPattern {
  label: string;
  config: EmoteConfig;
}

const defaultText = { customText: "", font: "Noto Sans JP", fillColor: "#ffffff", strokeColor: "#000000", position: "bottom" as const };
const defaultSliders = { borderWidth: 4, borderColor: "#ffffff", fontSize: 20, textOffsetX: 0, textOffsetY: 0, textOutlineWidth: 3 };

const AUTO_PATTERNS: AutoPattern[] = [
  {
    label: "1. 白フチ",
    config: { border: "white", textPreset: null, text: { ...defaultText }, animation: "none", ...defaultSliders },
  },
  {
    label: "2. 黒フチ",
    config: { border: "black", textPreset: null, text: { ...defaultText }, animation: "none", ...defaultSliders },
  },
  {
    label: "3. 白フチ+草",
    config: { border: "white", textPreset: "kusa", text: { ...defaultText }, animation: "none", ...defaultSliders },
  },
  {
    label: "4. 白フチ+GG",
    config: { border: "white", textPreset: "gg", text: { ...defaultText }, animation: "none", ...defaultSliders },
  },
  {
    label: "5. 影付き",
    config: { border: "shadow", textPreset: null, text: { ...defaultText }, animation: "none", ...defaultSliders },
  },
  {
    label: "6. 白フチ+揺れ",
    config: { border: "white", textPreset: null, text: { ...defaultText }, animation: "sway", ...defaultSliders },
  },
  {
    label: "7. 草+揺れ",
    config: { border: "white", textPreset: "kusa", text: { ...defaultText, fillColor: "#ffff00" }, animation: "sway", ...defaultSliders },
  },
  {
    label: "8. 黒フチ+点滅",
    config: { border: "black", textPreset: null, text: { ...defaultText }, animation: "blink", ...defaultSliders },
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
          if (pattern.config.animation !== "none") {
            animatedBlob = await generateGif(canvas, pattern.config.animation, 112);
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
    const isAnimated = pattern.config.animation !== "none" && preview.animatedBlob;

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
              <span className="text-[10px] text-gray-400 leading-tight text-center truncate w-full">{pattern.label}</span>
              <div className="flex gap-0.5 w-full min-w-0">
                <button
                  onClick={() => onApply(pattern.config)}
                  className="flex-1 min-w-0 text-[10px] px-0.5 py-0.5 rounded bg-purple-600/80 text-white hover:bg-purple-500 transition-colors truncate"
                  title="この設定を使う"
                >
                  適用
                </button>
                <button
                  onClick={() => handleDownload(i)}
                  disabled={!preview}
                  className="text-[10px] px-0.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pattern.config.animation !== "none" ? "GIF" : "PNG"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
