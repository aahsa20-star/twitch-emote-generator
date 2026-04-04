import { useCallback, useState } from "react";
import { BadgeSettings, BADGE_SIZES, EmoteVariant, ExportMode, ProcessingStage } from "@/types/emote";
import { renderBadge } from "@/lib/canvasPipeline";

const isIOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);

interface DownloadButtonProps {
  stage: ProcessingStage;
  onExport: () => void;
  variants: EmoteVariant[];
  exportMode?: ExportMode;
  onDownloadComplete?: () => void;
  badgeSettings?: BadgeSettings;
  bgRemovedCanvas?: HTMLCanvasElement | null;
}

export default function DownloadButton({
  stage,
  onExport,
  variants,
  exportMode = "twitch",
  onDownloadComplete,
  badgeSettings,
  bgRemovedCanvas,
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

  const handleLargestDownload = useCallback(() => {
    const vLargest = variants.find((v) => v.size === largestSize);
    if (!vLargest) return;

    const { url, needsRevoke } = getVariantUrl(vLargest);

    if (isIOS) {
      window.open(url, "_blank");
      showIosToast("長押し →「写真に追加」で保存できます");
      if (needsRevoke) setTimeout(() => URL.revokeObjectURL(url), 5000);
      onDownloadComplete?.();
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = vLargest.filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      if (needsRevoke) URL.revokeObjectURL(url);
    }, 1000);
    onDownloadComplete?.();
  }, [variants, largestSize, onDownloadComplete, getVariantUrl, showIosToast]);

  const handleZipDownload = useCallback(async () => {
    if (isIOS) {
      // Step-based download for iOS
      const target = sortedSizes[iosStep];
      if (!target) return;

      const { url, needsRevoke } = getVariantUrl(target);
      window.open(url, "_blank");
      if (needsRevoke) setTimeout(() => URL.revokeObjectURL(url), 5000);

      if (iosStep < sortedSizes.length - 1) {
        setIosStep(iosStep + 1);
        showIosToast(`${target.size}pxを開きました。長押しで保存後、次のサイズを押してください`);
      } else {
        // All done
        setIosStep(0);
        showIosToast("全サイズ完了！長押し →「写真に追加」で保存できます");
        onDownloadComplete?.();
      }
      return;
    }

    // Non-iOS: standard ZIP download
    await onExport();
    onDownloadComplete?.();
  }, [iosStep, sortedSizes, onExport, onDownloadComplete, getVariantUrl, showIosToast]);

  const handleBadgeDownload = useCallback(async () => {
    if (!badgeSettings?.enabled || !bgRemovedCanvas) return;

    if (isIOS) {
      // Step-based download for iOS
      const targetSize = BADGE_SIZES[iosBadgeStep];
      if (targetSize === undefined) return;

      const canvas = renderBadge(bgRemovedCanvas, badgeSettings, targetSize);
      const dataUrl = canvas.toDataURL("image/png");
      window.open(dataUrl, "_blank");

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

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const size of BADGE_SIZES) {
      const canvas = renderBadge(bgRemovedCanvas, badgeSettings, size);
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];
      zip.file(`badge_${size}.png`, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "badge.zip";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    onDownloadComplete?.();
  }, [badgeSettings, bgRemovedCanvas, onDownloadComplete, showIosToast, iosBadgeStep]);

  const vLargest = variants.find((v) => v.size === largestSize);
  const formatLargest = vLargest?.animatedBlob ? "GIF" : "PNG";

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
