"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEmoteProcessor } from "@/hooks/useEmoteProcessor";
import UploadPanel from "./UploadPanel";
import AdjustView, { type AdjustDecision, type BackgroundChoice } from "./AdjustView";
import type { AdjustState } from "./ImageAdjustEditor";
import BrushEditor from "./BrushEditor";
import SettingsPanel, { type EditorTool } from "./SettingsPanel";
import PreviewArea from "./PreviewArea";
import DownloadButton from "./DownloadButton";
import MobileDock from "./MobileDock";
import ShareButton from "./ShareButton";
import StepNav from "./StepNav";
import VideoFaceExtractor from "./VideoFaceExtractor";
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
import { ANIMATION_LIST } from "@/lib/animations/catalog";
import { PLATFORM_LABELS } from "@/lib/ui/export-plan";
import { canEnterStep, type SourceKind, type StudioStep, stepAfterSelect } from "@/lib/ui/steps";
import type { UploadKind } from "@/lib/upload/accept";
import { primaryBtn, secondaryBtn, textBtn } from "@/components/ui/classes";
import { PLATFORMS } from "@/lib/download/profiles";

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
    </svg>
  );
}

type Notice = { kind: "info" | "warn" | "error"; text: string };

const scrollTop = () => {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
};

/**
 * Studio shell (09 §実装構造): the one persistent parent that owns source /
 * config / variants / processing / access. Steps and tabs only change what is
 * shown; nothing that holds state is unmounted when the user moves around.
 */
