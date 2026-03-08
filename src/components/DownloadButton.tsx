import { ProcessingStage } from "@/types/emote";

interface DownloadButtonProps {
  stage: ProcessingStage;
  onExport: () => void;
}

export default function DownloadButton({
  stage,
  onExport,
}: DownloadButtonProps) {
  const isReady = stage === "ready";
  const isExporting = stage === "exporting";

  return (
    <button
      onClick={onExport}
      disabled={!isReady && !isExporting}
      className={`w-full py-3 px-6 rounded-lg font-semibold text-sm transition-colors ${
        isReady
          ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer"
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
        "全バリエーション一括DL（ZIP）"
      )}
    </button>
  );
}
