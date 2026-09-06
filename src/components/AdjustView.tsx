"use client";

import { useState } from "react";
import ImageAdjustEditor, { type AdjustState } from "./ImageAdjustEditor";
import VideoTrimmer from "./VideoTrimmer";
import type { DecodedVideo } from "@/lib/video/decoder";
import type { BgRemovalQuality } from "@/types/emote";

export type BackgroundChoice = "keep" | "remove";

export interface AdjustDecision {
  file: File;
  state: AdjustState | null;
  background: BackgroundChoice;
  quality: BgRemovalQuality;
}

interface AdjustViewProps {
  /** The raw uploaded image (never the already-cropped result). */
  originalFile: File | null;
  /** A video waiting for trim / frame extraction. */
  videoFile: File | null;
  /** Last confirmed crop (re-entry) — null the first time. */
  adjustState: AdjustState | null;
  background: BackgroundChoice;
  quality: BgRemovalQuality;
  /** True when coming back from the editor (labels change). */
  revisit: boolean;
  onConfirm: (d: AdjustDecision) => void;
  /** 「調整せず使う」: original file, no crop. */
  onUseUnadjusted: (background: BackgroundChoice, quality: BgRemovalQuality) => void;
  /** 「変更せず戻る」 (revisit only). */
  onCancel: () => void;
  onVideoConfirm: (decoded: DecodedVideo) => void;
  onVideoCancel: () => void;
}

/**
 * Step 2 「画像を整える」 (09 §2): crop / zoom / position and the background
 * decision on one screen. Everything is a draft until the primary action.
 */
export default function AdjustView(props: AdjustViewProps) {
  const { originalFile, videoFile, adjustState, revisit } = props;
  const [background, setBackground] = useState<BackgroundChoice>(props.background);
  const [quality, setQuality] = useState<BgRemovalQuality>(props.quality);

  return (
    <section aria-labelledby="adjust-title">
      <div className="mb-4 md:mb-6">
        <p className="text-[10px] tracking-[.15em] font-semibold text-studio-accent mb-2">02 / PREPARE</p>
        <h1 id="adjust-title" className="text-[23px] md:text-[27px] font-bold leading-tight">
          {videoFile ? "使いたい場面を、切り出す。" : "使いたい部分を、真ん中に。"}
        </h1>
        <p className="text-[12px] md:text-[13px] text-studio-muted mt-2">
          {videoFile ? "範囲と枚数を決めると、動画の動きがそのままエモートになります。" : revisit ? "変更は「変更を適用」を押したときだけ反映されます。" : "今の範囲でよければ、そのまま次へ進めます。"}
        </p>
      </div>

      {videoFile ? (
        <div className="max-w-[720px] mx-auto bg-studio-surface border border-studio-stroke rounded-studio p-4 md:p-6">
          <VideoTrimmer file={videoFile} onConfirm={props.onVideoConfirm} onCancel={props.onVideoCancel} />
        </div>
      ) : originalFile ? (
        <ImageAdjustEditor
          file={originalFile}
          initialState={adjustState}
          confirmLabel={revisit ? "変更を適用" : "この範囲で使う"}
          secondaryLabel={revisit ? "変更せず戻る" : "調整せず使う"}
          onConfirm={(file, state) => props.onConfirm({ file, state, background, quality })}
          onSecondary={() => (revisit ? props.onCancel() : props.onUseUnadjusted(background, quality))}
        >
          <div className="border-t border-[#403546] mt-5 pt-5">
            <h3 className="text-[14px] font-bold mb-2.5">背景の扱い</h3>
            <BackgroundRadio
              value="keep"
              current={background}
              onChange={setBackground}
              title="そのまま使う"
              desc="透過済みのイラスト・VTuber 素材など"
            />
            <BackgroundRadio
              value="remove"
              current={background}
              onChange={setBackground}
              title="背景を自動で消す"
              desc="写真・背景つきの画像。ブラウザ内の AI で処理します（初回は約 30MB のモデル読み込み）"
            />
            {background === "remove" && (
              <div className="flex gap-2 mt-1 pl-1" role="group" aria-label="透過の精度">
                {([
                  { value: "speed", label: "標準", desc: "速い" },
                  { value: "quality", label: "高精度", desc: "イラスト・細い髪向け" },
                ] as { value: BgRemovalQuality; label: string; desc: string }[]).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setQuality(o.value)}
                    aria-pressed={quality === o.value}
                    className={`flex-1 min-h-[44px] px-3 py-2 rounded-[9px] text-[12px] border transition-colors ${
                      quality === o.value ? "border-studio-accent bg-[#352b45] text-studio-text" : "border-[#48404f] text-studio-muted hover:text-studio-text"
                    }`}
                  >
                    <span className="block font-semibold">{o.label}</span>
                    <span className="block text-[10px] opacity-80">{o.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ImageAdjustEditor>
      ) : (
        <p className="text-[13px] text-studio-muted text-center py-10">先に画像を選んでください。</p>
      )}
    </section>
  );
}

function BackgroundRadio({
  value,
  current,
  onChange,
  title,
  desc,
}: {
  value: BackgroundChoice;
  current: BackgroundChoice;
  onChange: (v: BackgroundChoice) => void;
  title: string;
  desc: string;
}) {
  const on = value === current;
  return (
    <label className={`flex items-center gap-3 p-2.5 mb-2.5 rounded-[9px] border cursor-pointer ${on ? "border-studio-accent bg-[#2b2437]" : "border-[#48404f]"}`}>
      <input type="radio" name="background" value={value} checked={on} onChange={() => onChange(value)} className="w-5 h-5 accent-[#c8b5ff]" />
      <span className="flex-1 text-[12px]">
        {title}
        <small className="block text-[10px] text-studio-muted leading-snug">{desc}</small>
      </span>
    </label>
  );
}
