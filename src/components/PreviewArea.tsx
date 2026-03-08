"use client";

import { useEffect, useRef, useState } from "react";
import { EmoteVariant, TextPosition } from "@/types/emote";
import { applyBorder, applyTextOverlay, centerAndResize } from "@/lib/canvasPipeline";
import PreviewCard from "./PreviewCard";

interface PreviewAreaProps {
  variants: EmoteVariant[];
  hasText?: boolean;
  textPosition?: TextPosition;
}

const FEATURES = [
  { icon: "✂️", label: "背景自動透過" },
  { icon: "🖼️", label: "3サイズ同時出力" },
  { icon: "🔤", label: "テキスト入れ" },
  { icon: "🎨", label: "フチ取り" },
  { icon: "🎬", label: "アニメーション" },
  { icon: "📦", label: "ZIP一括DL" },
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
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto py-4 relative">
      {/* Catchcopy */}
      <div className="text-center space-y-2">
        <p className="text-base font-semibold text-gray-200">
          背景透過 → フチ取り → 3サイズ出力まで、ブラウザだけで完結
        </p>
        <p className="text-xs text-gray-400">
          Twitch仕様準拠済み。そのままアップロードできる品質で書き出せる
        </p>
      </div>

      {/* Feature badges */}
      <div className="flex flex-wrap justify-center gap-2">
        {FEATURES.map((f) => (
          <span
            key={f.label}
            className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700"
          >
            {f.icon} {f.label}
          </span>
        ))}
      </div>

      {/* Sample previews */}
      {samples.length > 0 && (
        <div className="w-full space-y-3">
          <p className="text-xs text-gray-500 text-center tracking-widest">
            ── サンプル ──
          </p>
          <div className="grid grid-cols-4 gap-3">
            {samples.map((sample) => (
              <div key={sample.label} className="flex flex-col items-center gap-1.5">
                {sample.dataUrls.length === 1 ? (
                  <div className="checkerboard rounded p-1.5 flex items-center justify-center" style={{ width: 80, height: 80 }}>
                    <img src={sample.dataUrls[0]} alt={sample.label} width={72} height={72} />
                  </div>
                ) : (
                  <div className="checkerboard rounded p-1.5 flex items-end justify-center gap-1" style={{ width: 80, height: 80 }}>
                    {sample.dataUrls.map((url, i) => {
                      const sizes = [40, 24, 14];
                      return <img key={i} src={url} alt="" width={sizes[i]} height={sizes[i]} />;
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

export default function PreviewArea({ variants, hasText = false, textPosition = "bottom" }: PreviewAreaProps) {
  if (variants.length === 0) {
    return <SampleShowcase />;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {[...variants].reverse().map((variant) => (
        <PreviewCard key={variant.size} variant={variant} hasText={hasText} textPosition={textPosition} />
      ))}
    </div>
  );
}
