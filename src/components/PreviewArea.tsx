"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BadgeSettings, EmoteVariant, ExportMode, ProcessingStage, TextPosition } from "@/types/emote";
import { BADGE_SIZES } from "@/types/emote";
import { renderBadge } from "@/lib/canvasPipeline";
import { checkVisibility, type VisibilityResult } from "@/lib/visibilityChecker";
import { PLATFORM_LABELS } from "@/lib/ui/export-plan";
import { primaryBtn, textBtn } from "@/components/ui/classes";

export type PreviewBg = "checker" | "dark" | "light";

interface PreviewAreaProps {
  variants: EmoteVariant[];
  stage: ProcessingStage;
  exportMode: ExportMode;
  /** Label shown on the stage: animation name / 「動きなし」 / GIF・動画. */
  selectionLabel: string;
  hasText?: boolean;
  textPosition?: TextPosition;
  badgeSettings?: BadgeSettings;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  /** Drag / wheel / pinch on the stage moves the subject (existing contentOffset). */
  onContentAdjust?: (dx: number, dy: number, ds: number) => void;
  /** 「位置を調整」 → step 2 (null when the source cannot be re-adjusted). */
  onGoAdjust?: (() => void) | null;
  /** 「保存へ進む」 (desktop; the phone uses the dock). */
  onGoExport: () => void;
}

const STAGE_SCALE = 2; // 拡大見本 = 2×（実寸ではない）

const BG_CLASS: Record<PreviewBg, string> = {
  checker: "checkerboard",
  dark: "bg-[#131317]",
  light: "bg-[#f4f2ee]",
};

function stageStatus(stage: ProcessingStage, hasVariants: boolean): { text: string; busy: boolean } {
  switch (stage) {
    case "removing-background":
      return { text: "背景を処理中", busy: true };
    case "brush-editing":
      return { text: "背景を仕上げ中", busy: true };
    case "processing":
    case "generating-preview":
      return { text: hasVariants ? "更新中" : "生成中", busy: true };
    case "exporting":
      return { text: "書き出し中", busy: true };
    case "ready":
      return { text: "プレビュー", busy: false };
    default:
      return { text: "待機中", busy: false };
  }
}

/**
 * 「できあがり」 panel (09 §プレビュー): one enlarged sample (never called
 * 実寸), the real sizes on a chat-like line, a display-only background switch,
 * pause / processing / updating states. Old output stays visible while a new
 * one is generated, but is labelled 更新中 and cannot be saved as the new one
 * (the save screen waits for `ready`).
 */
