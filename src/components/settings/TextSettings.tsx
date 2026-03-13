"use client";

import {
  EmoteConfig,
  PartialEmoteConfig,
  TextConfig,
  TEXT_PRESETS,
  FONT_OPTIONS,
  FontCategory,
} from "@/types/emote";
import ColorPicker from "./ColorPicker";
import DragPositionCanvas from "../DragPositionCanvas";

interface TextSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
}

export default function TextSettings({
  config,
  onConfigChange,
  bgRemovedCanvas,
  subCanvas,
}: TextSettingsProps) {
  const updateText = (partial: Partial<TextConfig>) => {
    onConfigChange({ text: { ...config.text, ...partial } });
  };

  const hasText = !!(config.text.customText.trim() || config.text.preset);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">テキスト</h3>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => {
              updateText({
                preset: config.text.preset === preset.id ? null : preset.id,
                customText: "",
              });
            }}
            className={`px-2 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
              config.text.preset === preset.id && !config.text.customText
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>


      {/* Custom text input */}
      <input
        type="text"
        placeholder="自由入力テキスト..."
        value={config.text.customText}
        onChange={(e) => {
          const val = e.target.value;
          updateText({
            customText: val,
            preset: val ? null : config.text.preset,
          });
        }}
        className="w-full px-3 py-2 rounded bg-gray-700 text-gray-100 text-sm placeholder-gray-500 border border-gray-600 focus:border-purple-500 focus:outline-none"
      />

      {/* Font select */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">フォント</label>
        <select
          value={config.text.font}
          onChange={(e) => updateText({ font: e.target.value })}
          className="w-full px-3 py-2 rounded bg-gray-700 text-gray-100 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
        >
          {(["標準", "日本語", "英字"] as FontCategory[]).map((cat) => {
            const opts = FONT_OPTIONS.filter((o) => o.category === cat);
            if (opts.length === 0) return null;
            return (
              <optgroup key={cat} label={cat}>
                {opts.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* Font size slider */}
      {hasText && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            文字サイズ: {config.text.fontSize}px
          </label>
          <input
            type="range"
            min={8}
            max={72}
            value={config.text.fontSize}
            onChange={(e) => updateText({ fontSize: Number(e.target.value) })}
            className="w-full accent-purple-500"
          />
        </div>
      )}

      {/* Colors row */}
      {hasText && (
        <div className="flex gap-4">
          <ColorPicker
            label="文字色"
            value={config.text.fillColor}
            onChange={(c) => updateText({ fillColor: c })}
          />
          <ColorPicker
            label="縁取り色"
            value={config.text.strokeColor}
            onChange={(c) => updateText({ strokeColor: c })}
          />
        </div>
      )}

      {/* Text outline width slider */}
      {hasText && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            縁の幅: {config.text.outlineWidth}px{config.text.outlineWidth === 0 ? "（なし）" : ""}
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={config.text.outlineWidth}
            onChange={(e) => updateText({ outlineWidth: Number(e.target.value) })}
            className="w-full accent-purple-500"
          />
        </div>
      )}

      {/* Text position shortcuts */}
      {hasText && (
        <div>
          <label className="text-xs text-gray-400 block mb-1">テキスト位置</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "上", offsetY: -40 },
              { label: "中央", offsetY: 0 },
              { label: "下", offsetY: 40 },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                onClick={() => updateText({ offsetX: 0, offsetY: opt.offsetY })}
                className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  config.text.offsetY === opt.offsetY && config.text.offsetX === 0
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drag position canvas (shown when text or sub-image overlay is active) */}
      {bgRemovedCanvas && (
        <DragPositionCanvas
          bgRemovedCanvas={bgRemovedCanvas}
          config={config}
          subCanvas={subCanvas}
          onConfigChange={onConfigChange}
        />
      )}
    </div>
  );
}
