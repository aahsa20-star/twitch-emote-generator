import {
  EmoteConfig,
  PartialEmoteConfig,
  BORDER_OPTIONS,
  FRAME_OPTIONS,
  ANIMATED_SPEED_PRESETS,
  ANIMATED_SPEED_MIN,
  ANIMATED_SPEED_MAX,
  ANIMATED_SPEED_STEP,
  ANIMATED_LOOP_OPTIONS,
} from "@/types/emote";
import ColorPicker from "./settings/ColorPicker";
import TextSettings from "./settings/TextSettings";
import AnimationSettings from "./settings/AnimationSettings";
import BadgeSettings from "./settings/BadgeSettings";
import SubImageSettings from "./settings/SubImageSettings";

interface SettingsPanelProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  disabled: boolean;
  isSubscriber: boolean;
  isLoggedIn: boolean;
  onLoginRequired?: () => void;
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
  /** True when the source is an animated GIF or extracted video frames.
   *  Gates the "再生設定" section (speed + loop count) which only applies
   *  to those source types. */
  isAnimatedSource?: boolean;
}

export default function SettingsPanel({
  config,
  onConfigChange,
  disabled,
  isSubscriber,
  isLoggedIn,
  onLoginRequired,
  subFile,
  onSubImageSelected,
  bgRemovedCanvas,
  subCanvas,
  isAnimatedSource = false,
}: SettingsPanelProps) {
  return (
    <div className={`space-y-5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {/* Border */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-2">フチ取り</h3>
        <div className="grid grid-cols-2 gap-2">
          {BORDER_OPTIONS.map((opt) => {
            const locked = opt.subscriberOnly && !isSubscriber;
            const isActiveFromTemplate = locked && config.outline.style === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !locked && onConfigChange({ outline: { style: opt.value } })}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  isActiveFromTemplate
                    ? "bg-purple-900 text-purple-300 border border-purple-500 cursor-not-allowed"
                    : locked
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : config.outline.style === opt.value
                    ? "bg-purple-600 text-white"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
                title={isActiveFromTemplate ? "テンプレートから適用中。変更するには合言葉が必要です" : locked ? "合言葉を入力すると解放されます" : undefined}
              >
                {isActiveFromTemplate ? `🔒 ${opt.label}` : opt.label}
              </button>
            );
          })}
        </div>
        {config.outline.style !== "none" && (
          <div className="mt-2">
            <label className="text-xs text-gray-400 block mb-1">
              縁の幅: {config.outline.width}px
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={config.outline.width}
              onChange={(e) => onConfigChange({ outline: { width: Number(e.target.value) } })}
              className="w-full accent-purple-500"
            />
          </div>
        )}
        {config.outline.style === "custom" && isSubscriber && (
          <div className="mt-2">
            <ColorPicker
              label="フチの色"
              value={config.outline.color}
              onChange={(c) => onConfigChange({ outline: { color: c } })}
            />
          </div>
        )}
        {config.outline.style === "custom" && !isSubscriber && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block w-6 h-6 rounded border border-gray-600"
              style={{ backgroundColor: config.outline.color }}
            />
            <span className="text-xs text-gray-400">テンプレートの色を使用中</span>
          </div>
        )}
      </div>

      {/* Padding */}
      <div>
        <label className="text-xs text-gray-400 block mb-1">
          余白: {Math.round(config.padding * 100)}%
        </label>
        <input
          type="range"
          min={0}
          max={15}
          value={Math.round(config.padding * 100)}
          onChange={(e) => onConfigChange({ padding: Number(e.target.value) / 100 })}
          className="w-full accent-purple-500"
        />
      </div>

      {/* Frame (subscriber-only) */}
      {isSubscriber && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">フレーム</h3>
          <div className="grid grid-cols-2 gap-2">
            {FRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onConfigChange({ frame: { type: opt.value } })}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  config.frame.type === opt.value
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
      {!isSubscriber && config.frame.type !== "none" && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">フレーム</h3>
          <div className="px-3 py-2 rounded text-sm bg-purple-900 text-purple-300 border border-purple-500">
            🔒 {FRAME_OPTIONS.find((o) => o.value === config.frame.type)?.label ?? config.frame.type} — テンプレートから適用中
          </div>
        </div>
      )}

      {/* Sub-image composite (subscriber-only) */}
      {isSubscriber && (
        <SubImageSettings
          config={config}
          onConfigChange={onConfigChange}
          subFile={subFile}
          onSubImageSelected={onSubImageSelected}
        />
      )}

      {/* Text */}
      <TextSettings
        config={config}
        onConfigChange={onConfigChange}
        bgRemovedCanvas={bgRemovedCanvas}
        subCanvas={subCanvas}
      />

      {/* Animation — hidden for animated sources (the source IS the animation;
          the 52-pattern animation system would be a no-op in that branch). */}
      {!isAnimatedSource && (
        <AnimationSettings
          config={config}
          onConfigChange={onConfigChange}
          isSubscriber={isSubscriber}
          isLoggedIn={isLoggedIn}
          onLoginRequired={onLoginRequired}
          bgRemovedCanvas={bgRemovedCanvas}
        />
      )}

      {/* Playback settings (animated sources only) */}
      {isAnimatedSource && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">再生設定</h3>
          <div className="space-y-3">
            {/* Speed */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 flex justify-between">
                <span>速度</span>
                <span className="font-mono text-gray-300">{config.animatedSpeed.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min={ANIMATED_SPEED_MIN}
                max={ANIMATED_SPEED_MAX}
                step={ANIMATED_SPEED_STEP}
                value={config.animatedSpeed}
                onChange={(e) => onConfigChange({ animatedSpeed: Number(e.target.value) } as PartialEmoteConfig)}
                className="w-full accent-purple-500"
              />
              <div className="flex gap-1.5">
                {ANIMATED_SPEED_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => onConfigChange({ animatedSpeed: p } as PartialEmoteConfig)}
                    className={`flex-1 py-1 rounded text-xs transition-colors ${
                      Math.abs(config.animatedSpeed - p) < 0.001
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {p}x
                  </button>
                ))}
              </div>
            </div>

            {/* Loop count */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 block">ループ回数</label>
              <div className="grid grid-cols-4 gap-1.5">
                {ANIMATED_LOOP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onConfigChange({ animatedLoopCount: opt.value } as PartialEmoteConfig)}
                    className={`py-1.5 rounded text-xs transition-colors ${
                      config.animatedLoopCount === opt.value
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 leading-snug">
                Twitchエモートとして使う場合は無限ループ推奨
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Badge (subscriber-only) */}
      {isSubscriber && (
        <BadgeSettings
          config={config}
          onConfigChange={onConfigChange}
        />
      )}
    </div>
  );
}
