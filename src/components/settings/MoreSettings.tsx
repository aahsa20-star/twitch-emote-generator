"use client";

import { useState, type ReactNode } from "react";
import {
  EmoteConfig,
  PartialEmoteConfig,
  ANIMATED_SPEED_PRESETS,
  ANIMATED_SPEED_MIN,
  ANIMATED_SPEED_MAX,
  ANIMATED_SPEED_STEP,
  ANIMATED_LOOP_OPTIONS,
} from "@/types/emote";
import SubImageSettings from "./SubImageSettings";
import BadgeSettings from "./BadgeSettings";
import RecommendedPatterns from "../RecommendedPatterns";
import type { DownloadGate } from "@/lib/download/profiles";
import { secondaryBtn, segmented, segmentedBtn, segmentedBtnActive } from "@/components/ui/classes";

interface MoreSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isPremium: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  isAnimatedSource: boolean;
  /** Re-open step 2 (null when not applicable, e.g. GIF / video). */
  onGoAdjust: (() => void) | null;
  onRetryBgRemoval: () => void;
  onUseOriginal: () => void;
  onResetPosition: () => void;
  hasPositionAdjustment: boolean;
  canRedoBackground: boolean;
  onBeforeDownload?: DownloadGate;
}

type Row = "composite" | "badge" | "adjust" | "patterns";

function FeatureRow({ id, icon, title, desc, locked, open, onToggle, onLock, children }: {
  id: Row;
  icon: string;
  title: string;
  desc: string;
  locked?: boolean;
  open: Row | null;
  onToggle: (row: Row) => void;
  onLock?: (label: string) => void;
  children?: ReactNode;
}) {
  const expanded = !locked && open === id;
  return (
    <div className="border-b border-studio-stroke">
      <button
        type="button"
        onClick={() => (locked ? onLock?.(title) : onToggle(id))}
        aria-expanded={expanded}
        aria-disabled={locked || undefined}
        className="w-full flex items-center gap-3 py-4 text-left"
      >
        <span aria-hidden className="w-[45px] h-[45px] rounded-[10px] bg-[#302739] text-studio-accent text-[22px] grid place-items-center">{icon}</span>
        <span className="flex-1 min-w-0">
          <b className="block text-[13px]">{locked ? "🔒 " : ""}{title}</b>
          <small className="block text-[11px] text-studio-muted mt-0.5">{locked ? "フォローまたは合言葉で使えます" : desc}</small>
        </span>
        <span aria-hidden className="text-[22px] text-studio-muted">{expanded ? "▾" : "›"}</span>
      </button>
      {expanded && <div className="pb-5 pl-0 md:pl-[57px]">{children}</div>}
    </div>
  );
}

/**
 * 「その他」 tab (09 §3): the existing features that are not part of the first
 * pass, each behind a row that expands its own panel. Nothing is removed.
 */