export default function PreviewArea({
  variants,
  stage,
  exportMode,
  selectionLabel,
  hasText = false,
  textPosition = "bottom",
  badgeSettings,
  bgRemovedCanvas,
  onContentAdjust,
  onGoAdjust,
  onGoExport,
}: PreviewAreaProps) {
  const [bg, setBg] = useState<PreviewBg>("checker");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [visibilityFor, setVisibilityFor] = useState<{ key: string; result: VisibilityResult } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReducedMotion(mq.matches);
      if (mq.matches) setPlaying(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Object URLs for animated outputs; the previous set is revoked when the
  // outputs change (cleanup runs before the next memo is used).
  const urls = useMemo(() => {
    const next: Record<number, string> = {};
    for (const v of variants) if (v.animatedBlob) next[v.size] = URL.createObjectURL(v.animatedBlob);
    return next;
  }, [variants]);
  useEffect(() => () => {
    for (const u of Object.values(urls)) URL.revokeObjectURL(u);
  }, [urls]);

  const sorted = useMemo(() => [...variants].sort((a, b) => b.size - a.size), [variants]);
  const largest = sorted[0] ?? null;
  const smallest = sorted[sorted.length - 1] ?? null;
  const animated = !!largest?.animatedBlob;
  const status = stageStatus(stage, variants.length > 0);

  // Legibility check on the smallest output (existing visibilityChecker).
  const visibilityKey = smallest && smallest.size <= 32 ? `${smallest.staticDataUrl.length}:${smallest.size}:${hasText}:${textPosition}` : null;
  const visibility = visibilityFor && visibilityFor.key === visibilityKey ? visibilityFor.result : null;
  useEffect(() => {
    if (!smallest || !visibilityKey) return;
    let cancelled = false;
    const img = new Image();
    const key = visibilityKey;
    img.onload = () => {
      if (cancelled) return;
      try {
        const c = document.createElement("canvas");
        c.width = smallest.size;
        c.height = smallest.size;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, smallest.size, smallest.size);
        setVisibilityFor({ key, result: checkVisibility(c, hasText, textPosition) });
        c.width = 0;
        c.height = 0;
      } catch {
        /* ignore */
      }
    };
    img.src = smallest.staticDataUrl;
    return () => {
      cancelled = true;
    };
  }, [smallest, hasText, textPosition, visibilityKey]);

  const srcFor = (v: EmoteVariant) => (playing && v.animatedBlob && urls[v.size] ? urls[v.size] : v.staticDataUrl);

  // ---- drag / wheel / pinch on the stage (moves the subject) ----
  const interactive = !!onContentAdjust && !!largest;
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const pinchStart = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const stageSize = largest ? largest.size * STAGE_SCALE : 224;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [interactive]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!interactive || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDragging(true);
    onContentAdjust?.((dx / stageSize) * 0.5, (dy / stageSize) * 0.5, 0);
    dragStart.current = { x: e.clientX, y: e.clientY };
  }, [interactive, onContentAdjust, stageSize]);
  const onMouseUp = useCallback(() => {
    dragStart.current = null;
    setTimeout(() => setDragging(false), 50);
  }, []);
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    onContentAdjust?.(0, 0, e.deltaY > 0 ? -0.05 : 0.05);
  }, [interactive, onContentAdjust]);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!interactive) return;
    if (e.touches.length === 1) dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    else if (e.touches.length === 2) pinchStart.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, [interactive]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!interactive) return;
    if (e.touches.length === 1 && dragStart.current && !pinchStart.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setDragging(true);
      onContentAdjust?.((dx / stageSize) * 0.5, (dy / stageSize) * 0.5, 0);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && pinchStart.current) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      onContentAdjust?.(0, 0, (d - pinchStart.current) * 0.005);
      pinchStart.current = d;
    }
  }, [interactive, onContentAdjust, stageSize]);
  const onTouchEnd = useCallback(() => {
    dragStart.current = null;
    pinchStart.current = null;
    setTimeout(() => setDragging(false), 50);
  }, []);

  return (
    <aside className="bg-studio-surface border border-studio-stroke rounded-studio p-3.5 md:p-5" aria-label="できあがり">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] md:text-[17px] font-bold">できあがり</h2>
        <span className={`flex items-center gap-1.5 text-[10px] ${status.busy ? "text-studio-warn" : "text-studio-good"}`} role="status" aria-live="polite">
          <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${status.busy ? "bg-studio-warn animate-pulse" : "bg-studio-good"}`} />
          {status.text}
        </span>
      </div>

      {/* main stage */}
      <div
        className={`relative grid place-items-center rounded-[12px] overflow-hidden aspect-[1.65] md:aspect-[1.13] min-h-[180px] md:min-h-[240px] ${BG_CLASS[bg]} ${
          interactive ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
        }`}
        style={{ touchAction: interactive ? "none" : "auto" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div aria-hidden className="absolute inset-[14%] border border-dashed border-[#b8b1c633] rounded-[8px] pointer-events-none" />
        {largest ? (
          <img
            key={largest.size}
            src={srcFor(largest)}
            alt={`${selectionLabel} の拡大見本（${largest.size}px を ${STAGE_SCALE} 倍表示）`}
            width={stageSize}
            height={stageSize}
            draggable={false}
            className="max-w-[72%] max-h-[80%] w-auto h-auto object-contain select-none pointer-events-none"
            style={{ width: stageSize, height: stageSize }}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[12px] text-studio-muted">
            <span className="inline-block w-5 h-5 border-2 border-[#8a8395] border-t-studio-text rounded-full animate-spin" aria-hidden />
            {status.busy ? `${status.text}…` : "プレビューはここに表示されます"}
          </div>
        )}
        {largest && status.busy && (
          <div className="absolute inset-0 bg-[#10111499] grid place-items-center pointer-events-none" aria-hidden>
            <span className="px-3 py-1.5 rounded-[7px] bg-[#17141ecf] text-[11px] text-studio-text">更新中…</span>
          </div>
        )}
        <span className="absolute bottom-2.5 left-2.5 md:bottom-3.5 md:left-3.5 px-2.5 py-1 rounded-[7px] text-[10px] bg-[#17141ecf] text-[#ece3f7]">
          {selectionLabel}
          {largest && <span className="opacity-70"> · 拡大見本 {STAGE_SCALE}×</span>}
        </span>
        {animated && (
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={!playing}
            aria-label={playing ? "プレビューを一時停止" : "プレビューを再生"}
            className="absolute right-2.5 bottom-2.5 md:right-3.5 md:bottom-3.5 w-9 h-9 md:w-[34px] md:h-[34px] rounded-full bg-[#17141ed9] text-[#eee7f6] text-[13px] grid place-items-center"
          >
            {playing ? "❚❚" : "▶"}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5">
        <div className="flex gap-2 p-1" role="group" aria-label="プレビューの背景">
          {(["checker", "dark", "light"] as PreviewBg[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setBg(m)}
              aria-pressed={bg === m}
              aria-label={m === "checker" ? "透過背景" : m === "dark" ? "暗い背景" : "明るい背景"}
              className={`w-[26px] h-[26px] md:w-[23px] md:h-[23px] rounded-full border-2 border-[#555361] ${
                m === "checker" ? "checkerboard-fine" : m === "dark" ? "bg-[#101014]" : "bg-[#f5f0e8]"
              } ${bg === m ? "outline outline-2 outline-offset-[3px] outline-studio-accent" : ""}`}
            />
          ))}
        </div>
        {onGoAdjust && (
          <button type="button" onClick={onGoAdjust} className={textBtn}>
            位置を調整 ↗
          </button>
        )}
      </div>
      {interactive && (
        <p className="text-[10px] text-studio-muted mt-1">
          <span className="hidden md:inline">見本をドラッグで移動、スクロールで大きさを変更できます。</span>
          <span className="md:hidden">見本をドラッグで移動、ピンチで大きさを変更できます。</span>
        </p>
      )}

      {/* real sizes on a chat-like line */}
      <div className="mt-4 p-3 rounded-[10px] bg-[#111215] border border-[#2f2e38]">
        <div className="flex justify-between text-[10px] text-studio-muted mb-2">
          <span>実寸で見ると（{PLATFORM_LABELS[exportMode]}）</span>
          <span>{sorted.map((v) => `${v.size}px`).join(" / ")}</span>
        </div>
        <div className={`flex items-end gap-3 px-2 py-2 rounded-[8px] ${bg === "checker" ? "" : BG_CLASS[bg]}`}>
          {sorted.map((v) => (
            <img key={v.size} src={srcFor(v)} alt={`${v.size}px の実寸`} width={v.size} height={v.size} style={{ width: v.size, height: v.size, imageRendering: v.size <= 28 ? "pixelated" : "auto" }} draggable={false} />
          ))}
        </div>
        {smallest && (
          <div className="flex items-center gap-2 mt-2 text-[12px] min-h-[31px]">
            <span className="font-semibold text-[#c4a4ee]">viewer_01</span>
            <span>ないす！</span>
            <img src={srcFor(smallest)} alt={`${smallest.size}px の実寸`} width={smallest.size} height={smallest.size} style={{ width: smallest.size, height: smallest.size }} draggable={false} />
            <span className="text-[#c1aeed] text-[17px]" aria-hidden>♡</span>
          </div>
        )}
        {visibility && !visibility.ok && (
          <p className="mt-1.5 text-[11px] text-studio-warn">{visibility.message}</p>
        )}
      </div>

      {badgeSettings?.enabled && bgRemovedCanvas && <BadgePreview bgRemovedCanvas={bgRemovedCanvas} badgeSettings={badgeSettings} />}

      <p className="hidden md:flex items-center gap-2 text-[10px] text-studio-muted my-4">
        <span aria-hidden>◎</span>
        背景色は見え方の確認用です。保存する画像の背景には付きません。
      </p>
      {reducedMotion && (
        <p className="text-[10px] text-studio-muted mt-2">OS の「視差効果を減らす」設定に従い、自動再生を止めています。▶ で再生できます。</p>
      )}
      <button type="button" onClick={onGoExport} className={`${primaryBtn} w-full hidden md:flex mt-2`}>
        保存へ進む <span className="ml-auto" aria-hidden>→</span>
      </button>
    </aside>
  );
}

function BadgePreview({ bgRemovedCanvas, badgeSettings }: { bgRemovedCanvas: HTMLCanvasElement; badgeSettings: BadgeSettings }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  useEffect(() => {
    BADGE_SIZES.forEach((size, i) => {
      const target = refs.current[i];
      if (!target) return;
      const result = renderBadge(bgRemovedCanvas, badgeSettings, size);
      target.width = size;
      target.height = size;
      const ctx = target.getContext("2d")!;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(result, 0, 0);
    });
  }, [bgRemovedCanvas, badgeSettings]);
  return (
    <div className="mt-4 p-3 rounded-[10px] bg-[#111215] border border-[#2f2e38]">
      <p className="text-[10px] text-studio-muted mb-2">バッジ（実寸 72 / 36 / 18px）— 保存画面で「バッジ」を選ぶと保存できます</p>
      <div className="flex items-end gap-4">
        {BADGE_SIZES.map((size, i) => (
          <canvas key={size} ref={(el) => { refs.current[i] = el; }} width={size} height={size} style={{ width: size, height: size }} aria-label={`${size}px バッジ`} />
        ))}
      </div>
    </div>
  );
}
