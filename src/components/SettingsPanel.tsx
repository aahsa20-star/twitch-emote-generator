import { useState, useEffect, useRef } from "react";
import {
  EmoteConfig,
  TextConfig,
  BadgeSettings,
  BORDER_OPTIONS,
  FRAME_OPTIONS,
  COMPOSITE_OPTIONS,
  BADGE_SHAPE_OPTIONS,
  ANIMATION_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
  TEXT_PRESETS,
  FONT_OPTIONS,
  FontCategory,
} from "@/types/emote";
import SubImageUpload from "./SubImageUpload";
import DragPositionCanvas from "./DragPositionCanvas";

interface SettingsPanelProps {
  config: EmoteConfig;
  onConfigChange: (partial: Partial<EmoteConfig>) => void;
  disabled: boolean;
  isSubscriber: boolean;
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
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
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when config changes externally (e.g. preset applied)
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLocal(newColor);
    // Debounce parent update so preview refreshes during drag without excessive re-renders
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newColor);
    }, 200);
  };

  return (
    <div className="flex-1">
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={local}
          onChange={handleInput}
          className="w-10 h-10 rounded border border-gray-600 bg-transparent cursor-pointer"
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
  isSubscriber,
  subFile,
  onSubImageSelected,
  bgRemovedCanvas,
  subCanvas,
}: SettingsPanelProps) {
  const updateText = (partial: Partial<TextConfig>) => {
    onConfigChange({ text: { ...config.text, ...partial } });
  };

  const updateBadge = (partial: Partial<BadgeSettings>) => {
    onConfigChange({ badgeSettings: { ...config.badgeSettings, ...partial } });
  };

  const hasText = !!(config.text.customText.trim() || config.textPreset);

  return (
    <div className={`space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Border */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">フチ取り</h3>
        <div className="grid grid-cols-2 gap-2">
          {BORDER_OPTIONS.map((opt) => {
            const locked = opt.subscriberOnly && !isSubscriber;
            return (
              <button
                key={opt.value}
                onClick={() => !locked && onConfigChange({ border: opt.value })}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  locked
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : config.border === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                title={locked ? "合言葉を入力すると解放されます" : undefined}
              >
                {opt.label}
              </button>
            );
          })}
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
        {config.border === "custom" && isSubscriber && (
          <div className="mt-2">
            <ColorPicker
              label="フチの色"
              value={config.borderColor}
              onChange={(c) => onConfigChange({ borderColor: c })}
            />
          </div>
        )}
      </div>

      {/* Frame (subscriber-only, hidden for non-subscribers) */}
      {isSubscriber && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">フレーム</h3>
          <div className="grid grid-cols-2 gap-2">
            {FRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onConfigChange({ frameType: opt.value })}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  config.frameType === opt.value
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

      {/* Composite (subscriber-only, hidden for non-subscribers) */}
      {isSubscriber && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">2画像合成</h3>
          <div className="grid grid-cols-2 gap-2">
            {COMPOSITE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const update: Partial<typeof config> = { compositeMode: opt.value };
                  if (opt.value === "overlay-br") {
                    update.subImageOffsetX = 20;
                    update.subImageOffsetY = 20;
                  } else if (opt.value === "overlay-bl") {
                    update.subImageOffsetX = -20;
                    update.subImageOffsetY = 20;
                  } else {
                    update.subImageOffsetX = 0;
                    update.subImageOffsetY = 0;
                  }
                  onConfigChange(update);
                }}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  config.compositeMode === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <span className="block font-medium">{opt.label}</span>
                {opt.desc && <span className="block text-[10px] opacity-70">{opt.desc}</span>}
              </button>
            ))}
          </div>
          {config.compositeMode !== "none" && (
            <div className="mt-3 space-y-2">
              <SubImageUpload
                onSubImageSelected={onSubImageSelected}
                currentFile={subFile}
              />
              <p className="text-[10px] text-gray-500">透過済みPNG推奨。背景ありの場合は透過処理が必要です。</p>
              {(config.compositeMode === "overlay-br" || config.compositeMode === "overlay-bl") && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">
                      サブ画像サイズ: {config.subImageScale}%
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={60}
                      step={1}
                      value={config.subImageScale}
                      onChange={(e) => onConfigChange({ subImageScale: Number(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Text */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300">テキスト</h3>

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
              className={`px-2 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
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
              max={72}
              value={config.fontSize}
              onChange={(e) => onConfigChange({ fontSize: Number(e.target.value) })}
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
              縁の幅: {config.textOutlineWidth}px{config.textOutlineWidth === 0 ? "（なし）" : ""}
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={config.textOutlineWidth}
              onChange={(e) => onConfigChange({ textOutlineWidth: Number(e.target.value) })}
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
                  onClick={() => onConfigChange({ textOffsetX: 0, textOffsetY: opt.offsetY })}
                  className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                    config.textOffsetY === opt.offsetY && config.textOffsetX === 0
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

      {/* Animation */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">
          アニメーション
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {ANIMATION_OPTIONS.filter((o) => !o.subscriberOnly).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onConfigChange({ animation: opt.value })}
              className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                config.animation === opt.value
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Subscriber-only animations */}
        {ANIMATION_OPTIONS.some((o) => o.subscriberOnly) && (
          <>
            <p className="text-xs text-gray-500 mt-3 mb-1">限定</p>
            <div className="grid grid-cols-2 gap-2">
              {ANIMATION_OPTIONS.filter((o) => o.subscriberOnly).map((opt) => {
                const locked = !isSubscriber;
                return (
                  <button
                    key={opt.value}
                    onClick={() => !locked && onConfigChange({ animation: opt.value })}
                    className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                      locked
                        ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                        : config.animation === opt.value
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                    title={locked ? "合言葉を入力すると解放されます" : undefined}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Animation speed */}
        {config.animation !== "none" && (
          <div className="mt-3">
            <label className="text-xs text-gray-400 block mb-1">速度</label>
            <div className="grid grid-cols-3 gap-2">
              {ANIMATION_SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onConfigChange({ animationSpeed: opt.value })}
                  className={`px-3 py-1.5 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                    config.animationSpeed === opt.value
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
      </div>

      {/* Badge (subscriber-only, hidden for non-subscribers) */}
      {isSubscriber && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300">バッジ作成</h3>
            <button
              onClick={() => updateBadge({ enabled: !config.badgeSettings.enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                config.badgeSettings.enabled ? "bg-purple-600" : "bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  config.badgeSettings.enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>
          {config.badgeSettings.enabled && (
            <div className="space-y-3">
              {/* Shape */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">形状</label>
                <div className="grid grid-cols-3 gap-2">
                  {BADGE_SHAPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateBadge({ shape: opt.value })}
                      className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                        config.badgeSettings.shape === opt.value
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-400">背景透過</label>
                  <button
                    onClick={() => updateBadge({ bgTransparent: !config.badgeSettings.bgTransparent })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      config.badgeSettings.bgTransparent ? "bg-purple-600" : "bg-gray-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        config.badgeSettings.bgTransparent ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                {!config.badgeSettings.bgTransparent && (
                  <ColorPicker
                    label="背景色"
                    value={config.badgeSettings.bgColor}
                    onChange={(c) => updateBadge({ bgColor: c })}
                  />
                )}
              </div>

              {/* Padding */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  内側余白: {config.badgeSettings.padding}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={config.badgeSettings.padding}
                  onChange={(e) => updateBadge({ padding: Number(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Outline */}
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">
                    輪郭線: {config.badgeSettings.outlineWidth}px{config.badgeSettings.outlineWidth === 0 ? "（なし）" : ""}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={config.badgeSettings.outlineWidth}
                    onChange={(e) => updateBadge({ outlineWidth: Number(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>
                {config.badgeSettings.outlineWidth > 0 && (
                  <ColorPicker
                    label="輪郭線の色"
                    value={config.badgeSettings.outlineColor}
                    onChange={(c) => updateBadge({ outlineColor: c })}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
