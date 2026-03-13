"use client";

import { EmoteConfig, COMPOSITE_OPTIONS } from "@/types/emote";
import SubImageUpload from "../SubImageUpload";

interface SubImageSettingsProps {
  config: EmoteConfig;
  onConfigChange: (partial: Partial<EmoteConfig>) => void;
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
                  max={100}
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
  );
}
