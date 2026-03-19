import { EmoteConfig, ANIMATION_OPTIONS, BORDER_OPTIONS, FRAME_OPTIONS, TEXT_PRESETS } from "@/types/emote";

export function configToSummary(config: EmoteConfig): string {
  const parts: string[] = [];

  // Outline
  const border = BORDER_OPTIONS.find((o) => o.value === config.outline.style);
  if (border && config.outline.style !== "none") {
    parts.push(`${border.label}(${config.outline.width}px)`);
  }

  // Frame
  const frame = FRAME_OPTIONS.find((o) => o.value === config.frame.type);
  if (frame && config.frame.type !== "none") {
    parts.push(`フレーム:${frame.label}`);
  }

  // Text
  const textDisplay = config.text.customText.trim()
    || TEXT_PRESETS.find((p) => p.id === config.text.preset)?.text;
  if (textDisplay) {
    parts.push(`テキスト「${textDisplay}」`);
  }

  // Animation
  const anim = ANIMATION_OPTIONS.find((o) => o.value === config.animation.type);
  if (anim && config.animation.type !== "none") {
    parts.push(anim.label);
  }

  if (parts.length === 0) {
    parts.push("デフォルト設定");
  }

  return parts.join(" / ");
}
