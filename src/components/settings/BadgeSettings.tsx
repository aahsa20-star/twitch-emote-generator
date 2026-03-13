"use client";

import { EmoteConfig, PartialEmoteConfig, BadgeSettings as BadgeSettingsType, BADGE_SHAPE_OPTIONS } from "@/types/emote";
import ColorPicker from "./ColorPicker";

interface BadgeSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
}

export default function BadgeSettings({ config, onConfigChange }: BadgeSettingsProps) {
  const updateBadge = (partial: Partial<BadgeSettingsType>) => {
    onConfigChange({ badge: { ...config.badge, ...partial } });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">バッジ作成</h3>
        <button
          onClick={() => updateBadge({ enabled: !config.badge.enabled })}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            config.badge.enabled ? "bg-purple-600" : "bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              config.badge.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
      {config.badge.enabled && (
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
                    config.badge.shape === opt.value
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
                onClick={() => updateBadge({ bgTransparent: !config.badge.bgTransparent })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.badge.bgTransparent ? "bg-purple-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    config.badge.bgTransparent ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>
            {!config.badge.bgTransparent && (
              <ColorPicker
                label="背景色"
                value={config.badge.bgColor}
                onChange={(c) => updateBadge({ bgColor: c })}
              />
            )}
          </div>

          {/* Padding */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              内側余白: {config.badge.padding}px
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={config.badge.padding}
              onChange={(e) => updateBadge({ padding: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Outline */}
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                輪郭線: {config.badge.outlineWidth}px{config.badge.outlineWidth === 0 ? "（なし）" : ""}
              </label>
              <input
                type="range"
                min={0}
                max={4}
                step={1}
                value={config.badge.outlineWidth}
                onChange={(e) => updateBadge({ outlineWidth: Number(e.target.value) })}
                className="w-full accent-purple-500"
              />
            </div>
            {config.badge.outlineWidth > 0 && (
              <ColorPicker
                label="輪郭線の色"
                value={config.badge.outlineColor}
                onChange={(c) => updateBadge({ outlineColor: c })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
