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
import VideoTrimmer from "./VideoTrimmer";
import type { DecodedVideo } from "@/lib/video/decoder";
import TrialBadge from "./TrialBadge";
import ReauthBanner from "./ReauthBanner";
import FollowGateModal from "./FollowGateModal";
import AccessStatusPanel from "./AccessStatusPanel";
import { useAccess } from "./providers/AccessProvider";
import type { DownloadGate } from "@/lib/download/profiles";
import { requestDownloadPermission } from "@/lib/download/client";
import FeatureLockHint, { canShowFeatureLockHint } from "./FeatureLockHint";
import { EmoteConfig, ExportMode, BgRemovalQuality } from "@/types/emote";

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
    </svg>
  );
}

export default function EmoteGenerator() {
  const { access, ensureFollowerFresh } = useAccess();
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
    errorMessage,
    isGifSource,
    gifFrameCount,
    gifNotice,
    isVideoSource,
    videoFrameCount,
    ingestVideoSource,
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
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  // R1b: 解放状態はサーバー由来の AccessSnapshot（AccessProvider）が単一の源。
  // localStorage や固定 true は使わない。SITE_LOCK_ENABLED=false の縮退時は
  // isUnlocked=false のまま trial 制限が UI に反映される（設計 §9）。
  const isPremium: boolean = access.isUnlocked;
  const needsReauth = access.followEnabled && access.needsReauth;
  const [authToast, setAuthToast] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // fix7: 2 層モーダル制御（軽量 = FeatureLockHint / 本格 = FollowGateModal）
  const [showFollowGate, setShowFollowGate] = useState(false);
  const [followGateVariant, setFollowGateVariant] = useState<
    "lock_modal" | "key_icon" | "onboarding"
  >("lock_modal");
  const [followGatePreviewSrc, setFollowGatePreviewSrc] = useState<
    string | undefined
  >(undefined);
  const [lockHint, setLockHint] = useState<{ label: string } | null>(null);

  /**
   * trial 版で locked な機能（フチ・アニメ・テキスト色）をクリックされた時の
   * 親側ハンドラ。同一セッションで FeatureLockHint が 5 回表示されたら、
   * 以降は直接 FollowGateModal にプロモートする（key_icon variant で計測）。
   */
  const handleTrialLockClick = useCallback((featureLabel: string) => {
    if (canShowFeatureLockHint()) {
      setLockHint({ label: featureLabel });
    } else {
      setFollowGateVariant("key_icon");
      setShowFollowGate(true);
    }
  }, []);

  /**
   * 全保存経路共通のゲート (R1c, 仕様書 §9)。含まれる全ファイルを
   * /api/download-check で検証。403 access-required → 再認証パネル、
   * 400/429/503/通信失敗 → それぞれの説明（フォロー勧誘に変換しない）。
   */
  const onBeforeDownload = useCallback<DownloadGate>(
    async (files, assetType = "emote", platform = exportMode) => {
      // 04 指示: 期限切れ直後は「確認中」→ 再確認を待ってから保護操作へ進む。
      if (!access.isUnlocked && access.followerPending) {
        showAuthToast("フォロー状態を確認しています…");
        const fresh = await ensureFollowerFresh();
        if (!fresh?.isUnlocked) {
          setFollowGateVariant("lock_modal");
          setShowFollowGate(true);
          return false;
        }
      }
      const result = await requestDownloadPermission({ platform, assetType, files });
      if (result.allowed) return true;
      if (result.reason === "access-required" || result.reason === "site-locked") {
        const tinyVariant = variants.find((v) => v.size === 28);
        setFollowGatePreviewSrc(tinyVariant?.staticDataUrl);
        setFollowGateVariant("lock_modal");
        setShowFollowGate(true);
        return false;
      }
      showAuthToast(result.message);
      return false;
    },
    [variants, exportMode, access.isUnlocked, access.followerPending, ensureFollowerFresh],
  );

  const handleDownloadComplete = () => setShowShareModal(true);

  const showAuthToast = (msg: string) => {
    setAuthToast(msg);
    setTimeout(() => setAuthToast(null), 6000);
  };

  const handleImageSelected = (file: File) => {
    // GIFs go straight to the source — no static crop editor (each frame would
    // re-render anyway, and the editor only handles single images).
    if (file.type === "image/gif") {
      setPendingFile(null);
      setPendingVideoFile(null);
      setSourceFile(file);
      // GIF is its own animation; clear any frame-by-frame animation overlay.
      if (config.animation.type !== "none") {
        updateConfig({ animation: { type: "none" } });
      }
      return;
    }
    // Videos go to the trimming UI before frame extraction.
    if (file.type.startsWith("video/")) {
      setPendingFile(null);
      setPendingVideoFile(file);
      setSourceFile(file); // so settings panel and downstream UI light up
      if (config.animation.type !== "none") {
        updateConfig({ animation: { type: "none" } });
      }
      return;
    }
    setPendingVideoFile(null);
    setPendingFile(file);
  };

  const handleVideoConfirm = (decoded: DecodedVideo) => {
    setPendingVideoFile(null);
    ingestVideoSource(decoded);
  };

  const handleVideoCancel = () => {
    setPendingVideoFile(null);
    setSourceFile(null);
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

  const handleContentAdjust = useCallback((dx: number, dy: number, ds: number) => {
    updateConfig({
      contentOffsetX: config.contentOffsetX + dx,
      contentOffsetY: config.contentOffsetY + dy,
      contentScale: Math.max(0.5, Math.min(2.0, config.contentScale + ds)),
    } as Partial<EmoteConfig>);
  }, [config.contentOffsetX, config.contentOffsetY, config.contentScale, updateConfig]);

  const handleResetPosition = useCallback(() => {
    updateConfig({ contentOffsetX: 0, contentOffsetY: 0, contentScale: 1.0 } as Partial<EmoteConfig>);
  }, [updateConfig]);

  const hasPositionAdjustment = config.contentOffsetX !== 0 || config.contentOffsetY !== 0 || config.contentScale !== 1.0;

  const [adjustToast, setAdjustToast] = useState<string | null>(null);

  const handleReenterAdjust = useCallback(() => {
    if (!sourceFile) return;
    setAdjustToast("位置を調整後、透過処理をやり直します（10〜30秒）");
    setTimeout(() => setAdjustToast(null), 5000);
    setPendingFile(sourceFile);
  }, [sourceFile]);

  return (
    <>
      {/* fix7: 旧 scope ログイン者に再認可を促すバナー（× で控えめアイコンに切替） */}
      {needsReauth && (
        <ReauthBanner variant={access.grants.includes("passphrase") ? "subscriber" : "default"} />
      )}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4 md:gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full overflow-x-hidden">
      {/* Upload + toggle + progress (top-left on desktop, 1st on mobile) */}
      <div className="space-y-4 md:space-y-6 order-1 md:order-none self-start">
        {/* fix7: お試し版（trial）バッジ — 非 premium 時のみ控えめ表示 */}
        {!isPremium && (
          <div className="flex items-center justify-start">
            <TrialBadge variant="badge-only" />
          </div>
        )}
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

        {/* Video trimmer (Phase 2) */}
        {pendingVideoFile && (
          <VideoTrimmer
            file={pendingVideoFile}
            onConfirm={handleVideoConfirm}
            onCancel={handleVideoCancel}
          />
        )}

        {/* Video face extractor */}
        <VideoFaceExtractor
          onFaceSelected={handleImageSelected}
        />

        {/* R1b: 解放状態の表示・解除（フォロー / 合言葉を別々に扱う） */}
        <AccessStatusPanel
          onOpenGate={() => {
            setFollowGateVariant("onboarding");
            setFollowGatePreviewSrc(undefined);
            setShowFollowGate(true);
          }}
        />

        {/* Auth toast */}
        {authToast && (
          <div className={`text-xs px-3 py-2 rounded-lg text-center ${
            "bg-red-600/30 text-red-300"
          }`}>
            {authToast}
          </div>
        )}
        {/* Error toast */}
        {errorMessage && (
          <div className="text-xs px-3 py-2 rounded-lg text-center bg-red-600/30 text-red-300">
            {errorMessage}
          </div>
        )}
        {/* Adjust toast */}
        {adjustToast && (
          <div className="text-xs px-3 py-2 rounded-lg text-center bg-yellow-600/30 text-yellow-300">
            {adjustToast}
          </div>
        )}

        {/* GIF source info */}
        {isGifSource && (
          <div className="space-y-1.5">
            <div className="text-xs px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30">
              <span className="font-medium">GIFモード</span> — {gifFrameCount}フレームを各サイズで再エンコードします
            </div>
            {gifNotice && (
              <div className="text-xs px-3 py-2 rounded-lg bg-yellow-600/20 text-yellow-300 border border-yellow-500/30">
                {gifNotice}
              </div>
            )}
            <p className="text-xs text-gray-500">
              フチ・テキスト・フレーム装飾は全フレームに適用されます。背景透過とアニメーション設定はスキップされ、元のGIFの動きとタイミングがそのまま使われます。
            </p>
          </div>
        )}

        {/* Video source info */}
        {isVideoSource && (
          <div className="space-y-1.5">
            <div className="text-xs px-3 py-2 rounded-lg bg-pink-600/20 text-pink-200 border border-pink-500/30">
              <span className="font-medium">動画モード</span> — {videoFrameCount}フレームを各サイズで再エンコードします
            </div>
            <p className="text-xs text-gray-500">
              フチ・テキスト・フレーム装飾は全フレームに適用されます。背景透過とアニメーション設定はスキップされます。
            </p>
          </div>
        )}

        {/* Skip background removal (hidden for animated sources) */}
        {sourceFile && !isGifSource && !isVideoSource && !pendingVideoFile && (
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={() => setSkipBgRemoval(!skipBgRemoval)}
              className={`w-full px-3 py-2 rounded-lg text-sm transition-colors border ${
                skipBgRemoval
                  ? "border-purple-500 bg-purple-600/20 text-purple-300"
                  : "border-gray-600 bg-transparent text-gray-300 hover:border-gray-400 hover:text-gray-200"
              }`}
            >
              <span className="whitespace-nowrap">透過済みPNGをそのまま使う</span><br /><span className="text-xs">（VTuber・イラスト素材など）</span>
            </button>
          </div>
        )}

        {/* Background removal quality toggle (hidden for animated sources) */}
        {sourceFile && !isGifSource && !isVideoSource && !pendingVideoFile && !skipBgRemoval && (
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
                  <span className="block text-xs opacity-70">{desc}</span>
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
                className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors whitespace-nowrap"
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
              className={`flex-1 py-1.5 px-1 rounded-md text-xs font-medium transition-colors ${
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
          <div className="relative mb-3 flex items-center gap-2 flex-wrap">
            {!isGifSource && !isVideoSource && (
              <button
                onClick={() => setShowRetryMenu(!showRetryMenu)}
                className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                ↩ 透過を調整する
              </button>
            )}
            {!isGifSource && !isVideoSource && (
              <button
                onClick={handleReenterAdjust}
                className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                ↔ 位置を調整する
              </button>
            )}
            {hasPositionAdjustment && (
              <button
                onClick={handleResetPosition}
                className="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors border border-gray-700"
              >
                ↺ 位置をリセット
              </button>
            )}
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
          onContentAdjust={handleContentAdjust}
          onBeforeDownload={onBeforeDownload}
        />
      </div>

      {/* Settings + DL/Share (mobile: order-4, desktop: sticky left column with DL inside) */}
      <div className={`space-y-4 md:space-y-6 order-4 md:order-none self-start md:sticky md:top-4 md:max-h-screen md:overflow-y-auto md:pr-2 md:col-start-1 relative z-10 [contain:layout_style] overflow-x-hidden ${!sourceFile ? "opacity-40 pointer-events-none select-none" : ""}`}>
        {!sourceFile && (
          <p className="text-xs text-gray-400 text-center py-1">画像をアップロードすると設定できます</p>
        )}
        <SettingsPanel
          config={config}
          onConfigChange={updateConfig}
          disabled={!sourceFile || stage === "removing-background"}
          isPremium={isPremium}
          onTrialLockClick={handleTrialLockClick}
          subFile={subFile}
          onSubImageSelected={handleSubImageSelected}
          bgRemovedCanvas={bgRemovedCanvas}
          subCanvas={subCanvas}
          isAnimatedSource={isGifSource || isVideoSource}
        />
        {/* DL + Share inside sticky container (desktop only) */}
        {sourceFile && (
          <div className="hidden md:flex flex-col gap-3">
            <DownloadButton stage={stage} onExport={handleExport} variants={variants} exportMode={exportMode} onDownloadComplete={handleDownloadComplete} badgeSettings={config.badge} bgRemovedCanvas={bgRemovedCanvas} onBeforeDownload={onBeforeDownload} />
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
            onBeforeDownload={onBeforeDownload}
          />
        </div>
      )}

      {/* DL + Share (mobile only: order-2) */}
      {sourceFile && (
        <div className="space-y-3 order-2 md:hidden self-start">
          <DownloadButton stage={stage} onExport={handleExport} variants={variants} exportMode={exportMode} onDownloadComplete={handleDownloadComplete} badgeSettings={config.badge} bgRemovedCanvas={bgRemovedCanvas} onBeforeDownload={onBeforeDownload} />
          <ShareButton imageDataUrl={variants.length > 0 ? variants.reduce((a, b) => a.size > b.size ? a : b).staticDataUrl : null} />
        </div>
      )}

      {/* Floating mini preview (mobile only) */}
      <FloatingMiniPreview variants={variants} stage={stage} />

      {/* Share after download modal */}
      {showShareModal && (
        <ShareAfterDownloadModal onClose={() => setShowShareModal(false)} imageDataUrl={variants.length > 0 ? variants.reduce((a, b) => a.size > b.size ? a : b).staticDataUrl : null} />
      )}

      {/* fix7: 軽量モーダル（鍵マーククリック時、5回まで） */}
      <FeatureLockHint
        open={lockHint !== null}
        onClose={() => setLockHint(null)}
        featureLabel={lockHint?.label ?? ""}
        onPromoteToFullModal={() => {
          setFollowGateVariant("key_icon");
          setShowFollowGate(true);
        }}
      />

      {/* fix7: 本格誘導モーダル（DL クリック時 / FeatureLockHint 経由） */}
      <FollowGateModal
        open={showFollowGate}
        onClose={() => setShowFollowGate(false)}
        variant={followGateVariant}
        previewSrc={followGatePreviewSrc}
      />
    </div>
    </>
  );
}
