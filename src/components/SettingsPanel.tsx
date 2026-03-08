import { useState, useEffect, useRef } from "react";
import {
  EmoteConfig,
  TextConfig,
  BORDER_OPTIONS,
  ANIMATION_OPTIONS,
  TEXT_PRESETS,
  FONT_OPTIONS,
  TEXT_POSITION_OPTIONS,
  FontCategory,
} from "@/types/emote";

interface SettingsPanelProps {
  config: EmoteConfig;
  onConfigChange: (partial: Partial<EmoteConfig>) => void;
  disabled: boolean;
}

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent when config changes externally (e.g. preset applied)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <div className="flex-1">
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="color"
          value={local}
          onInput={(e) => setLocal((e.target as HTMLInputElement).value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-600 bg-transparent cursor-pointer"
        />
        <span className="text-xs text-gray-400 font-mono">{local}</span>
      </div>
    </div>
  );
}

export default function SettingsPanel({
  config,
  onConfigChange,
  disabled,
}: SettingsPanelProps) {
  const updateText = (partial: Partial<TextConfig>) => {
    onConfigChange({ text: { ...config.text, ...partial } });
  };

  const hasText = !!(config.text.customText.trim() || config.textPreset);

  return (
    <div className={`space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Border */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">フチ取り</h3>
        <div className="grid grid-cols-2 gap-2">
          {BORDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onConfigChange({ border: opt.value })}
              className={`px-3 py-2 rounded text-sm transition-colors ${
                config.border === opt.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {config.border !== "none" && (
          <div className="mt-2">
            <label className="text-xs text-gray-400 block mb-1">
              縁の幅: {config.borderWidth}px
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={config.borderWidth}
              onChange={(e) => onConfigChange({ borderWidth: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">テキスト</h3>

        {/* Presets */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                onConfigChange({
                  textPreset: config.textPreset === preset.id ? null : preset.id,
                  text: { ...config.text, customText: "" },
                });
              }}
              className={`px-2 py-2 rounded text-sm transition-colors ${
                config.textPreset === preset.id && !config.text.customText
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
            onConfigChange({
              text: { ...config.text, customText: val },
              textPreset: val ? null : config.textPreset,
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
              文字サイズ: {config.fontSize}px
            </label>
            <input
              type="range"
              min={8}
              max={48}
              value={config.fontSize}
              onChange={(e) => onConfigChange({ fontSize: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
          </div>
        )}

        {/* Colors row */}
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

        {/* Text position */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">テキスト位置</label>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_POSITION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateText({ position: opt.value })}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  config.text.position === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text position fine-tune */}
        {hasText && (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                横位置: {config.textOffsetX}px
              </label>
              <input
                type="range"
                min={-50}
                max={50}
                value={config.textOffsetX}
                onChange={(e) => onConfigChange({ textOffsetX: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                縦位置: {config.textOffsetY}px
              </label>
              <input
                type="range"
                min={-50}
                max={50}
                value={config.textOffsetY}
                onChange={(e) => onConfigChange({ textOffsetY: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Animation */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          アニメーション
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ANIMATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onConfigChange({ animation: opt.value })}
              className={`px-3 py-2 rounded text-sm transition-colors ${
                config.animation === opt.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
