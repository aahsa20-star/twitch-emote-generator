"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeVideo, type DecodedVideo } from "@/lib/video/decoder";

const MAX_TRIM_MS = 4000;
const FPS_OPTIONS = [10, 15, 20] as const;
type Fps = (typeof FPS_OPTIONS)[number];

interface VideoTrimmerProps {
  file: File;
  onConfirm: (decoded: DecodedVideo) => void;
  onCancel: () => void;
}

export default function VideoTrimmer({ file, onConfirm, onCancel }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState<string>("");
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(MAX_TRIM_MS);
  const [fps, setFps] = useState<Fps>(15);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // (Re)load file as object URL.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    setDurationMs(0);
    setStartMs(0);
    setEndMs(MAX_TRIM_MS);
    setError(null);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Abort any in-flight extraction on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleMetadata = useCallback(() => {
    if (!videoRef.current) return;
    const dms = videoRef.current.duration * 1000;
    if (!Number.isFinite(dms) || dms <= 0) {
      setError("動画の長さを取得できませんでした");
      return;
    }
    setDurationMs(dms);
    setStartMs(0);
    setEndMs(Math.min(dms, MAX_TRIM_MS));
  }, []);

  // Seek the preview to the slider being dragged so users see the boundary.
  const seekPreview = useCallback((toMs: number) => {
    if (videoRef.current && videoRef.current.readyState >= 1) {
      videoRef.current.currentTime = toMs / 1000;
    }
  }, []);

  const handleStartChange = (raw: number) => {
    const s = Math.max(0, Math.min(raw, durationMs));
    let e = endMs;
    if (e - s > MAX_TRIM_MS) e = s + MAX_TRIM_MS;
    if (e <= s) e = Math.min(durationMs, s + 100);
    setStartMs(s);
    setEndMs(e);
    seekPreview(s);
  };

  const handleEndChange = (raw: number) => {
    const e = Math.max(startMs + 100, Math.min(raw, durationMs));
    let s = startMs;
    if (e - s > MAX_TRIM_MS) s = e - MAX_TRIM_MS;
    setStartMs(s);
    setEndMs(e);
    seekPreview(e);
  };

  const trimRangeMs = endMs - startMs;
  const frameCount = Math.max(1, Math.round((trimRangeMs / 1000) * fps));

  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setError(null);
    setProgress({ current: 0, total: frameCount });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const decoded = await decodeVideo(file, {
        startMs,
        endMs,
        fps,
        signal: controller.signal,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      onConfirm(decoded);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "フレーム抽出に失敗しました");
      setIsExtracting(false);
    }
  }, [file, startMs, endMs, fps, frameCount, onConfirm]);

  const handleCancelClick = useCallback(() => {
    abortRef.current?.abort();
    onCancel();
  }, [onCancel]);

  const formatTime = (ms: number) => `${(ms / 1000).toFixed(2)}秒`;
  const trimRangeOver = trimRangeMs > MAX_TRIM_MS + 1;

  return (
    <div className="bg-purple-900/20 border border-purple-500/40 rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-purple-200">動画をトリミング</h3>
        <button
          onClick={handleCancelClick}
          disabled={isExtracting}
          className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>

      {url && (
        <video
          ref={videoRef}
          src={url}
          playsInline
          muted
          controls
          preload="auto"
          onLoadedMetadata={handleMetadata}
          className="w-full max-h-64 rounded bg-black"
        />
      )}

      {durationMs > 0 ? (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span>開始: <span className="font-mono">{formatTime(startMs)}</span></span>
              <span>終了: <span className="font-mono">{formatTime(endMs)}</span></span>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">開始位置</label>
              <input
                type="range"
                min={0}
                max={durationMs}
                step={50}
                value={startMs}
                disabled={isExtracting}
                onChange={(e) => handleStartChange(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 block mb-0.5">終了位置</label>
              <input
                type="range"
                min={0}
                max={durationMs}
                step={50}
                value={endMs}
                disabled={isExtracting}
                onChange={(e) => handleEndChange(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <p className={`text-xs text-center ${trimRangeOver ? "text-red-400" : "text-gray-400"}`}>
              範囲: {formatTime(trimRangeMs)} （最大4秒、自動でクランプされます）
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-300 block">フレームレート</label>
            <div className="flex gap-2">
              {FPS_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFps(f)}
                  disabled={isExtracting}
                  className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors border ${
                    fps === f
                      ? "border-purple-500 bg-purple-600/30 text-purple-200"
                      : "border-gray-600 text-gray-400 hover:text-gray-200"
                  } disabled:opacity-50`}
                >
                  {f}fps
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              出力フレーム数: 約{frameCount}フレーム
            </p>
          </div>

          {isExtracting ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-purple-300">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                フレーム抽出中... {progress.current}/{progress.total}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "0%" }}
                />
              </div>
              <p className="text-[11px] text-gray-500">
                seekに数秒かかる場合があります。iOSでは特に時間がかかることがあります
              </p>
            </div>
          ) : (
            <button
              onClick={handleExtract}
              disabled={frameCount < 1}
              className="w-full py-2.5 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm disabled:bg-gray-700 disabled:text-gray-500 transition-colors"
            >
              フレームを抽出してエモートを生成
            </button>
          )}

          {error && (
            <div className="text-xs px-3 py-2 rounded bg-red-900/40 text-red-300">
              {error}
            </div>
          )}
        </>
      ) : (
        !error && (
          <p className="text-xs text-gray-500 text-center py-2">動画を読み込み中...</p>
        )
      )}
    </div>
  );
}
