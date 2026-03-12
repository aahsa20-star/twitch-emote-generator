"use client";

import { useCallback, useRef, useState } from "react";
import { extractFacesFromVideo, canvasToFile, FaceCandidate } from "@/lib/faceExtractor";

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface VideoFaceExtractorProps {
  isSubscriber: boolean;
  onFaceSelected: (file: File) => void;
}

export default function VideoFaceExtractor({ isSubscriber, onFaceSelected }: VideoFaceExtractorProps) {
  const [stage, setStage] = useState<"idle" | "processing" | "selecting">("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [candidates, setCandidates] = useState<FaceCandidate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVideoFile = useCallback(async (file: File) => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError("MP4, MOV, WEBM形式の動画を選択してください");
      return;
    }

    setError(null);
    setStage("processing");
    setProgress(0);
    setCandidates([]);
    setSelectedIdx(null);

    try {
      const results = await extractFacesFromVideo(file, (pct, label) => {
        setProgress(pct);
        setProgressLabel(label);
      });

      if (results.length === 0) {
        setError("顔を検出できませんでした。別の動画をお試しください");
        setStage("idle");
        return;
      }

      setCandidates(results);
      setSelectedIdx(0);
      setStage("selecting");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "処理中にエラーが発生しました";
      setError(msg);
      setStage("idle");
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoFile(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  }, [handleVideoFile]);

  const handleConfirm = useCallback(async () => {
    if (selectedIdx === null || !candidates[selectedIdx]) return;
    const file = await canvasToFile(candidates[selectedIdx].croppedCanvas);
    // Cleanup all canvases
    for (const c of candidates) {
      c.croppedCanvas.width = 0;
      c.croppedCanvas.height = 0;
      c.frameCanvas.width = 0;
      c.frameCanvas.height = 0;
    }
    setCandidates([]);
    setStage("idle");
    onFaceSelected(file);
  }, [selectedIdx, candidates, onFaceSelected]);

  const handleCancel = useCallback(() => {
    for (const c of candidates) {
      c.croppedCanvas.width = 0;
      c.croppedCanvas.height = 0;
      c.frameCanvas.width = 0;
      c.frameCanvas.height = 0;
    }
    setCandidates([]);
    setStage("idle");
    setSelectedIdx(null);
  }, [candidates]);

  // Not subscriber: show locked state
  if (!isSubscriber) {
    return (
      <div className="hidden md:block">
        <div className="bg-gray-800/40 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-xs text-gray-500">動画から顔を抽出 [限定]</span>
          </div>
          <a
            href="https://discord.gg/CheMXWdj"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-purple-400 hover:underline block"
          >
            サブスク限定チャットで合言葉を入手
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden md:block">
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300 font-medium">動画から顔を抽出 [限定]</span>
          {stage === "selecting" && (
            <button
              onClick={handleCancel}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              キャンセル
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-900/30 rounded px-2 py-1">{error}</p>
        )}

        {/* Idle: upload button */}
        {stage === "idle" && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-xs transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              動画をアップロード
            </button>
            <p className="text-[10px] text-gray-500">MP4 / MOV / WEBM 30秒以内 50MB以下</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleChange}
            />
          </>
        )}

        {/* Processing: progress bar */}
        {stage === "processing" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
              <span className="text-xs text-gray-400">{progressLabel}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 text-right">{Math.round(progress * 100)}%</p>
          </div>
        )}

        {/* Selecting: candidate grid */}
        {stage === "selecting" && candidates.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] text-gray-400">{candidates.length}件の顔を検出 - 使いたい画像を選択</p>
            <div className="grid grid-cols-4 gap-1.5">
              {candidates.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
                  className={`relative rounded overflow-hidden aspect-square border-2 transition-colors ${
                    selectedIdx === i
                      ? "border-purple-500"
                      : "border-transparent hover:border-gray-500"
                  }`}
                >
                  <canvas
                    ref={(el) => {
                      if (!el) return;
                      el.width = 80;
                      el.height = 80;
                      const ctx = el.getContext("2d");
                      if (ctx) ctx.drawImage(c.croppedCanvas, 0, 0, 80, 80);
                    }}
                    className="w-full h-full"
                  />
                  <span className="absolute bottom-0 right-0 text-[8px] bg-black/60 text-gray-300 px-1">
                    {Math.round(c.score * 100)}%
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={handleConfirm}
              disabled={selectedIdx === null}
              className="w-full px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs transition-colors"
            >
              この画像でエモートを作る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
