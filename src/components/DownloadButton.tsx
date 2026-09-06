import { useCallback, useEffect, useRef, useState } from "react";
import type { AssetType, DownloadFile, DownloadGate } from "@/lib/download/profiles";
import { triggerAnchorDownload } from "@/lib/download/client";
import { BadgeSettings, BADGE_SIZES, EmoteVariant, ExportMode, ProcessingStage } from "@/types/emote";
import { renderBadge } from "@/lib/canvasPipeline";

const isIOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);

interface DownloadButtonProps {
  stage: ProcessingStage;
  /** ZIP export; resolves true only when the browser download actually started. */
  onExport: () => Promise<boolean>;
  variants: EmoteVariant[];
  exportMode?: ExportMode;
  onDownloadComplete?: () => void;
  badgeSettings?: BadgeSettings;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  /**
   * R1c: 全保存経路共通のゲート。含まれる全ファイルを /api/download-check で
   * 検証し、false なら中断（親が再認証パネルや説明を出す）。
   */
  onBeforeDownload?: DownloadGate;
}

export default function DownloadButton({
  stage,
  onExport,
  variants,
  exportMode = "twitch",
  onDownloadComplete,
  badgeSettings,
  bgRemovedCanvas,
  onBeforeDownload,
}: DownloadButtonProps) {
  const isReady = stage === "ready";
  const isExporting = stage === "exporting";

  const largestSize = exportMode === "twitch" || exportMode === "bttv" ? 112 : 128;

  // iOS step download state (0=initial, 1=largest done, 2=mid done)
  const [iosStep, setIosStep] = useState(0);
  const [iosBadgeStep, setIosBadgeStep] = useState(0);
  const [iosToast, setIosToast] = useState<string | null>(null);

  const showIosToast = useCallback((msg: string) => {
    setIosToast(msg);
    setTimeout(() => setIosToast(null), 5000);
  }, []);

  /** Get variant URL (blob or data URL) */
  const getVariantUrl = useCallback((v: EmoteVariant): { url: string; needsRevoke: boolean } => {
    if (v.animatedBlob) {
      return { url: URL.createObjectURL(v.animatedBlob), needsRevoke: true };
    }
    return { url: v.staticDataUrl, needsRevoke: false };
  }, []);

  // Get sorted sizes for the current export mode (descending)
  const sortedSizes = [...variants].sort((a, b) => b.size - a.size);

  // ---- R1c: shared gate + iOS two-tap flow ----
  const fileOf = (v: EmoteVariant): DownloadFile => ({ size: v.size, format: v.animatedBlob ? "gif" : "png" });
  const latestVariants = useRef(variants);
  useEffect(() => {
    latestVariants.current = variants;
  }, [variants]);
  /**
   * iOS: which action has passed the async permission check, bound to the
   * outputs it was checked for. A new render of `variants` disarms it
   * without an effect (derived state).
   */
  type IosAction = "largest" | "zip" | "badge";
  const [armed, setArmed] = useState<{ forVariants: EmoteVariant[]; action: IosAction } | null>(null);
  const iosArmed: IosAction | null = armed && armed.forVariants === variants ? armed.action : null;
  const setIosArmed = useCallback((action: IosAction) => setArmed({ forVariants: variants, action }), [variants]);

  /**
   * Permission gate with a revision guard: if the outputs changed while the
   * server was answering, do not mix old and new files — ask for a re-press.
   */
  const gate = useCallback(
    async (files: DownloadFile[], assetType: AssetType = "emote"): Promise<boolean> => {
      const snapshot = latestVariants.current;
      if (onBeforeDownload) {
        const ok = await onBeforeDownload(files, assetType);
        if (!ok) return false;
      }
      if (assetType === "emote" && latestVariants.current !== snapshot) {
        showIosToast("出力が更新されました。もう一度押してください");
        return false;
      }
      return true;
    },
    [onBeforeDownload, showIosToast],
  );

  /** iOS: open synchronously from the click (no await before window.open). */
  const openOnIos = useCallback(
    (url: string, needsRevoke: boolean): boolean => {
      const w = window.open(url, "_blank");
      if (!w) {
        showIosToast("ポップアップがブロックされました。Safari の設定で許可するか、プレビューの画像を長押しして保存してください");
        if (needsRevoke) URL.revokeObjectURL(url);
        return false;
      }
      if (needsRevoke) setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    },
    [showIosToast],
  );

  const handleLargestDownload = useCallback(async () => {
    const vLargest = variants.find((v) => v.size === largestSize);
    if (!vLargest) return;

    if (isIOS) {
      if (iosArmed !== "largest") {
        if (!(await gate([fileOf(vLargest)]))) return;
        setIosArmed("largest");
        showIosToast(`準備できました。もう一度押すと ${vLargest.size}px を開きます`);
        return;
      }
      const { url, needsRevoke } = getVariantUrl(vLargest);
      if (!openOnIos(url, needsRevoke)) return;
      showIosToast("長押し →「写真に追加」で保存できます");
      onDownloadComplete?.();
      return;
    }

    if (!(await gate([fileOf(vLargest)]))) return;
    const { url, needsRevoke } = getVariantUrl(vLargest);
    triggerAnchorDownload(url, vLargest.filename, needsRevoke);
    onDownloadComplete?.();
  }, [variants, largestSize, onDownloadComplete, getVariantUrl, showIosToast, gate, iosArmed, setIosArmed, openOnIos]);

  const handleZipDownload = useCallback(async () => {
    // R1c: ZIP は含む全ファイルを検証する（最大サイズだけではない）
    const files = variants.map(fileOf);

    if (isIOS) {
      if (iosArmed !== "zip") {
        if (!(await gate(files))) return;
        setIosArmed("zip");
        showIosToast("準備できました。もう一度押すと最初のサイズを開きます");
        return;
      }
      const target = sortedSizes[iosStep];
      if (!target) return;
      const { url, needsRevoke } = getVariantUrl(target);
      if (!openOnIos(url, needsRevoke)) return;

      if (iosStep < sortedSizes.length - 1) {
        setIosStep(iosStep + 1);
        showIosToast(`${target.size}pxを開きました。長押しで保存後、次のサイズを押してください`);
      } else {
        setIosStep(0);
        showIosToast("全サイズ完了！長押し →「写真に追加」で保存できます");
        onDownloadComplete?.();
      }
      return;
    }

    if (!(await gate(files))) return;
    const ok = await onExport();
    if (ok) onDownloadComplete?.();
  }, [iosStep, sortedSizes, onExport, onDownloadComplete, getVariantUrl, showIosToast, variants, gate, iosArmed, setIosArmed, openOnIos]);

  const handleBadgeDownload = useCallback(async () => {
    if (!badgeSettings?.enabled || !bgRemovedCanvas) return;
    const badgeFiles: DownloadFile[] = BADGE_SIZES.map((size) => ({ size, format: "png" }));

    if (isIOS) {
      if (iosArmed !== "badge") {
        if (!(await gate(badgeFiles, "badge"))) return;
        setIosArmed("badge");
        showIosToast("準備できました。もう一度押すと最初のバッジを開きます");
        return;
      }
      const targetSize = BADGE_SIZES[iosBadgeStep];
      if (targetSize === undefined) return;
      const canvas = renderBadge(bgRemovedCanvas, badgeSettings, targetSize);
      const dataUrl = canvas.toDataURL("image/png");
      if (!openOnIos(dataUrl, false)) return;

      if (iosBadgeStep < BADGE_SIZES.length - 1) {
        setIosBadgeStep(iosBadgeStep + 1);
        showIosToast(`${targetSize}pxバッジを開きました。長押しで保存後、次を押してください`);
      } else {
        setIosBadgeStep(0);
        showIosToast("全バッジ完了！長押し →「写真に追加」で保存できます");
        onDownloadComplete?.();
      }
      return;
    }

    if (!(await gate(badgeFiles, "badge"))) return;
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const size of BADGE_SIZES) {
        const canvas = renderBadge(bgRemovedCanvas, badgeSettings, size);
        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        zip.file(`badge_${size}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      triggerAnchorDownload(URL.createObjectURL(blob), "badge.zip", true);
      onDownloadComplete?.();
    } catch (e) {
      console.error("badge zip failed:", e);
      showIosToast("バッジの書き出しに失敗しました。もう一度お試しください");
    }
  }, [badgeSettings, bgRemovedCanvas, onDownloadComplete, showIosToast, iosBadgeStep, gate, iosArmed, setIosArmed, openOnIos]);

  const vLargest = variants.find((v) => v.size === largestSize);
  const formatLargest = vLargest?.animatedBlob ? "GIF" : "PNG";

  // File size summary (animated only — PNGs are always tiny enough).
  const animatedSummary = variants
    .filter((v) => v.animatedBlob)
    .map((v) => ({
      size: v.size,
      bytes: v.animatedBlob!.size,
      overLimit: v.animatedBlob!.size > 1024 * 1024,
    }))
    .sort((a, b) => b.size - a.size);
  const hasOversize = animatedSummary.some((s) => s.overLimit);
  const formatBytes = (n: number) =>
    n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)}MB` : `${Math.round(n / 1024)}KB`;

  // iOS step button label
  const iosZipLabel = iosStep === 0
    ? "全サイズを順番にDL（iOS）"
    : `${sortedSizes[iosStep]?.size}pxを開く（${iosStep + 1}/${sortedSizes.length}）`;

  return (
    <div className="flex flex-col gap-2">
      {/* iOS toast */}
      {iosToast && (
        <div className="bg-purple-900/80 text-purple-200 text-xs p-2 rounded-lg text-center animate-pulse">
          {iosToast}
        </div>
      )}

      {/* Animated GIF size summary (only when there's animated output) */}
      {isReady && animatedSummary.length > 0 && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          hasOversize
            ? "bg-red-900/30 border-red-700 text-red-200"
            : "bg-gray-800 border-gray-700 text-gray-400"
        }`}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium">GIFファイルサイズ</span>
            <span className="opacity-70">Twitch上限: 1MB</span>
          </div>
          <div className="space-y-0.5">
            {animatedSummary.map((s) => (
              <div key={s.size} className="flex justify-between font-mono">
                <span>{s.size}px</span>
                <span className={s.overLimit ? "text-red-300 font-semibold" : ""}>
                  {formatBytes(s.bytes)}{s.overLimit ? " ⚠" : ""}
                </span>
              </div>
            ))}
          </div>
          {hasOversize && (
            <p className="mt-1.5 text-[11px] leading-snug">
              赤字のサイズはTwitch登録時にリジェクトされる可能性があります。フチを細くする・テキストを短くする・別のGIFを使うなどで軽量化してください。
            </p>
          )}
        </div>
      )}

      {/* Largest size quick download */}
      <button
        onClick={handleLargestDownload}
        disabled={!isReady}
        className={`w-full py-2.5 px-4 min-h-[44px] md:min-h-0 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
          isReady
            ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
        </svg>
        <span className="whitespace-nowrap">{largestSize}px <span className="inline-block w-[2em] text-center">{formatLargest}</span> をダウンロード</span>
      </button>

      {/* ZIP bulk download / iOS step download */}
      <button
        onClick={handleZipDownload}
        disabled={!isReady}
        className={`w-full py-2 px-4 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors ${
          isReady
            ? iosStep > 0
              ? "bg-purple-700 hover:bg-purple-600 text-white cursor-pointer border border-purple-500"
              : "bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer border border-gray-600"
            : isExporting
            ? "bg-purple-800 text-purple-300 cursor-wait opacity-60"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isExporting ? (
          <span className="flex items-center justify-center gap-2">
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
            書き出し中...
          </span>
        ) : (
          <span className="whitespace-nowrap">
            {isIOS ? iosZipLabel : "全サイズ一括DL（ZIP）"}
          </span>
        )}
      </button>

      {/* iOS step reset button */}
      {isIOS && iosStep > 0 && (
        <button
          onClick={() => setIosStep(0)}
          className="w-full py-1.5 px-4 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          リセット
        </button>
      )}

      {/* Badge ZIP download */}
      {badgeSettings?.enabled && bgRemovedCanvas && (
        <>
          <button
            onClick={handleBadgeDownload}
            disabled={!isReady}
            className={`w-full py-2 px-4 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors ${
              isReady
                ? iosBadgeStep > 0
                  ? "bg-purple-700 hover:bg-purple-600 text-white cursor-pointer border border-purple-500"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer border border-purple-600"
                : "bg-gray-700 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isIOS
              ? iosBadgeStep === 0
                ? "バッジを順番にDL（iOS）"
                : `${BADGE_SIZES[iosBadgeStep]}pxバッジを開く（${iosBadgeStep + 1}/${BADGE_SIZES.length}）`
              : "バッジ一括DL（ZIP）"}
          </button>
          {isIOS && iosBadgeStep > 0 && (
            <button
              onClick={() => setIosBadgeStep(0)}
              className="w-full py-1.5 px-4 rounded-lg text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              バッジDLリセット
            </button>
          )}
        </>
      )}
    </div>
  );
}
