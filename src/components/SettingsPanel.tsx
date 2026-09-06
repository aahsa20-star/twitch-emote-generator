"use client";

import type { EmoteConfig, PartialEmoteConfig } from "@/types/emote";
import type { DownloadGate } from "@/lib/download/profiles";
import AnimationSettings from "./settings/AnimationSettings";
import TextSettings from "./settings/TextSettings";
import DecorSettings from "./settings/DecorSettings";
import MoreSettings, { PlaybackSettings } from "./settings/MoreSettings";

export type EditorTool = "animation" | "text" | "decor" | "more";

interface SettingsPanelProps {
  config: EmoteConfig;
  onConfigChange: (partial: PartialEmoteConfig) => void;
  disabled: boolean;
  isPremium: boolean;
  onTrialLockClick?: (featureLabel: string) => void;
  subFile: File | null;
  onSubImageSelected: (file: File) => void;
  bgRemovedCanvas?: HTMLCanvasElement | null;
  subCanvas?: HTMLCanvasElement | null;
  /** GIF / video source: 「動き」 becomes 「再生」 (playback settings). */
  isAnimatedSource: boolean;
  tool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  onGoAdjust: (() => void) | null;
  onRetryBgRemoval: () => void;
  onUseOriginal: () => void;
  onResetPosition: () => void;
  hasPositionAdjustment: boolean;
  canRedoBackground: boolean;
  onBeforeDownload?: DownloadGate;
}

/**
 * Editor inspector (09 §3): 動き / 文字 / 飾り / その他. Every panel stays
 * mounted (hidden, not unmounted) so search text, scroll and drafts survive
 * tab switches; previews inside hidden panels stop because they are offscreen.
 */
export default function SettingsPanel(p: SettingsPanelProps) {
  const tabs: { id: EditorTool; label: string; icon: string }[] = [
    { id: "animation", label: p.isAnimatedSource ? "再生" : "動き", icon: p.isAnimatedSource ? "▶" : "◉" },
    { id: "text", label: "文字", icon: "T" },
    { id: "decor", label: "飾り", icon: "✧" },
    { id: "more", label: "その他", icon: "⚙" },
  ];

  return (
    <section className={`bg-studio-surface border border-studio-stroke rounded-studio overflow-hidden ${p.disabled ? "opacity-60" : ""}`} aria-label="編集設定" aria-busy={p.disabled}>
      <nav className="sticky top-0 z-[2] grid grid-cols-4 gap-2 px-2.5 md:px-4 bg-studio-surface border-b border-studio-stroke" aria-label="編集項目">
        {tabs.map((t) => {
          const on = p.tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => p.onToolChange(t.id)}
              className={`flex items-center justify-center gap-1.5 min-h-[52px] py-3 text-[12px] md:text-[13px] border-b-2 -mb-px transition-colors ${
                on ? "text-studio-accent border-studio-accent font-semibold" : "text-studio-muted border-transparent hover:text-studio-text"
              }`}
            >
              <span aria-hidden className="text-[15px]">{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className={`p-4 md:p-6 ${p.disabled ? "pointer-events-none" : ""}`}>
        <div hidden={p.tool !== "animation"}>
          {p.isAnimatedSource ? (
            <PlaybackSettings config={p.config} onConfigChange={p.onConfigChange} />
          ) : (
            <AnimationSettings
              config={p.config}
              onConfigChange={p.onConfigChange}
              isPremium={p.isPremium}
              onTrialLockClick={p.onTrialLockClick}
              bgRemovedCanvas={p.bgRemovedCanvas}
              active={p.tool === "animation" && !p.disabled}
            />
          )}
        </div>
        <div hidden={p.tool !== "text"}>
          <TextSettings
            config={p.config}
            onConfigChange={p.onConfigChange}
            isPremium={p.isPremium}
            onTrialLockClick={p.onTrialLockClick}
            bgRemovedCanvas={p.bgRemovedCanvas}
            subCanvas={p.subCanvas}
          />
        </div>
        <div hidden={p.tool !== "decor"}>
          <DecorSettings config={p.config} onConfigChange={p.onConfigChange} isPremium={p.isPremium} onTrialLockClick={p.onTrialLockClick} />
        </div>
        <div hidden={p.tool !== "more"}>
          <MoreSettings {...p} />
        </div>
      </div>
    </section>
  );
}
