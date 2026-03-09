import { useCallback } from "react";
import { EmoteVariant, ExportMode, ProcessingStage } from "@/types/emote";

interface DownloadButtonProps {
  stage: ProcessingStage;
  onExport: () => void;
  variants: EmoteVariant[];
  exportMode?: ExportMode;
  onDownloadComplete?: () => void;
}

export default function DownloadButton({
  stage,
  onExport,
  variants,
  exportMode = "twitch",
  onDownloadComplete,
}: DownloadButtonProps) {
  const isReady = stage === "ready";
  const isExporting = stage === "exporting";

  const largestSize = exportMode === "discord" ? 128 : 112;

  const handleLargestDownload = useCallback(() => {
    const vLargest = variants.find((v) => v.size === largestSize);
    if (!vLargest) return;

    let url: string;
    let needsRevoke = false;

    if (vLargest.animatedBlob) {
      url = URL.createObjectURL(vLargest.animatedBlob);
      needsRevoke = true;
    } else {
      url = vLargest.staticDataUrl;
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
  }, [variants, largestSize, onDownloadComplete]);

  const vLargest = variants.find((v) => v.size === largestSize);
  const formatLargest = vLargest?.animatedBlob ? "GIF" : "PNG";

  return (
    <div className="flex flex-col gap-2">
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
        {largestSize}px {formatLargest} をダウンロード
      </button>

      {/* ZIP bulk download */}
      <button
        onClick={async () => { await onExport(); onDownloadComplete?.(); }}
        disabled={!isReady && !isExporting}
        className={`w-full py-2 px-4 min-h-[44px] md:min-h-0 rounded-lg text-sm transition-colors ${
          isReady
            ? "bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer border border-gray-600"
            : isExporting
            ? "bg-purple-800 text-purple-300 cursor-wait"
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
          "全サイズ一括DL（ZIP）"
        )}
      </button>
    </div>
  );
}
