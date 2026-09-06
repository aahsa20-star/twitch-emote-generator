"use client";

import { useId } from "react";
import { EmoteConfig, PartialEmoteConfig, TextConfig, TEXT_PRESETS, FONT_OPTIONS, FontCategory } from "@/types/emote";
import ColorPicker from "./ColorPicker";
import DragPositionCanvas from "../DragPositionCanvas";
import { chipBtn, chipBtnActive, fieldLabel, inputCls, segmented, segmentedBtn, segmentedBtnActive } from "@/components/ui/classes";

interface TextSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  /** fix7: trial 版では fillColor / strokeColor 変更を locked にする */
  isPremium?: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
}

const POSITIONS = [
  { label: "上", offsetY: -40 },
  { label: "中央", offsetY: 0 },
  { label: "下", offsetY: 40 },
] as const;

/**
 * 「文字」 tab (09 §3): input, short presets, position and colour first; font,
 * text outline, size and free placement under 詳細設定.
 */
export default function TextSettings({ config, onConfigChange, isPremium = false, onTrialLockClick, bgRemovedCanvas, subCanvas }: TextSettingsProps) {
  const captionId = useId();
  const fontId = useId();
  const updateText = (partial: Partial<TextConfig>) => onConfigChange({ text: { ...config.text, ...partial } });
  const hasText = !!(config.text.customText.trim() || config.text.preset);
  const activePreset = config.text.customText ? null : config.text.preset;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[15px] md:text-[17px] font-bold">ひと言で、もっと伝わる。</h2>
        <p className="text-[11px] md:text-[12px] text-studio-muted mt-1">文字は入力するとすぐプレビューに反映。</p>
      </div>

      <label className={fieldLabel} htmlFor={captionId}>入れたい文字</label>
      <input
        id={captionId}
        type="text"
        maxLength={24}
        placeholder="例：GG、ないす、草"
        value={config.text.customText}
        onChange={(e) => {
          const val = e.target.value;
          updateText({ customText: val, preset: val ? null : config.text.preset });
        }}
        className={`${inputCls} min-h-[48px] text-[14px]`}
      />
      <div className="flex flex-wrap gap-2 mt-3">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={activePreset === preset.id}
            onClick={() => updateText({ preset: activePreset === preset.id ? null : preset.id, customText: "" })}
            className={`${chipBtn} ${activePreset === preset.id ? chipBtnActive : ""}`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={!hasText}
          onClick={() => updateText({ preset: null, customText: "" })}
          className={`${chipBtn} ${!hasText ? chipBtnActive : ""}`}
        >
          文字なし
        </button>
      </div>

      <span className={`${fieldLabel} mt-6`} id="text-pos-label">文字の位置</span>
      <div className={`${segmented} w-full`} role="group" aria-labelledby="text-pos-label">
        {POSITIONS.map((opt) => {
          const on = config.text.offsetY === opt.offsetY && config.text.offsetX === 0;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => updateText({ offsetX: 0, offsetY: opt.offsetY })}
              aria-pressed={on}
              className={`${segmentedBtn} flex-1 min-h-[40px] ${on ? segmentedBtnActive : ""}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <span className={`${fieldLabel} mt-6`}>文字の色</span>
      {isPremium ? (
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-studio-muted">
          <ColorPicker label="文字色" value={config.text.fillColor} onChange={(c) => updateText({ fillColor: c })} />
          <span>フチ付きで、小さくても読みやすく</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onTrialLockClick?.("文字色のカスタマイズ")}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-studio-muted bg-[#1f1e26] border border-studio-stroke rounded-[10px] text-left"
        >
          <span aria-hidden>🔒</span>
          <span>文字色・縁取り色のカスタマイズはフォロー / 合言葉で使えます</span>
        </button>
      )}

      <details className="mt-7 pt-4 border-t border-[#3b3543] text-[12px]">
        <summary className="cursor-pointer min-h-[34px] text-[#ddd5e8]">文字の詳細設定（フォント・縁取り・大きさ・自由配置）</summary>
        <div className="space-y-4 mt-3">
          <div>
            <label className="text-[11px] text-studio-muted block mb-1" htmlFor={fontId}>フォント</label>
            <select id={fontId} value={config.text.font} onChange={(e) => updateText({ font: e.target.value })} className={`${inputCls} text-[13px]`}>
              {(["標準", "日本語", "英字"] as FontCategory[]).map((cat) => {
                const opts = FONT_OPTIONS.filter((o) => o.category === cat);
                if (opts.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat}>
                    {opts.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-studio-muted block mb-1">文字の大きさ: {config.text.fontSize}px</label>
            <input type="range" min={8} max={72} value={config.text.fontSize} onChange={(e) => updateText({ fontSize: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <label className="text-[11px] text-studio-muted block mb-1">
              文字の縁の幅: {config.text.outlineWidth}px{config.text.outlineWidth === 0 ? "（なし）" : ""}
            </label>
            <input type="range" min={0} max={10} value={config.text.outlineWidth} onChange={(e) => updateText({ outlineWidth: Number(e.target.value) })} className="w-full" />
          </div>
          {isPremium && (
            <ColorPicker label="縁取りの色" value={config.text.strokeColor} onChange={(c) => updateText({ strokeColor: c })} />
          )}
          {bgRemovedCanvas && (
            <div>
              <p className="text-[11px] text-studio-muted mb-1">自由配置（文字や重ねた画像をドラッグ）</p>
              <DragPositionCanvas bgRemovedCanvas={bgRemovedCanvas} config={config} subCanvas={subCanvas} onConfigChange={onConfigChange} />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
