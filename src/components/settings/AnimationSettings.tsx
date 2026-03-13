"use client";

import {
  EmoteConfig,
  ANIMATION_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
} from "@/types/emote";

interface AnimationSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: Partial<EmoteConfig>) => void;
  isSubscriber: boolean;
}

export default function AnimationSettings({
  config,
  onConfigChange,
  isSubscriber,
}: AnimationSettingsProps) {
  return (
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
  );
}
