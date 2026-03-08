"use client";

import { useEmoteProcessor } from "@/hooks/useEmoteProcessor";
import UploadPanel from "./UploadPanel";
import SettingsPanel from "./SettingsPanel";
import PreviewArea from "./PreviewArea";
import DownloadButton from "./DownloadButton";
import RecommendedPatterns from "./RecommendedPatterns";
import ShareButton from "./ShareButton";
import { EmoteConfig } from "@/types/emote";

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
  } = useEmoteProcessor();

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

        {/* Processing indicator */}
        {stage === "removing-background" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  className="opacity-75"
                />
              </svg>
              背景を透過中...
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">
              初回はAIモデルのダウンロードが必要です（約30MB）
            </p>
          </div>
        )}

        {(stage === "processing" || stage === "generating-preview") && (
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                className="opacity-25"
              />
              <path
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                className="opacity-75"
              />
            </svg>
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
