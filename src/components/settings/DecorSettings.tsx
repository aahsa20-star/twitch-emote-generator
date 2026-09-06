"use client";

import { EmoteConfig, PartialEmoteConfig, BORDER_OPTIONS, FRAME_OPTIONS, type BorderStyle } from "@/types/emote";
import ColorPicker from "./ColorPicker";
import { fieldLabel, optionCard, optionCardActive, optionCardLocked } from "@/components/ui/classes";

interface DecorSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  isPremium: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
}

const REPRESENTATIVE: BorderStyle[] = ["none", "white", "black", "shadow"];
const COLOR_STYLES: BorderStyle[] = ["custom", "neon", "double", "sticker", "outline-only", "gradient", "dotted"];

const OUTLINE_GLYPH: Partial<Record<BorderStyle, { glyph: string; cls: string }>> = {
  none: { glyph: "◯", cls: "text-studio-muted" },
  white: { glyph: "◯", cls: "text-white drop-shadow-[0_0_3px_#fff]" },
  black: { glyph: "●", cls: "text-[#08070a] drop-shadow-[0_0_2px_#fff]" },
  shadow: { glyph: "◐", cls: "text-[#cfc7dc]" },
};

/**
 * 「飾り」 tab (09 §3): representative outline styles and frames first; every
 * existing style, width, colour and padding under 詳細設定. Nothing is removed
 * — trial-locked options stay visible with the lock hint.
 */
export default function DecorSettings({ config, onConfigChange, isPremium, onTrialLockClick }: DecorSettingsProps) {
  const isTrialAllowed = (style: BorderStyle) => style === "none" || style === "white" || style === "black";
  const outlineLocked = (style: BorderStyle) => !isPremium && !isTrialAllowed(style);
  const style = config.outline.style;
  const representativeActive = REPRESENTATIVE.includes(style);

  const OutlineButton = ({ value, label }: { value: BorderStyle; label: string }) => {
    const locked = outlineLocked(value);
    const on = style === value;
    const glyph = OUTLINE_GLYPH[value];
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-disabled={locked || undefined}
        title={locked ? "フォローまたは合言葉で解放" : undefined}
        onClick={() => (locked ? onTrialLockClick?.(label) : onConfigChange({ outline: { style: value } }))}
        className={`${optionCard} ${on ? optionCardActive : ""} ${locked ? optionCardLocked : ""}`}
      >
        {glyph && <span aria-hidden className={`text-[28px] leading-none ${glyph.cls}`}>{glyph.glyph}</span>}
        <span>{locked ? "🔒 " : ""}{label}</span>
      </button>
    );
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[15px] md:text-[17px] font-bold">輪郭を、くっきり。</h2>
        <p className="text-[11px] md:text-[12px] text-studio-muted mt-1">まずはフチをひとつ。飾りはあとから。</p>
      </div>

      <span className={fieldLabel} id="outline-label">フチ取り</span>
      <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="outline-label">
        {REPRESENTATIVE.map((v) => (
          <OutlineButton key={v} value={v} label={BORDER_OPTIONS.find((o) => o.value === v)?.label ?? v} />
        ))}
      </div>
      {!representativeActive && (
        <p className="text-[11px] text-studio-muted mt-2">選択中: {BORDER_OPTIONS.find((o) => o.value === style)?.label ?? style}（詳細設定のスタイル）</p>
      )}

      <span className={`${fieldLabel} mt-6`} id="frame-label">フレーム</span>
      {isPremium ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="group" aria-labelledby="frame-label">
          {FRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={config.frame.type === opt.value}
              onClick={() => onConfigChange({ frame: { type: opt.value } })}
              className={`${optionCard} min-h-[44px] py-2 ${config.frame.type === opt.value ? optionCardActive : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onTrialLockClick?.("フレーム")}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-[12px] text-studio-muted bg-[#1f1e26] border border-studio-stroke rounded-[10px] text-left"
        >
          <span aria-hidden>🔒</span>
          <span>
            フレーム {FRAME_OPTIONS.length - 1} 種はフォロー / 合言葉で使えます
            {config.frame.type !== "none" && `（テンプレートから「${FRAME_OPTIONS.find((o) => o.value === config.frame.type)?.label}」を適用中）`}
          </span>
        </button>
      )}

      <details className="mt-7 pt-4 border-t border-[#3b3543] text-[12px]">
        <summary className="cursor-pointer min-h-[34px] text-[#ddd5e8]">フチとフレームの詳細設定（全スタイル・幅・色・余白）</summary>
        <div className="space-y-4 mt-3">
          <div>
            <span className="text-[11px] text-studio-muted block mb-2" id="outline-all-label">すべてのフチスタイル</span>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2" role="group" aria-labelledby="outline-all-label">
              {BORDER_OPTIONS.map((opt) => {
                const locked = outlineLocked(opt.value);
                const on = style === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={on}
                    aria-disabled={locked || undefined}
                    onClick={() => (locked ? onTrialLockClick?.(opt.label) : onConfigChange({ outline: { style: opt.value } }))}
                    className={`${optionCard} min-h-[44px] py-2 ${on ? optionCardActive : ""} ${locked ? optionCardLocked : ""}`}
                  >
                    {locked ? "🔒 " : ""}{opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {style !== "none" && (
            <div>
              <label className="text-[11px] text-studio-muted block mb-1">フチの幅: {config.outline.width}px</label>
              <input type="range" min={1} max={20} value={config.outline.width} onChange={(e) => onConfigChange({ outline: { width: Number(e.target.value) } })} className="w-full" />
            </div>
          )}
          {COLOR_STYLES.includes(style) && isPremium && (
            <ColorPicker label="フチの色" value={config.outline.color} onChange={(c) => onConfigChange({ outline: { color: c } })} />
          )}
          {style === "custom" && !isPremium && (
            <div className="flex items-center gap-2 text-[11px] text-studio-muted">
              <span className="inline-block w-6 h-6 rounded border border-studio-stroke" style={{ backgroundColor: config.outline.color }} />
              テンプレートの色を使用中
            </div>
          )}
          <div>
            <label className="text-[11px] text-studio-muted block mb-1">余白: {Math.round(config.padding * 100)}%</label>
            <input type="range" min={0} max={15} value={Math.round(config.padding * 100)} onChange={(e) => onConfigChange({ padding: Number(e.target.value) / 100 })} className="w-full" />
          </div>
        </div>
      </details>
    </div>
  );
}