export default function EmoteGenerator({ registerBrandHandler }: { registerBrandHandler?: (fn: () => void) => void }) {
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
    bgRemovalFailed,
    isGifSource,
    gifFrameCount,
    gifNotice,
    isVideoSource,
    videoFrameCount,
    ingestVideoSource,
  } = useEmoteProcessor(exportMode, subCanvas);

  // ---- studio flow state (09 §実装構造: 現在の工程 / 素材 / 調整 draft) ----
  const [step, setStep] = useState<StudioStep>(1);
  const [tool, setTool] = useState<EditorTool>("animation");
  const [sourceKind, setSourceKind] = useState<SourceKind | null>(null);
  const [sourceName, setSourceName] = useState("");
  /** Raw uploaded image — re-adjusting always starts from this, never from the crop. */
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [adjustState, setAdjustState] = useState<AdjustState | null>(null);
  /** The original that the current source was made from (re-entry = same file). */
  const [confirmedOriginal, setConfirmedOriginal] = useState<File | null>(null);
  const [background, setBackground] = useState<BackgroundChoice>("remove");
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((text: string, kind: Notice["kind"] = "info", ms = 5000) => {
    setNotice({ kind, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), ms);
  }, []);

  const hasSource = !!sourceFile || !!originalFile || !!pendingVideoFile;
  const stepContext = { hasSource, sourceKind };

  const goToStep = useCallback(
    (next: StudioStep) => {
      const a = canEnterStep(next, { hasSource, sourceKind });
      if (!a.ok) {
        showNotice(a.reason, "warn");
        return;
      }
      setStep(next);
      scrollTop();
    },
    [hasSource, sourceKind, showNotice],
  );

  useEffect(() => {
    registerBrandHandler?.(() => goToStep(1));
  }, [registerBrandHandler, goToStep]);

  // Sub image (2 画像合成): convert to a canvas when chosen; the latest pick wins.
  const subPickRef = useRef(0);
  const handleSubImageSelected = useCallback((file: File) => {
    setSubFile(file);
    const pick = ++subPickRef.current;
    fileToCanvas(file)
      .then((c) => { if (pick === subPickRef.current) setSubCanvas(c); })
      .catch(() => { if (pick === subPickRef.current) setSubCanvas(null); });
  }, [fileToCanvas]);

  // R1b: 解放状態はサーバー由来の AccessSnapshot（AccessProvider）が単一の源。
  const isPremium: boolean = access.isUnlocked;
  const needsReauth = access.followEnabled && access.needsReauth;

  // fix7: 2 層モーダル制御（軽量 = FeatureLockHint / 本格 = FollowGateModal）
  const [showFollowGate, setShowFollowGate] = useState(false);
  const [followGateVariant, setFollowGateVariant] = useState<"lock_modal" | "key_icon" | "onboarding">("lock_modal");
  const [followGatePreviewSrc, setFollowGatePreviewSrc] = useState<string | undefined>(undefined);
  const [lockHint, setLockHint] = useState<{ label: string } | null>(null);

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
      if (!access.isUnlocked && access.followerPending) {
        showNotice("フォロー状態を確認しています…", "info");
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
      showNotice(result.message, "error", 8000);
      return false;
    },
    [variants, exportMode, access.isUnlocked, access.followerPending, ensureFollowerFresh, showNotice],
  );

  // ---- step 1: choose ----
  const acceptFile = useCallback(
    (file: File, kind: UploadKind, opts?: { background?: BackgroundChoice }) => {
      setSourceName(file.name);
      setSourceKind(kind);
      if (kind === "gif") {
        setPendingVideoFile(null);
        setOriginalFile(null);
        setAdjustState(null);
        setSourceFile(file);
        if (config.animation.type !== "none") updateConfig({ animation: { type: "none" } });
        setStep(stepAfterSelect("gif"));
        scrollTop();
        return;
      }
      if (kind === "video") {
        setOriginalFile(null);
        setAdjustState(null);
        setPendingVideoFile(file);
        setSourceFile(file); // parks the hook until the trimmer hands over frames
        if (config.animation.type !== "none") updateConfig({ animation: { type: "none" } });
        setStep(stepAfterSelect("video"));
        scrollTop();
        return;
      }
      // Static image: keep the previous source until the adjusted file is confirmed.
      setPendingVideoFile(null);
      setOriginalFile(file);
      setAdjustState(null);
      // Photos default to removal; the bundled sample is already transparent.
      setBackground(opts?.background ?? "remove");
      setStep(stepAfterSelect("image"));
      scrollTop();
    },
    [config.animation.type, setSourceFile, updateConfig],
  );

  const handleFileAccepted = useCallback((file: File, kind: UploadKind) => acceptFile(file, kind), [acceptFile]);
  const handleSampleSelected = useCallback((file: File) => acceptFile(file, "image", { background: "keep" }), [acceptFile]);
  const handleFaceSelected = useCallback((file: File) => acceptFile(file, "image"), [acceptFile]);

  // ---- step 2: prepare ----
  const applyBackgroundChoice = useCallback(
    (choice: BackgroundChoice, quality: BgRemovalQuality) => {
      setBackground(choice);
      setSkipBgRemoval(choice === "keep");
      setBgRemovalQuality(quality);
    },
    [setSkipBgRemoval, setBgRemovalQuality],
  );

  const handleAdjustConfirm = useCallback(
    (d: AdjustDecision) => {
      applyBackgroundChoice(d.background, d.quality);
      setAdjustState(d.state);
      setConfirmedOriginal(originalFile);
      setSourceFile(d.file);
      setStep(3);
      scrollTop();
    },
    [applyBackgroundChoice, setSourceFile, originalFile],
  );

  const handleUseUnadjusted = useCallback(
    (choice: BackgroundChoice, quality: BgRemovalQuality) => {
      if (!originalFile) return;
      applyBackgroundChoice(choice, quality);
      setAdjustState(null);
      setConfirmedOriginal(originalFile);
      setSourceFile(originalFile);
      setStep(3);
      scrollTop();
    },
    [originalFile, applyBackgroundChoice, setSourceFile],
  );

  const handleAdjustCancel = useCallback(() => {
    setStep(3);
    scrollTop();
  }, []);

  const handleVideoConfirm = (decoded: DecodedVideo) => {
    setPendingVideoFile(null);
    ingestVideoSource(decoded);
    setStep(3);
    scrollTop();
  };

  const handleVideoCancel = () => {
    setPendingVideoFile(null);
    setSourceFile(null);
    setSourceKind(null);
    setSourceName("");
    setStep(1);
  };

  /** 「位置・背景を調整」 from the editor: re-open step 2 with the last crop as draft. */
  const revisitAdjust = sourceKind === "image" && !!originalFile && originalFile === confirmedOriginal;

  const selectionLabel = isGifSource
    ? "GIF の動き"
    : isVideoSource
      ? "動画の動き"
      : config.animation.type === "none"
        ? "動きなし"
        : ANIMATION_LIST.find((a) => a.id === config.animation.type)?.label ?? config.animation.type;
  const largestVariant = variants.length > 0 ? variants.reduce((a, b) => (a.size > b.size ? a : b)) : null;

  const scrollToPreview = useCallback(() => {
    document.getElementById("preview-area")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, []);

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

  const isRemoving = stage === "removing-background";

  return (
    <>
      {needsReauth && (
        <ReauthBanner variant={access.grants.includes("passphrase") ? "subscriber" : "default"} />
      )}

      <div className="flex-1 w-full max-w-[1456px] mx-auto px-4 md:px-10">
        <StepNav current={step} context={stepContext} onSelect={goToStep} onBlocked={(r) => showNotice(r, "warn")} />

        {notice && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 max-w-[min(90vw,600px)] px-5 py-3 rounded-[10px] text-[12px] shadow-[0_8px_30px_#0008] ${
              notice.kind === "error" ? "bg-[#3a2326] text-studio-danger border border-[#6b3a3f]" : notice.kind === "warn" ? "bg-[#3a3322] text-studio-warn border border-[#6b5a2c]" : "bg-[#eee4ff] text-[#2a193b]"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* ---------- 1. 画像を選ぶ ---------- */}
        <div hidden={step !== 1}>
          <UploadPanel onFileAccepted={handleFileAccepted} onSampleSelected={handleSampleSelected} hasImage={hasSource}>
            <div className="space-y-4">
              <VideoFaceExtractor onFaceSelected={handleFaceSelected} />
              {!isPremium && (
                <div className="flex justify-center">
                  <TrialBadge variant="badge-only" />
                </div>
              )}
              <AccessStatusPanel
                onOpenGate={() => {
                  setFollowGateVariant("onboarding");
                  setFollowGatePreviewSrc(undefined);
                  setShowFollowGate(true);
                }}
              />
            </div>
          </UploadPanel>
        </div>

        {/* ---------- 2. 画像を整える ---------- */}
        {step === 2 && (
          <AdjustView
            originalFile={originalFile}
            videoFile={pendingVideoFile}
            adjustState={adjustState}
            background={background}
            quality={bgRemovalQuality}
            revisit={revisitAdjust}
            onConfirm={handleAdjustConfirm}
            onUseUnadjusted={handleUseUnadjusted}
            onCancel={handleAdjustCancel}
            onVideoConfirm={handleVideoConfirm}
            onVideoCancel={handleVideoCancel}
          />
        )}

        {/* ---------- 3. 編集する ---------- */}
        <div hidden={step !== 3}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-1">03 / MAKE IT YOURS</p>
              <h1 className="text-[23px] md:text-[27px] font-bold leading-tight">表情に、ひと工夫。</h1>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-studio-muted">
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-studio-good" />
              <span className="max-w-[190px] truncate">{sourceName}</span>
              <button type="button" onClick={() => goToStep(1)} className={`${textBtn} ml-auto`}>画像を変更</button>
            </div>
          </div>

          {/* processing / failure states (09 §状態と例外) */}
          {isRemoving && (
            <div className="mb-4 bg-studio-surface border border-studio-stroke rounded-studio p-4 space-y-2" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-[13px] text-studio-text">
                <SpinnerIcon />
                {bgRemovalQuality === "quality" ? "背景を消しています（高精度）" : "背景を消しています"}
              </div>
              <div className="w-full bg-studio-raised rounded-full h-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="bg-studio-accent h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-studio-muted">初回は AI モデルの読み込みが必要です（約 30MB）</p>
                <button type="button" onClick={cancelBgRemoval} className={`${secondaryBtn} min-h-[36px] text-[12px] px-3 py-1.5`}>
                  キャンセルして元画像で続ける
                </button>
              </div>
            </div>
          )}
          {bgRemovalFailed && (
            <div className="mb-4 bg-[#3a2326] border border-[#6b3a3f] rounded-studio p-4 space-y-3" role="alert">
              <p className="text-[13px] text-studio-danger">背景を消せませんでした。元の画像のまま続けるか、もう一度試せます。</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={useOriginalImage} className={`${primaryBtn} min-h-[40px] text-[12px]`}>元画像で続ける</button>
                <button type="button" onClick={retryBgRemoval} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>再試行</button>
                <button type="button" onClick={() => goToStep(1)} className={textBtn}>画像を変更</button>
              </div>
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 text-[12px] px-4 py-3 rounded-[10px] bg-[#3a2326] border border-[#6b3a3f] text-studio-danger" role="alert">
              {errorMessage}
            </div>
          )}
          {isGifSource && (
            <div className="mb-4 text-[12px] px-4 py-3 rounded-[10px] bg-studio-surface border border-studio-stroke text-studio-muted">
              <span className="font-semibold text-studio-text">GIF の動きをそのまま使います</span> — {gifFrameCount} フレームを各サイズで再エンコードします。フチ・文字・フレームは全フレームに掛かります。
              {gifNotice && <span className="block mt-1 text-studio-warn">{gifNotice}</span>}
            </div>
          )}
          {isVideoSource && (
            <div className="mb-4 text-[12px] px-4 py-3 rounded-[10px] bg-studio-surface border border-studio-stroke text-studio-muted">
              <span className="font-semibold text-studio-text">動画の動きをそのまま使います</span> — {videoFrameCount} フレームを各サイズで再エンコードします。
            </div>
          )}

          {/* Brush editor for manual bg adjustment */}
          {stage === "brush-editing" && bgRemovedBlob && originalBlob && (
            <div className="mb-4 bg-studio-surface border border-studio-stroke rounded-studio p-4">
              <h2 className="text-[15px] font-bold mb-1">背景の仕上げ</h2>
              <p className="text-[12px] text-studio-muted mb-3">消しすぎた所を戻したり、残った背景を消したりできます。そのままでよければ「スキップ」。</p>
              <BrushEditor bgRemovedBlob={bgRemovedBlob} originalBlob={originalBlob} onConfirm={handleBrushConfirm} onSkip={handleBrushSkip} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[minmax(290px,.82fr)_minmax(410px,1.18fr)] gap-4 md:gap-6 items-start">
            <div id="preview-area" className="md:sticky md:top-4 scroll-mt-4">
              <PreviewArea
                variants={variants}
                stage={stage}
                exportMode={exportMode}
                selectionLabel={selectionLabel}
                hasText={!!(config.text.customText.trim() || config.text.preset)}
                textPosition={config.text.position}
                badgeSettings={config.badge}
                bgRemovedCanvas={bgRemovedCanvas}
                onContentAdjust={isGifSource || isVideoSource ? undefined : handleContentAdjust}
                onGoAdjust={revisitAdjust ? () => goToStep(2) : null}
                onGoExport={() => goToStep(4)}
              />
            </div>
            <SettingsPanel
              config={config}
              onConfigChange={updateConfig}
              disabled={!sourceFile || isRemoving}
              isPremium={isPremium}
              onTrialLockClick={handleTrialLockClick}
              subFile={subFile}
              onSubImageSelected={handleSubImageSelected}
              bgRemovedCanvas={bgRemovedCanvas}
              subCanvas={subCanvas}
              isAnimatedSource={isGifSource || isVideoSource}
              tool={tool}
              onToolChange={setTool}
              onGoAdjust={revisitAdjust ? () => goToStep(2) : null}
              onRetryBgRemoval={retryBgRemoval}
              onUseOriginal={useOriginalImage}
              onResetPosition={handleResetPosition}
              hasPositionAdjustment={hasPositionAdjustment}
              canRedoBackground={!!bgRemovedCanvas && stage === "ready" && !isGifSource && !isVideoSource}
              onBeforeDownload={onBeforeDownload}
            />
          </div>
          <div className="h-20 md:h-0" aria-hidden />
        </div>
        {step === 3 && (
          <MobileDock previewSrc={largestVariant?.staticDataUrl ?? null} onPreview={scrollToPreview} onExport={() => goToStep(4)} />
        )}

        {/* ---------- 4. 保存する (U2 placeholder: existing save controls; replaced in U3) ---------- */}
        <div hidden={step !== 4}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-1">04 / READY TO REACT</p>
              <h1 className="text-[23px] md:text-[27px] font-bold leading-tight">あとは、保存するだけ。</h1>
            </div>
            <button type="button" onClick={() => goToStep(3)} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>← 編集に戻る</button>
          </div>
          <div className="max-w-[640px] mx-auto bg-studio-surface border border-studio-stroke rounded-studio p-4 md:p-6 space-y-4">
            <div className="flex w-full bg-studio-raised rounded-lg p-0.5" role="group" aria-label="どこで使いますか">
              {PLATFORMS.map((mode) => (
                <button key={mode} type="button" onClick={() => setExportMode(mode)} aria-pressed={exportMode === mode} className={`flex-1 py-2 px-1 rounded-md text-xs font-medium transition-colors ${exportMode === mode ? "bg-studio-accent text-studio-accent-ink" : "text-studio-muted hover:text-studio-text"}`}>
                  {PLATFORM_LABELS[mode]}
                </button>
              ))}
            </div>
            {sourceFile && (
              <>
                <DownloadButton stage={stage} onExport={handleExport} variants={variants} exportMode={exportMode} badgeSettings={config.badge} bgRemovedCanvas={bgRemovedCanvas} onBeforeDownload={onBeforeDownload} />
                <ShareButton imageDataUrl={largestVariant?.staticDataUrl ?? null} />
              </>
            )}
          </div>
        </div>
      </div>

      <FeatureLockHint
        open={lockHint !== null}
        onClose={() => setLockHint(null)}
        featureLabel={lockHint?.label ?? ""}
        onPromoteToFullModal={() => {
          setFollowGateVariant("key_icon");
          setShowFollowGate(true);
        }}
      />

      <FollowGateModal
        open={showFollowGate}
        onClose={() => setShowFollowGate(false)}
        variant={followGateVariant}
        previewSrc={followGatePreviewSrc}
      />
    </>
  );
}
