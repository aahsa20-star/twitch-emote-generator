"use client";

import { useState, useCallback, useEffect } from "react";
import {
  EmoteConfig,
  PartialEmoteConfig,
  ANIMATION_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
} from "@/types/emote";

interface AnimationSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isSubscriber: boolean;
  isLoggedIn: boolean;
  onLoginRequired?: () => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
}

export default function AnimationSettings({
  config,
  onConfigChange,
  isSubscriber,
  isLoggedIn,
  onLoginRequired,
  bgRemovedCanvas,
}: AnimationSettingsProps) {
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  // Clean up object URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    };
  }, [aiPreviewUrl]);

  const handleAiGenerate = useCallback(async () => {
    if (!aiDescription.trim() || !bgRemovedCanvas) return;

    setAiLoading(true);
    setAiError(null);
    if (aiPreviewUrl) URL.revokeObjectURL(aiPreviewUrl);
    setAiPreviewUrl(null);

    try {
      // Step 1: Call API to generate code
      setAiStatus("AIがコードを生成中...");
      const res = await fetch("/api/generate-animation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "エラーが発生しました" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { code } = await res.json();

      // Step 2: Extract 256x256 ImageData from bgRemovedCanvas
      setAiStatus("フレームを生成中...");
      const extractCanvas = document.createElement("canvas");
      extractCanvas.width = 256;
      extractCanvas.height = 256;
      const extractCtx = extractCanvas.getContext("2d")!;
      extractCtx.drawImage(bgRemovedCanvas, 0, 0, 256, 256);
      const baseImageData = extractCtx.getImageData(0, 0, 256, 256);

      // Step 3: Generate all frames in sandbox
      const { generateAllFrames, framesToGif } = await import("@/lib/animationSandbox");
      const frames = await generateAllFrames(code, baseImageData, 20);

      // Step 4: Convert to GIF
      setAiStatus("GIFを生成中...");
      const gifBlob = await framesToGif(frames, 256, 50);
      const url = URL.createObjectURL(gifBlob);
      setAiPreviewUrl(url);
      setAiStatus(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "不明なエラー");
      setAiStatus(null);
    } finally {
      setAiLoading(false);
    }
  }, [aiDescription, bgRemovedCanvas, aiPreviewUrl]);

  const handleAiToggle = useCallback(() => {
    setShowAiPanel((v) => !v);
  }, []);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        アニメーション
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {ANIMATION_OPTIONS.filter((o) => !o.subscriberOnly && !o.loginOnly).map((opt) => (
          <button
            key={opt.value}
            onClick={() => onConfigChange({ animation: { type: opt.value } })}
            className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
              config.animation.type === opt.value
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Login-only animations */}
      {ANIMATION_OPTIONS.some((o) => o.loginOnly) && (
        <>
          <p className="text-xs text-gray-500 mt-3 mb-1">ログイン限定</p>
          <div className="grid grid-cols-2 gap-2">
            {ANIMATION_OPTIONS.filter((o) => o.loginOnly).map((opt) => {
              const unlocked = isLoggedIn || isSubscriber;
              const isActiveFromTemplate = !unlocked && config.animation.type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (unlocked) {
                      onConfigChange({ animation: { type: opt.value } });
                    } else {
                      onLoginRequired?.();
                    }
                  }}
                  className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
                    isActiveFromTemplate
                      ? "bg-purple-900 text-purple-300 border border-purple-500 cursor-not-allowed"
                      : unlocked && config.animation.type === opt.value
                      ? "bg-purple-600 text-white"
                      : unlocked
                      ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      : "bg-gray-800 text-gray-600 cursor-not-allowed"
                  }`}
                  title={isActiveFromTemplate ? "テンプレートから適用中。ログインすると変更できます" : !unlocked ? "Twitchログインで解放" : undefined}
                >
                  {isActiveFromTemplate ? `🔒 ${opt.label}` : opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Subscriber-only animations */}
      {ANIMATION_OPTIONS.some((o) => o.subscriberOnly) && (
        <>
          <p className="text-xs text-gray-500 mt-3 mb-1">限定</p>
          <div className="grid grid-cols-2 gap-2">
            {ANIMATION_OPTIONS.filter((o) => o.subscriberOnly).map((opt) => {
              const locked = !isSubscriber;
              const isActiveFromTemplate = locked && config.animation.type === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => !locked && onConfigChange({ animation: { type: opt.value } })}
                  className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors truncate ${
                    isActiveFromTemplate
                      ? "bg-purple-900 text-purple-300 border border-purple-500 cursor-not-allowed"
                      : locked
                      ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                      : config.animation.type === opt.value
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  title={isActiveFromTemplate ? "テンプレートから適用中。変更するには合言葉が必要です" : locked ? "合言葉を入力すると解放されます" : undefined}
                >
                  {isActiveFromTemplate ? `🔒 ${opt.label}` : opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* AI Animation Generator (Beta) */}
      <div className="mt-3">
        <button
          onClick={handleAiToggle}
          className={`w-full px-3 py-2 rounded text-sm transition-colors border ${
            showAiPanel
              ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
              : "border-gray-600 bg-gray-800 text-gray-400 hover:border-cyan-500/50 hover:text-cyan-400"
          }`}
        >
          AIで作る（ベータ）
        </button>

        {showAiPanel && (
          <div className="mt-2 p-3 bg-gray-800/80 rounded-lg border border-gray-700 space-y-2">
            {!isLoggedIn ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-300">
                  テキストで説明するだけで、AIがオリジナルアニメーションを生成します。
                </p>
                <p className="text-xs text-yellow-400">
                  Twitchログインが必要です。ログイン後に画像をアップロードしてください。
                </p>
                <button
                  onClick={() => onLoginRequired?.()}
                  className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-500 transition-colors"
                >
                  Twitchでログイン
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400">
                  アニメーションの動きを説明してください（日本語OK）
                </p>
                <textarea
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="例: 虹色に光りながら左右にバウンドする"
                  maxLength={200}
                  rows={2}
                  className="w-full px-2 py-1.5 rounded bg-gray-700 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiDescription.trim() || !bgRemovedCanvas}
                    className="px-3 py-1.5 rounded bg-cyan-600 text-white text-sm hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiLoading ? "生成中..." : "生成する"}
                  </button>
                  <span className="text-xs text-gray-500">
                    {aiDescription.length}/200
                  </span>
                </div>
                {!bgRemovedCanvas && (
                  <p className="text-xs text-yellow-400">
                    先に画像をアップロードしてください
                  </p>
                )}
              </>
            )}
            {aiStatus && (
              <div className="flex items-center gap-2 text-xs text-cyan-400">
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                {aiStatus}
              </div>
            )}
            {aiError && (
              <p className="text-xs text-red-400">{aiError}</p>
            )}
            {aiPreviewUrl && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400">プレビュー:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={aiPreviewUrl}
                  alt="AI生成アニメーション"
                  className="w-32 h-32 rounded border border-gray-600 bg-gray-900"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animation speed — always rendered to prevent layout shift */}
      <div
        className={`mt-3 transition-opacity duration-150 ${
          config.animation.type !== "none"
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={config.animation.type === "none"}
      >
        <label className="text-xs text-gray-400 block mb-1">速度</label>
        <div className="grid grid-cols-3 gap-2">
          {ANIMATION_SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onConfigChange({ animation: { speed: opt.value } })}
              tabIndex={config.animation.type === "none" ? -1 : 0}
              className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                config.animation.speed === opt.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
