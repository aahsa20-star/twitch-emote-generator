"use client";

import { useState } from "react";
import { useEmoteProcessor } from "@/hooks/useEmoteProcessor";
import UploadPanel from "./UploadPanel";
import SettingsPanel from "./SettingsPanel";
import PreviewArea from "./PreviewArea";
import DownloadButton from "./DownloadButton";
import RecommendedPatterns from "./RecommendedPatterns";
import ShareButton from "./ShareButton";
import { EmoteConfig } from "@/types/emote";

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
    </svg>
  );
}

export default function EmoteGenerator() {
  const {
    sourceFile,
    setSourceFile,
    bgRemovedCanvas,
    config,
    updateConfig,
    stage,
    progress,
    variants,
    handleExport,
    skipBgRemoval,
    setSkipBgRemoval,
    cancelBgRemoval,
    retryBgRemoval,
    useOriginalImage,
  } = useEmoteProcessor();

  const [showRetryMenu, setShowRetryMenu] = useState(false);

  const handleApplyPattern = (patternConfig: EmoteConfig) => {
    updateConfig(patternConfig);
  };

  return (
    <div className="flex-1 flex gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Left: Upload & Settings */}
      <div className="w-80 flex-shrink-0 space-y-6">
        <UploadPanel
          onImageSelected={setSourceFile}
          hasImage={!!sourceFile}
        />

        {/* Skip background removal toggle */}
        {sourceFile && (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              className={`relative w-10 h-5 rounded-full transition-colors ${
                skipBgRemoval ? "bg-purple-600" : "bg-gray-600"
              }`}
              onClick={() => setSkipBgRemoval(!skipBgRemoval)}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  skipBgRemoval ? "translate-x-5" : ""
                }`}
              />
            </div>
            <span className="text-xs text-gray-400">
              背景透過をスキップ（元画像をそのまま使う）
            </span>
          </label>
        )}

        {/* Processing indicator with cancel */}
        {stage === "removing-background" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <SpinnerIcon />
              背景を透過中...
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                初回はAIモデルのダウンロードが必要です（約30MB）
              </p>
              <button
                onClick={cancelBgRemoval}
                className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {(stage === "processing" || stage === "generating-preview") && (
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <SpinnerIcon />
            {stage === "generating-preview"
              ? "アニメーション生成中..."
              : "エモート生成中..."}
          </div>
        )}

        {sourceFile && (
          <>
            <SettingsPanel
              config={config}
              onConfigChange={updateConfig}
              disabled={stage === "removing-background"}
            />
            <DownloadButton stage={stage} onExport={handleExport} />
            <ShareButton imageDataUrl={variants.find(v => v.size === 112)?.staticDataUrl ?? null} />
          </>
        )}
      </div>

      {/* Right: Preview */}
      <div className="flex-1 min-w-0 bg-gray-900 rounded-lg p-6 flex flex-col items-center min-h-[400px] overflow-y-auto">
        {/* Retry / skip button above preview */}
        {bgRemovedCanvas && stage === "ready" && (
          <div className="relative mb-3">
            <button
              onClick={() => setShowRetryMenu(!showRetryMenu)}
              className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              ↩ 透過をやり直す／スキップする
            </button>
            {showRetryMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowRetryMenu(false)}
                />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[220px]">
                  <button
                    onClick={() => {
                      setShowRetryMenu(false);
                      retryBgRemoval();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    もう一度透過処理を実行する
                  </button>
                  <button
                    onClick={() => {
                      setShowRetryMenu(false);
                      useOriginalImage();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
                  >
                    透過をスキップして元画像を使う
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <PreviewArea
          variants={variants}
          hasText={!!(config.text.customText.trim() || config.textPreset)}
          textPosition={config.text.position}
        />
        {bgRemovedCanvas && (
          <RecommendedPatterns
            bgRemovedCanvas={bgRemovedCanvas}
            onApply={handleApplyPattern}
          />
        )}
      </div>
    </div>
  );
}
