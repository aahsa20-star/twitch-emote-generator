"use client";

import { useState, useEffect } from "react";
import { useEmoteProcessor } from "@/hooks/useEmoteProcessor";
import UploadPanel from "./UploadPanel";
import SettingsPanel from "./SettingsPanel";
import PreviewArea from "./PreviewArea";
import DownloadButton from "./DownloadButton";
import RecommendedPatterns from "./RecommendedPatterns";
import ShareButton from "./ShareButton";
import { EmoteConfig } from "@/types/emote";

const SUBSCRIBER_KEY = "emote-subscriber";
const PASSPHRASE = "saratouin";

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
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [authToast, setAuthToast] = useState<string | null>(null);

  // Restore subscriber status from localStorage
  useEffect(() => {
    try {
      if (localStorage.getItem(SUBSCRIBER_KEY) === "true") {
        setIsSubscriber(true);
      }
    } catch {}
  }, []);

  const handleAuth = () => {
    if (passphrase.trim().toLowerCase() === PASSPHRASE) {
      setIsSubscriber(true);
      setPassphrase("");
      try { localStorage.setItem(SUBSCRIBER_KEY, "true"); } catch {}
      setAuthToast("限定コンテンツが解放されました！");
      setTimeout(() => setAuthToast(null), 3000);
    } else {
      setAuthToast("合言葉が違います");
      setTimeout(() => setAuthToast(null), 3000);
    }
  };

  const handleLogout = () => {
    setIsSubscriber(false);
    try { localStorage.removeItem(SUBSCRIBER_KEY); } catch {}
    // Reset subscriber-only config values to defaults
    updateConfig({
      border: config.border === "custom" ? "none" : config.border,
      borderColor: "#ffffff",
      animation: ["gaming", "glitch", "sparkle", "afterimage", "fastspin"].includes(config.animation) ? "none" : config.animation,
      textPreset: config.textPreset && ["howsitgoing", "yurusanee", "saratouin"].includes(config.textPreset) ? null : config.textPreset,
    });
  };

  const handleApplyPattern = (patternConfig: EmoteConfig) => {
    updateConfig(patternConfig);
  };

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 md:gap-6 p-4 md:p-6 max-w-6xl mx-auto w-full">
      {/* Upload + toggle + progress (top-left on desktop, 1st on mobile) */}
      <div className="space-y-4 md:space-y-6 order-1 md:order-none self-start">
        <UploadPanel
          onImageSelected={setSourceFile}
          hasImage={!!sourceFile}
        />

        {/* Subscriber auth */}
        {isSubscriber ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-400/80">AKI限定 解放済み</span>
            <button
              onClick={handleLogout}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              解除
            </button>
          </div>
        ) : (
          <div className="bg-gray-800/60 rounded-lg p-3 space-y-2">
            <label className="text-xs text-gray-400 block">合言葉を入力して限定機能を解放</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                placeholder="合言葉..."
                className="flex-1 px-2 py-1.5 rounded bg-gray-700 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-purple-500 focus:outline-none"
              />
              <button
                onClick={handleAuth}
                className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-500 transition-colors"
              >
                解除
              </button>
            </div>
          </div>
        )}

        {/* Auth toast */}
        {authToast && (
          <div className={`text-xs px-3 py-2 rounded-lg text-center ${
            authToast.includes("解放") ? "bg-purple-600/30 text-purple-300" : "bg-red-600/30 text-red-300"
          }`}>
            {authToast}
          </div>
        )}

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
      </div>

      {/* Preview (mobile: order-1, desktop: right column, sticky) */}
      <div className="bg-gray-900 rounded-lg p-4 md:p-6 flex flex-col items-center min-h-[300px] md:min-h-[400px] overflow-y-auto order-1 md:order-none self-start md:sticky md:top-4 md:max-h-screen">
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
          stage={stage}
          hasText={!!(config.text.customText.trim() || config.textPreset)}
          textPosition={config.text.position}
        />
      </div>

      {/* Settings + DL/Share (mobile: order-4, desktop: sticky left column with DL inside) */}
      <div className={`space-y-4 md:space-y-6 order-4 md:order-none self-start md:sticky md:top-4 md:max-h-screen md:overflow-y-auto md:col-start-1 relative ${!sourceFile ? "opacity-40 pointer-events-none select-none" : ""}`}>
        {!sourceFile && (
          <p className="text-xs text-gray-400 text-center py-1">画像をアップロードすると設定できます</p>
        )}
        <SettingsPanel
          config={config}
          onConfigChange={updateConfig}
          disabled={!sourceFile || stage === "removing-background"}
          isSubscriber={isSubscriber}
        />
        {/* DL + Share inside sticky container (desktop only) */}
        {sourceFile && (
          <div className="hidden md:flex flex-col gap-3">
            <DownloadButton stage={stage} onExport={handleExport} variants={variants} />
            <ShareButton imageDataUrl={variants.find(v => v.size === 112)?.staticDataUrl ?? null} />
          </div>
        )}
      </div>

      {/* Recommended patterns (mobile: order-3, desktop: right column) */}
      {bgRemovedCanvas && (
        <div className="order-3 md:order-none self-start md:col-start-2">
          <RecommendedPatterns
            bgRemovedCanvas={bgRemovedCanvas}
            onApply={handleApplyPattern}
          />
        </div>
      )}

      {/* DL + Share (mobile only: order-2) */}
      {sourceFile && (
        <div className="space-y-3 order-2 md:hidden self-start">
          <DownloadButton stage={stage} onExport={handleExport} variants={variants} />
          <ShareButton imageDataUrl={variants.find(v => v.size === 112)?.staticDataUrl ?? null} />
        </div>
      )}
    </div>
  );
}
