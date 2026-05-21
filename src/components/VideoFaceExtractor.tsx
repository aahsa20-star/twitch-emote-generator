"use client";

import { useCallback, useRef, useState } from "react";
import {
  extractFacesFromVideo,
  canvasToFile,
  FaceCandidate,
  isLowMemoryEnvironment,
} from "@/lib/faceExtractor";

const LOW_MEM_WARN_SIZE = 30 * 1024 * 1024; // 30MB

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface VideoFaceExtractorProps {
  onFaceSelected: (file: File) => void;
}

export default function VideoFaceExtractor({ onFaceSelected }: VideoFaceExtractorProps) {
  const [stage, setStage] = useState<"idle" | "processing" | "selecting">("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [candidates, setCandidates] = useState<FaceCandidate[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // fix12 Stage 4: 処理中キャンセル用の AbortController
  const abortRef = useRef<AbortController | null>(null);

  const handleVideoFile = useCallback(async (file: File) => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      setError("MP4, MOV, WEBM形式の動画を選択してください");
      return;
    }

    // fix13 Stage 3: 低メモリ環境で大きい動画はメモリ不足の可能性を事前警告
    // （上限 50MB は維持。続行するかはユーザーに委ねる）
    if (file.size > LOW_MEM_WARN_SIZE && isLowMemoryEnvironment()) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      const proceed = window.confirm(
        `お使いの環境ではメモリ不足でページが落ちる可能性があります（動画 ${sizeMB}MB）。\n` +
          "軽量モードで処理を試みますが、より小さい・短い動画のほうが安定します。\n\n" +
          "このまま続行しますか？",
      );
      if (!proceed) return;
    }

    setError(null);
    setStage("processing");
    setProgress(0);
    setCandidates([]);
    setSelectedIdx(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const results = await extractFacesFromVideo(
        file,
        (pct, label) => {
          setProgress(pct);
          setProgressLabel(label);
        },
        controller.signal
      );

      if (results.length === 0) {
        setError("顔を検出できませんでした。別の動画をお試しください");
        setStage("idle");
        return;
      }

      setCandidates(results);
      setSelectedIdx(0);
      setStage("selecting");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      // ユーザーキャンセルは静かに idle に戻すだけ（エラー表示しない）
      if (raw === "FACE_EXTRACT_ABORTED") {
        setStage("idle");
        return;
      }
      let msg: string;
      if (raw === "FACE_DETECTOR_INIT_FAILED") {
        // fix12 Stage 2: GPU/CPU 両 delegate 初期化失敗 = 環境非対応
        msg =
          "お使いの環境（ブラウザ／PC）では動画顔抽出をご利用いただけませんでした。" +
          "ブラウザのハードウェアアクセラレーションを有効にするか、Chrome などの別ブラウザでお試しください。" +
          "（画像アップロードでのエモート作成は引き続きご利用いただけます）";
      } else if (raw === "MOBILE_PLAYBACK_FAILED" || raw === "MOBILE_NO_RESULTS") {
        msg = "動画の読み込みに失敗しました。スマートフォンでは端末の性能によって処理できない場合があります。PCのブラウザからお試しください。";
      } else if (raw) {
        msg = raw;
      } else {
        msg = "動画の読み込みに失敗しました。スマートフォンでは端末の性能によって処理できない場合があります。PCのブラウザからお試しください。";
      }
      setError(msg);
      setStage("idle");
    } finally {
      abortRef.current = null;
    }
  }, []);

  // fix12 Stage 4: 処理中のキャンセル
  const handleAbortProcessing = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStage("idle");
    setProgress(0);
    setProgressLabel("");
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

  return (
    <div className="block">
      <div className="bg-gray-800/60 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-300 font-medium">動画から顔を抽出</span>
          {stage === "selecting" && (
            <button
              onClick={handleCancel}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors min-h-[44px] md:min-h-0 px-2 flex items-center"
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
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] md:min-h-0 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-xs transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              動画をアップロード
            </button>
            <p className="text-xs text-gray-500">MP4 / MOV / WEBM 30秒以内 50MB以下</p>
            <p className="text-xs text-yellow-500/80 md:hidden">※PCでの利用を推奨（スマートフォンでは著しく精度・速度が低下します）</p>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleChange}
            />
          </>
        )}

        {/* Processing: progress bar + cancel */}
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">{Math.round(progress * 100)}%</p>
              {/* fix12 Stage 4: 処理が重い環境でも逃げ道を用意 */}
              <button
                onClick={handleAbortProcessing}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors min-h-[44px] md:min-h-0 px-2 flex items-center"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {/* Selecting: candidate grid */}
        {stage === "selecting" && candidates.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">{candidates.length}件の顔を検出 - 使いたい画像を選択</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
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
              className="w-full px-3 py-2 min-h-[44px] md:min-h-0 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs transition-colors"
            >
              この画像でエモートを作る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
