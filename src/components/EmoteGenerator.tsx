"use client";

import { useState, useEffect, useCallback } from "react";
import { useEmoteProcessor } from "@/hooks/useEmoteProcessor";
import UploadPanel from "./UploadPanel";
import ImageAdjustEditor from "./ImageAdjustEditor";
import BrushEditor from "./BrushEditor";
import SettingsPanel from "./SettingsPanel";
import PreviewArea from "./PreviewArea";
import DownloadButton from "./DownloadButton";
import RecommendedPatterns from "./RecommendedPatterns";
import ShareButton from "./ShareButton";
import ShareAfterDownloadModal from "./ShareAfterDownloadModal";
import FloatingMiniPreview from "./FloatingMiniPreview";
import VideoFaceExtractor from "./VideoFaceExtractor";
import { EmoteConfig, ExportMode, BgRemovalQuality, DEFAULT_BADGE_SETTINGS } from "@/types/emote";

const SUBSCRIBER_KEY = "emote-subscriber";

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
    </svg>
  );
}

export default function EmoteGenerator() {
  const [exportMode, setExportMode] = useState<ExportMode>("twitch");
  const [subFile, setSubFile] = useState<File | null>(null);
  const [subCanvas, setSubCanvas] = useState<HTMLCanvasElement | null>(null);

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
    bgRemovalQuality,
    setBgRemovalQuality,
    cancelBgRemoval,
    retryBgRemoval,
    useOriginalImage,
    bgRemovedBlob,
    originalBlob,
    handleBrushConfirm,
    handleBrushSkip,
    fileToCanvas,
  } = useEmoteProcessor(exportMode, subCanvas);

  // Convert subFile to subCanvas
  useEffect(() => {
    if (!subFile) { setSubCanvas(null); return; }
    let cancelled = false;
    fileToCanvas(subFile).then((c) => { if (!cancelled) setSubCanvas(c); }).catch(() => { if (!cancelled) setSubCanvas(null); });
    return () => { cancelled = true; };
  }, [subFile, fileToCanvas]);

  const handleSubImageSelected = useCallback((file: File) => {
    setSubFile(file);
  }, []);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  const handleDownloadComplete = () => setShowShareModal(true);

  // Restore subscriber status from localStorage
  useEffect(() => {
    try {
      if (localStorage.getItem(SUBSCRIBER_KEY) === "true") {
        setIsSubscriber(true);
      }
    } catch {}
  }, []);

  const handleAuth = async () => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: passphrase.trim() }),
      });
      if (res.ok) {
        setIsSubscriber(true);
        setPassphrase("");
        try { localStorage.setItem(SUBSCRIBER_KEY, "true"); } catch {}
        setAuthToast("サブスク限定機能が解放されました！");
      } else {
        setAuthToast("合言葉が違います");
      }
    } catch {
      setAuthToast("認証エラーが発生しました");
    }
    setTimeout(() => setAuthToast(null), 3000);
  };

  const handleLogout = () => {
    setIsSubscriber(false);
    try { localStorage.removeItem(SUBSCRIBER_KEY); } catch {}
    // Reset subscriber-only config values to defaults
    const subscriberAnimations = ["gaming", "glitch", "sparkle", "afterimage", "fastspin", "float", "wobble", "neon", "vhs", "snow", "fire", "matrix", "drunk", "confetti", "hypno", "tv", "earthquake", "party", "flip", "ghost", "glitch2", "spiral", "heartbeat", "spring", "jelly"];
    updateConfig({
      outline: { style: config.outline.style === "custom" ? "none" : config.outline.style, color: "#ffffff" },
      frame: { type: "none" },
      subImage: { mode: "none", scale: 38, offsetX: 0, offsetY: 0 },
      badge: { ...DEFAULT_BADGE_SETTINGS },
      animation: { type: subscriberAnimations.includes(config.animation.type) ? "none" : config.animation.type },
    });
  };

  const handleImageSelected = (file: File) => {
    setPendingFile(file);
  };

  const handleAdjustConfirm = (adjustedFile: File) => {
    setPendingFile(null);
    setSourceFile(adjustedFile);
  };

  const handleAdjustSkip = () => {
    if (pendingFile) {
      setSourceFile(pendingFile);
    }
    setPendingFile(null);
  };

  const handleApplyPattern = (patternConfig: EmoteConfig) => {
    updateConfig(patternConfig);
  };

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 md:gap-6 p-4 md:p-6 max-w-6xl mx-auto w-full">
      {/* Upload + toggle + progress (top-left on desktop, 1st on mobile) */}
      <div className="space-y-4 md:space-y-6 order-1 md:order-none self-start">
        <UploadPanel
          onImageSelected={handleImageSelected}
          hasImage={!!sourceFile || !!pendingFile}
        />

        {/* Image adjust editor */}
        {pendingFile && (
          <ImageAdjustEditor
            file={pendingFile}
            onConfirm={handleAdjustConfirm}
            onSkip={handleAdjustSkip}
          />
        )}

        {/* Video face extractor */}
        <VideoFaceExtractor
          onFaceSelected={handleImageSelected}
        />

        {/* Subscriber auth */}
        {isSubscriber ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-emerald-400/80">サブスク限定 解放済み — 5つの限定機能が利用可能</span>
            <button
              onClick={handleLogout}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              解除
            </button>
          </div>
        ) : (
          <div className="bg-gray-800/60 rounded-lg p-3 space-y-2.5">
            <label className="text-xs text-gray-300 font-medium block">サブスク限定機能</label>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                限定アニメーション 45種
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                エモートフレーム 6種
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                2画像合成
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                カスタムフチ色
              </span>
              <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                サブスクバッジ作成
              </span>
            </div>
            <a
              href="https://discord.gg/CheMXWdj"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-purple-400 hover:underline block"
            >
              合言葉はダツ皿アキのDiscordサーバーのサブスク限定チャットで配布中
            </a>
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

        {/* Skip background removal */}
        {sourceFile && (
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={() => setSkipBgRemoval(!skipBgRemoval)}
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors border ${
                skipBgRemoval
                  ? "border-purple-500 bg-purple-600/20 text-purple-300"
                  : "border-gray-600 bg-transparent text-gray-300 hover:border-gray-400 hover:text-gray-200"
              }`}
            >
              透過済みPNGをそのまま使う（VTuber・イラスト素材など）
            </button>
          </div>
        )}

        {/* Background removal quality toggle */}
        {sourceFile && !skipBgRemoval && (
          <div className="space-y-1">
            <label className="text-xs text-gray-400 block">透過精度</label>
            <div className="flex gap-2">
              {([
                { value: "speed" as BgRemovalQuality, label: "標準", desc: "速い" },
                { value: "quality" as BgRemovalQuality, label: "高精度", desc: "VTuber・イラスト向け" },
              ]).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setBgRemovalQuality(value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors border ${
                    bgRemovalQuality === value
                      ? "border-purple-500 bg-purple-600/20 text-purple-300"
                      : "border-gray-600 bg-transparent text-gray-400 hover:border-gray-400 hover:text-gray-200"
                  }`}
                >
                  <span className="block font-medium">{label}</span>
                  <span className="block text-[10px] opacity-70">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Processing indicator with cancel */}
        {stage === "removing-background" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <SpinnerIcon />
              {bgRemovalQuality === "quality" ? "背景を透過中（高精度モード）..." : "背景を透過中..."}
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

        {/* Brush editor for manual bg adjustment */}
        {stage === "brush-editing" && bgRemovedBlob && originalBlob && (
          <BrushEditor
            bgRemovedBlob={bgRemovedBlob}
            originalBlob={originalBlob}
            onConfirm={handleBrushConfirm}
            onSkip={handleBrushSkip}
          />
        )}
      </div>

      {/* Preview (mobile: order-1, desktop: right column, sticky) */}
      <div id="preview-area" className="bg-gray-900 rounded-lg p-4 md:p-6 flex flex-col items-center min-h-[300px] md:min-h-[400px] md:overflow-y-auto order-1 md:order-none self-start md:sticky md:top-4 md:max-h-screen [contain:layout_style]">
        {/* Export mode tabs */}
        <div className="flex w-full mb-4 bg-gray-800 rounded-lg p-0.5">
          {([
            { mode: "twitch" as ExportMode, label: "Twitch" },
            { mode: "discord" as ExportMode, label: "Discord" },
            { mode: "7tv" as ExportMode, label: "7TV" },
            { mode: "bttv" as ExportMode, label: "BTTV" },
            { mode: "ffz" as ExportMode, label: "FFZ" },
          ]).map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setExportMode(mode)}
              className={`flex-1 py-1.5 px-1 rounded-md text-[11px] font-medium transition-colors ${
                exportMode === mode
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Retry / skip button above preview */}
        {bgRemovedCanvas && stage === "ready" && (
          <div className="relative mb-3">
            <button
              onClick={() => setShowRetryMenu(!showRetryMenu)}
              className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700"
            >
              ↩ 透過を調整する
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
                    透過済み画像をそのまま使う（VTuber・イラスト素材など）
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <PreviewArea
          variants={variants}
          stage={stage}
          hasText={!!(config.text.customText.trim() || config.text.preset)}
          textPosition={config.text.position}
          exportMode={exportMode}
          onDownloadComplete={handleDownloadComplete}
          badgeSettings={config.badge}
          bgRemovedCanvas={bgRemovedCanvas}
        />
      </div>

      {/* Settings + DL/Share (mobile: order-4, desktop: sticky left column with DL inside) */}
      <div className={`space-y-4 md:space-y-6 order-4 md:order-none self-start md:sticky md:top-4 md:max-h-screen md:overflow-y-auto md:col-start-1 relative z-10 [contain:layout_style] ${!sourceFile ? "opacity-40 pointer-events-none select-none" : ""}`}>
        {!sourceFile && (
          <p className="text-xs text-gray-400 text-center py-1">画像をアップロードすると設定できます</p>
        )}
        <SettingsPanel
          config={config}
          onConfigChange={updateConfig}
          disabled={!sourceFile || stage === "removing-background"}
          isSubscriber={isSubscriber}
          subFile={subFile}
          onSubImageSelected={handleSubImageSelected}
          bgRemovedCanvas={bgRemovedCanvas}
          subCanvas={subCanvas}
        />
        {/* DL + Share inside sticky container (desktop only) */}
        {sourceFile && (
          <div className="hidden md:flex flex-col gap-3">
            <DownloadButton stage={stage} onExport={handleExport} variants={variants} exportMode={exportMode} onDownloadComplete={handleDownloadComplete} badgeSettings={config.badge} bgRemovedCanvas={bgRemovedCanvas} />
            <ShareButton imageDataUrl={variants.length > 0 ? variants.reduce((a, b) => a.size > b.size ? a : b).staticDataUrl : null} />
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
          <DownloadButton stage={stage} onExport={handleExport} variants={variants} exportMode={exportMode} onDownloadComplete={handleDownloadComplete} badgeSettings={config.badge} bgRemovedCanvas={bgRemovedCanvas} />
          <ShareButton imageDataUrl={variants.length > 0 ? variants.reduce((a, b) => a.size > b.size ? a : b).staticDataUrl : null} />
        </div>
      )}

      {/* Floating mini preview (mobile only) */}
      <FloatingMiniPreview variants={variants} stage={stage} />

      {/* Share after download modal */}
      {showShareModal && (
        <ShareAfterDownloadModal onClose={() => setShowShareModal(false)} imageDataUrl={variants.length > 0 ? variants.reduce((a, b) => a.size > b.size ? a : b).staticDataUrl : null} />
      )}
    </div>
  );
}
