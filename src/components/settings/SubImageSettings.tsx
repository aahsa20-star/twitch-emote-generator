"use client";

import { EmoteConfig, PartialEmoteConfig, COMPOSITE_OPTIONS } from "@/types/emote";
import SubImageUpload from "../SubImageUpload";

interface SubImageSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
}

export default function SubImageSettings({
  config,
  onConfigChange,
  subFile,
  onSubImageSelected,
}: SubImageSettingsProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">2画像合成</h3>
      <div className="grid grid-cols-2 gap-2">
        {COMPOSITE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              if (opt.value === "overlay-br") {
                onConfigChange({ subImage: { mode: opt.value, offsetX: 20, offsetY: 20 } });
              } else if (opt.value === "overlay-bl") {
                onConfigChange({ subImage: { mode: opt.value, offsetX: -20, offsetY: 20 } });
              } else {
                onConfigChange({ subImage: { mode: opt.value, offsetX: 0, offsetY: 0 } });
              }
            }}
            className={`px-3 py-2 min-h-[44px] md:min-h-0 rounded text-sm transition-colors ${
              config.subImage.mode === opt.value
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            <span className="block font-medium">{opt.label}</span>
            {opt.desc && <span className="block text-[10px] opacity-70">{opt.desc}</span>}
          </button>
        ))}
      </div>
      {config.subImage.mode !== "none" && (
        <div className="mt-3 space-y-2">
          <SubImageUpload
            onSubImageSelected={onSubImageSelected}
            currentFile={subFile}
          />
          <p className="text-[10px] text-gray-500">透過済みPNG推奨。背景ありの場合は透過処理が必要です。</p>
          {(config.subImage.mode === "overlay-br" || config.subImage.mode === "overlay-bl") && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  サブ画像サイズ: {config.subImage.scale}%
                </label>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={config.subImage.scale}
                  onChange={(e) => onConfigChange({ subImage: { scale: Number(e.target.value) } })}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
