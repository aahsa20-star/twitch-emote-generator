import {
  EmoteConfig,
  PartialEmoteConfig,
  BORDER_OPTIONS,
  FRAME_OPTIONS,
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
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
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
                onClick={() => !locked && onConfigChange({ outline: { style: opt.value } })}
                className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
                  locked
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : config.outline.style === opt.value
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

      {/* Animation */}
      <AnimationSettings
        config={config}
        onConfigChange={onConfigChange}
        isSubscriber={isSubscriber}
      />

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
