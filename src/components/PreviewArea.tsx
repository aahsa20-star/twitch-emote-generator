"use client";

import { useEffect, useRef, useState } from "react";
import { EmoteVariant, ProcessingStage, TextPosition } from "@/types/emote";
import { applyBorder, applyTextOverlay, centerAndResize } from "@/lib/canvasPipeline";
import PreviewCard from "./PreviewCard";

type BgMode = "checker" | "dark" | "light";

interface PreviewAreaProps {
  variants: EmoteVariant[];
  stage: ProcessingStage;
  hasText?: boolean;
  textPosition?: TextPosition;
}

const FEATURES = [
  "背景自動透過",
  "3サイズ同時出力",
  "テキスト入れ",
  "フチ取り",
  "アニメーション",
  "ZIP一括DL",
];

interface SamplePattern {
  label: string;
  dataUrls: string[];
}

function drawSampleIcon(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Purple circle
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#9333ea";
  ctx.fill();

  // White star
  const starR = r * 0.5;
  const starInner = starR * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const outerX = cx + starR * Math.cos(angle);
    const outerY = cy + starR * Math.sin(angle);
    if (i === 0) ctx.moveTo(outerX, outerY);
    else ctx.lineTo(outerX, outerY);

    const innerAngle = angle + (2 * Math.PI) / 10;
    const innerX = cx + starInner * Math.cos(innerAngle);
    const innerY = cy + starInner * Math.sin(innerAngle);
    ctx.lineTo(innerX, innerY);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  return canvas;
}

function generateSamples(): SamplePattern[] {
  const icon = drawSampleIcon(256);
  const patterns: SamplePattern[] = [];

  // 1. White border, no text (112px)
  {
    const centered = centerAndResize(icon, 112);
    const bordered = applyBorder(centered, "white");
    patterns.push({ label: "白フチ", dataUrls: [bordered.toDataURL()] });
  }

  // 2. Black border + "GG" white text (112px)
  {
    const centered = centerAndResize(icon, 112);
    const bordered = applyBorder(centered, "black");
    const withText = applyTextOverlay(bordered, {
      text: "GG",
      font: "Noto Sans JP",
      fillColor: "#ffffff",
      strokeColor: "#000000",
      position: "bottom",
    }, 112);
    patterns.push({ label: "テキスト入り", dataUrls: [withText.toDataURL()] });
  }

  // 3. White border + "草" yellow text (112px)
  {
    const centered = centerAndResize(icon, 112);
    const bordered = applyBorder(centered, "white");
    const withText = applyTextOverlay(bordered, {
      text: "草",
      font: "Noto Sans JP",
      fillColor: "#facc15",
      strokeColor: "#000000",
      position: "bottom",
    }, 112);
    patterns.push({ label: "カラーテキスト", dataUrls: [withText.toDataURL()] });
  }

  // 4. 3 sizes comparison (28, 56, 112)
  {
    const urls: string[] = [];
    for (const size of [112, 56, 28] as const) {
      const centered = centerAndResize(icon, size);
      const bordered = applyBorder(centered, "white");
      urls.push(bordered.toDataURL());
    }
    patterns.push({ label: "3サイズ比較", dataUrls: urls });
  }

  return patterns;
}

function SampleShowcase() {
  const [samples, setSamples] = useState<SamplePattern[]>([]);
  const generated = useRef(false);

  useEffect(() => {
    if (generated.current) return;
    generated.current = true;
    setSamples(generateSamples());
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto py-4 relative overflow-hidden">
      {/* Catchcopy */}
      <div className="text-center space-y-2 w-full px-2">
        <p className="text-sm sm:text-base md:text-lg font-semibold text-gray-200 leading-relaxed">
          背景透過 → フチ取り →<br className="sm:hidden" />
          3サイズ出力まで、<br className="sm:hidden" /><span className="whitespace-nowrap">ブラウザだけで完結</span>
        </p>
        <p className="text-xs text-gray-400">
          Twitch仕様準拠済み。そのままアップロードできる品質で書き出せる
        </p>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-2">
        {FEATURES.map((label) => (
          <span
            key={label}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Sample previews */}
      {samples.length > 0 && (
        <div className="w-full space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Sample</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
            {samples.map((sample) => (
              <div key={sample.label} className="flex flex-col items-center gap-1">
                {sample.dataUrls.length === 1 ? (
                  <div className="checkerboard rounded p-1 aspect-square w-full flex items-center justify-center">
                    <img src={sample.dataUrls[0]} alt={sample.label} className="w-[85%] h-[85%] object-contain" />
                  </div>
                ) : (
                  <div className="checkerboard rounded p-1 aspect-square w-full flex items-end justify-center gap-0.5">
                    {sample.dataUrls.map((url, i) => {
                      const pcts = ["55%", "35%", "20%"];
                      return <img key={i} src={url} alt="" style={{ width: pcts[i], height: pcts[i], objectFit: "contain" }} />;
                    })}
                  </div>
                )}
                <span className="text-[10px] text-gray-400">{sample.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SKELETON_SIZES = [112, 56, 28];

function SkeletonPreview({ stage }: { stage: ProcessingStage }) {
  const stageLabel =
    stage === "removing-background"
      ? "背景を透過しています..."
      : stage === "generating-preview"
      ? "アニメーションを生成中..."
      : "エモートを生成中...";

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-xs text-gray-400 animate-pulse">{stageLabel}</p>
      {SKELETON_SIZES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">
            {size}x{size}
          </span>
          <div
            className="rounded bg-gray-800 animate-pulse"
            style={{
              width: Math.max(size + 16, 60),
              height: Math.max(size + 16, 60),
            }}
          />
        </div>
      ))}
    </div>
  );
}

const BG_OPTIONS: { mode: BgMode; label: string; className: string }[] = [
  { mode: "checker", label: "チェッカー", className: "checkerboard" },
  { mode: "dark", label: "ダーク", className: "bg-gray-900" },
  { mode: "light", label: "ライト", className: "bg-white" },
];

export default function PreviewArea({ variants, stage, hasText = false, textPosition = "bottom" }: PreviewAreaProps) {
  const [bgMode, setBgMode] = useState<BgMode>("checker");

  const isProcessing = stage === "removing-background" || stage === "processing" || stage === "generating-preview";

  if (variants.length === 0 && isProcessing) {
    return <SkeletonPreview stage={stage} />;
  }

  if (variants.length === 0) {
    return <SampleShowcase />;
  }

  return (
    <div className="flex flex-col items-center gap-4 relative">
      {/* Background mode toggle */}
      <div className="absolute top-0 right-0 flex gap-1">
        {BG_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setBgMode(opt.mode)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              bgMode === opt.mode
                ? "ring-1 ring-purple-500 ring-offset-1 ring-offset-gray-900"
                : "hover:ring-1 hover:ring-gray-500"
            }`}
            title={opt.label}
          >
            <span className={`block w-4 h-4 rounded-sm ${opt.className} border border-gray-600`} />
          </button>
        ))}
      </div>

      <div className="pt-2" />
      {[...variants].reverse().map((variant) => (
        <PreviewCard key={variant.size} variant={variant} hasText={hasText} textPosition={textPosition} bgMode={bgMode} />
      ))}
    </div>
  );
}
