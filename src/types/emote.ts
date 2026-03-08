export const EMOTE_SIZES = [28, 56, 112] as const;
export type EmoteSize = (typeof EMOTE_SIZES)[number];

export type BorderStyle = "none" | "white" | "black" | "shadow";

export type AnimationType = "none" | "sway" | "shake" | "blink" | "bounce" | "zoomin" | "spin" | "hearts";

export type TextPosition = "top" | "center" | "bottom";

export interface TextPreset {
  id: string;
  label: string;
  text: string;
}

export interface TextConfig {
  customText: string;
  font: string;
  fillColor: string;
  strokeColor: string;
  position: TextPosition;
}

export interface EmoteConfig {
  border: BorderStyle;
  textPreset: string | null;
  text: TextConfig;
  animation: AnimationType;
}

export type FontCategory = "標準" | "日本語" | "英字";

export const FONT_OPTIONS: { value: string; label: string; category: FontCategory }[] = [
  { value: "Noto Sans JP", label: "Noto Sans JP Bold", category: "標準" },
  { value: "Dela Gothic One", label: "Dela Gothic One（極太ゴシック）", category: "日本語" },
  { value: "Reggae One", label: "Reggae One（レゲエ）", category: "日本語" },
  { value: "Rampart One", label: "Rampart One（中抜き）", category: "日本語" },
  { value: "DotGothic16", label: "DotGothic16（ドット）", category: "日本語" },
  { value: "Zen Tokyo Zoo", label: "Zen Tokyo Zoo（装飾）", category: "日本語" },
  { value: "Rock 3D", label: "Rock 3D（3D風）", category: "日本語" },
  { value: "Permanent Marker", label: "Permanent Marker（手書き）", category: "英字" },
  { value: "Boogaloo", label: "Boogaloo（ポップ英字）", category: "英字" },
];

export const TEXT_POSITION_OPTIONS: { value: TextPosition; label: string }[] = [
  { value: "top", label: "上" },
  { value: "center", label: "中央" },
  { value: "bottom", label: "下" },
];

export type ProcessingStage =
  | "idle"
  | "removing-background"
  | "processing"
  | "generating-preview"
  | "ready"
  | "exporting";

export interface EmoteVariant {
  size: EmoteSize;
  staticDataUrl: string;
  animatedBlob: Blob | null;
  filename: string;
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: "kusa", label: "草", text: "草" },
  { id: "gg", label: "GG", text: "GG" },
  { id: "nice", label: "ないす", text: "ないす" },
  { id: "rip", label: "RIP", text: "RIP" },
  { id: "toutoi", label: "尊い", text: "尊い" },
  { id: "egui", label: "えぐい", text: "えぐい" },
  { id: "nande", label: "なんで", text: "なんで" },
  { id: "kusahaeru", label: "草生える", text: "草生える" },
];

export const BORDER_OPTIONS: { value: BorderStyle; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "white", label: "白フチ" },
  { value: "black", label: "黒フチ" },
  { value: "shadow", label: "影付き" },
];

export const ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: "none", label: "なし（静止画）" },
  { value: "sway", label: "揺れる" },
  { value: "shake", label: "震える" },
  { value: "blink", label: "点滅" },
  { value: "bounce", label: "ぴょこぴょこ" },
  { value: "zoomin", label: "ズームイン" },
  { value: "spin", label: "回転" },
  { value: "hearts", label: "ハートぷかぷか" },
];