export default function MoreSettings(p: MoreSettingsProps) {
  const [open, setOpen] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpen((o) => (o === row ? null : row));

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-[15px] md:text-[17px] font-bold">もう少し、こだわる。</h2>
        <p className="text-[11px] md:text-[12px] text-studio-muted mt-1">基本の編集に慣れてきたら。機能自体は減らしていません。</p>
      </div>

      <FeatureRow id="composite" icon="▧" title="画像を重ねる" desc="もう1枚の画像を組み合わせる" locked={!p.isPremium} open={open} onToggle={toggle} onLock={p.onTrialLockClick}>
        <SubImageSettings config={p.config} onConfigChange={p.onConfigChange} subFile={p.subFile} onSubImageSelected={p.onSubImageSelected} />
      </FeatureRow>

      <FeatureRow id="badge" icon="♢" title="バッジを作る" desc="サブスクバッジ用の形とサイズに" locked={!p.isPremium} open={open} onToggle={toggle} onLock={p.onTrialLockClick}>
        <BadgeSettings config={p.config} onConfigChange={p.onConfigChange} />
        <p className="text-[11px] text-studio-muted mt-2">保存画面で「バッジ」を選ぶと 72 / 36 / 18px の PNG で保存できます。エモートの設定はそのまま残ります。</p>
      </FeatureRow>

      <FeatureRow id="adjust" icon="⌗" title="画像の位置・背景" desc="大きさや切り取り、背景の処理をやり直す" open={open} onToggle={toggle}>
        <div className="flex flex-wrap gap-2">
          {p.onGoAdjust && (
            <button type="button" onClick={p.onGoAdjust} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>位置・範囲・背景を調整する</button>
          )}
          {p.canRedoBackground && (
            <>
              <button type="button" onClick={p.onRetryBgRemoval} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>もう一度背景を消す</button>
              <button type="button" onClick={p.onUseOriginal} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>元画像をそのまま使う</button>
            </>
          )}
          <button type="button" onClick={p.onResetPosition} disabled={!p.hasPositionAdjustment} className={`${secondaryBtn} min-h-[40px] text-[12px]`}>見本の位置をリセット</button>
        </div>
        {!p.hasPositionAdjustment && <p className="text-[11px] text-studio-muted mt-2">「できあがり」の見本をドラッグすると位置を微調整できます。</p>}
      </FeatureRow>

      {p.bgRemovedCanvas && !p.isAnimatedSource && (
        <FeatureRow id="patterns" icon="✦" title="おすすめの仕上がりから選ぶ" desc="フチや動きの組み合わせを 4 パターン生成して適用" open={open} onToggle={toggle}>
          <RecommendedPatterns bgRemovedCanvas={p.bgRemovedCanvas} onApply={(cfg) => p.onConfigChange(cfg)} onBeforeDownload={p.onBeforeDownload} />
        </FeatureRow>
      )}
    </div>
  );
}

/** 「再生」 tab for GIF / video sources: speed and loop count of the source animation. */
export function PlaybackSettings(props: { config: EmoteConfig; onConfigChange: (partial: PartialEmoteConfig) => void }) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[15px] md:text-[17px] font-bold">動きは、そのままに。</h2>
        <p className="text-[11px] md:text-[12px] text-studio-muted mt-1">GIF・動画の動きをそのまま使います。速さとループ回数だけ調整できます。</p>
      </div>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-studio-muted flex justify-between">
                <span>速さ</span>
                <span className="font-mono text-studio-text">{props.config.animatedSpeed.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min={ANIMATED_SPEED_MIN}
                max={ANIMATED_SPEED_MAX}
                step={ANIMATED_SPEED_STEP}
                value={props.config.animatedSpeed}
                onChange={(e) => props.onConfigChange({ animatedSpeed: Number(e.target.value) } as PartialEmoteConfig)}
                className="w-full"
              />
              <div className={`${segmented} mt-2 w-full`}>
                {ANIMATED_SPEED_PRESETS.map((s) => (
                  <button key={s} type="button" onClick={() => props.onConfigChange({ animatedSpeed: s } as PartialEmoteConfig)} aria-pressed={Math.abs(props.config.animatedSpeed - s) < 0.001} className={`${segmentedBtn} flex-1 ${Math.abs(props.config.animatedSpeed - s) < 0.001 ? segmentedBtnActive : ""}`}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-studio-muted block mb-1">ループ回数</span>
              <div className={`${segmented} w-full`}>
                {ANIMATED_LOOP_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => props.onConfigChange({ animatedLoopCount: opt.value } as PartialEmoteConfig)} aria-pressed={props.config.animatedLoopCount === opt.value} className={`${segmentedBtn} flex-1 ${props.config.animatedLoopCount === opt.value ? segmentedBtnActive : ""}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-studio-muted mt-1">Twitch エモートとして使う場合は無限ループがおすすめです。</p>
            </div>
          </div>
    </div>
  );
}
