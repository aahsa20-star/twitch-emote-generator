export const EMOTE_SIZES = [28, 56, 112] as const;
export type EmoteSize = (typeof EMOTE_SIZES)[number];

export const DISCORD_SIZES = [32, 64, 128] as const;
export type DiscordSize = (typeof DISCORD_SIZES)[number];

export const SEVENTV_SIZES = [32, 64, 96, 128] as const;
export type SeventvSize = (typeof SEVENTV_SIZES)[number];

export type ExportMode = "twitch" | "discord" | "7tv" | "bttv" | "ffz";

export type BgRemovalQuality = "speed" | "quality";

export type BorderStyle =
  | "none"
  | "white"
  | "black"
  | "shadow"
  | "custom"
  // fix6: visual variation styles, all free.
  | "neon"
  | "double"
  | "sticker"
  | "outline-only"
  | "gradient"
  | "chrome"
  | "dotted";

export type FrameType =
  | "none"
  | "stars"
  | "hearts"
  | "gaming"
  | "sparkles"
  | "rainbow"
  | "dots"
  // fix9: simple/structured styles.
  | "neon"
  | "pixel"
  | "gold"
  | "silver"
  | "comic"
  // fix9: decorative styles.
  | "cat"
  | "sakura"
  | "hologram"
  // fix9: effect styles.
  | "fire"
  | "coin";

export type CompositeMode = "none" | "overlay-br" | "overlay-bl" | "sidebyside";

export type BadgeShape = "circle" | "square" | "rounded";

export interface BadgeSettings {
  enabled: boolean;
  shape: BadgeShape;
  bgColor: string;
  bgTransparent: boolean;
  padding: number;
  outlineWidth: number;
  outlineColor: string;
}

export const BADGE_SHAPE_OPTIONS: { value: BadgeShape; label: string }[] = [
  { value: "circle", label: "円形" },
  { value: "square", label: "四角" },
  { value: "rounded", label: "角丸" },
];

export const BADGE_SIZES = [72, 36, 18] as const;
export type BadgeSize = (typeof BADGE_SIZES)[number];

export const DEFAULT_BADGE_SETTINGS: BadgeSettings = {
  enabled: false,
  shape: "circle",
  bgColor: "#9147FF",
  bgTransparent: false,
  padding: 8,
  outlineWidth: 0,
  outlineColor: "#FFFFFF",
};

import { ANIMATION_LIST, TRIAL_ANIMATION_IDS, type AnimationId } from "@/lib/animations/catalog";

/**
 * trial 版で利用可能なアニメ（catalog の `trial: true`、現在 bounce + shake）。
 */
export const TRIAL_ANIMATIONS = TRIAL_ANIMATION_IDS;

export type AnimationSpeed = "slow" | "normal" | "fast";

export type AnimationType = "none" | AnimationId;

export type TextPosition = "top" | "center" | "bottom";

export interface TextPreset {
  id: string;
  label: string;
  text: string;
  subscriberOnly?: boolean;
}

export interface TextConfig {
  preset: string | null;
  customText: string;
  font: string;
  fillColor: string;
  strokeColor: string;
  position: TextPosition;
  fontSize: number;
  offsetX: number;
  offsetY: number;
  outlineWidth: number;
}

export interface OutlineConfig {
  style: BorderStyle;
  width: number;
  color: string;
}

export interface FrameConfig {
  type: FrameType;
}

export interface SubImageConfig {
  mode: CompositeMode;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface AnimationConfig {
  type: AnimationType;
  speed: AnimationSpeed;
}

export interface EmoteConfig {
  outline: OutlineConfig;
  frame: FrameConfig;
  subImage: SubImageConfig;
  text: TextConfig;
  animation: AnimationConfig;
  badge: BadgeSettings;
  /** Canvas padding ratio (0 = no margin, 0.15 = 15% margin). Default 0.02. */
  padding: number;
  /** Content offset X in normalized units (-1 to 1). Default 0. */
  contentOffsetX: number;
  /** Content offset Y in normalized units (-1 to 1). Default 0. */
  contentOffsetY: number;
  /** Content scale multiplier (0.5 to 2.0). Default 1.0. */
  contentScale: number;
  /** Playback speed multiplier for GIF/video sources. 1.0 = original speed.
   *  Higher values shrink frame delays (faster), lower values stretch them.
   *  Ignored for static images and the 52-pattern animation system. */
  animatedSpeed: number;
  /** Loop count for GIF/video output. 0 = infinite, 1 = once, 2 = twice, ...
   *  Ignored for static images. */
  animatedLoopCount: number;
}

/** Animated-source playback options. */
export const ANIMATED_SPEED_PRESETS = [0.5, 1.0, 1.5, 2.0] as const;
export const ANIMATED_SPEED_MIN = 0.25;
export const ANIMATED_SPEED_MAX = 2.0;
export const ANIMATED_SPEED_STEP = 0.25;
export const ANIMATED_LOOP_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "無限ループ" },
  { value: 1, label: "1回のみ" },
  { value: 2, label: "2回" },
  { value: 3, label: "3回" },
];

/** One-level deep partial: top keys optional, nested object keys also optional. */
export type PartialEmoteConfig = {
  [K in keyof EmoteConfig]?: Partial<EmoteConfig[K]>;
};

export type FontCategory = "標準" | "日本語" | "英字";

export const FONT_OPTIONS: { value: string; label: string; category: FontCategory }[] = [
  { value: "Noto Sans JP", label: "Noto Sans JP Bold", category: "標準" },
  // Japanese — gothic / display
  { value: "Dela Gothic One", label: "Dela Gothic One（極太ゴシック）", category: "日本語" },
  { value: "Reggae One", label: "Reggae One（レゲエ）", category: "日本語" },
  { value: "Rampart One", label: "Rampart One（中抜き）", category: "日本語" },
  { value: "Black Han Sans", label: "極太ゴシック", category: "日本語" },
  { value: "RocknRoll One", label: "ロックンロール", category: "日本語" },
  { value: "DotGothic16", label: "ドットゴシック", category: "日本語" },
  { value: "Kaisei Decol", label: "花鳥風月", category: "日本語" },
  { value: "Zen Tokyo Zoo", label: "Zen Tokyo Zoo（装飾）", category: "日本語" },
  { value: "Rock 3D", label: "Rock 3D（3D風）", category: "日本語" },
  // Japanese — mincho
  { value: "Shippori Mincho", label: "しっぽり明朝（端正）", category: "日本語" },
  { value: "Hina Mincho", label: "ひな明朝（細め）", category: "日本語" },
  // Japanese — rounded
  { value: "M PLUS Rounded 1c", label: "M PLUS 丸ゴ（極太）", category: "日本語" },
  { value: "Yusei Magic", label: "ゆうせいマジック（手書き丸文字）", category: "日本語" },
  // Japanese — brush / handwritten
  { value: "Yuji Syuku", label: "Yuji 肅（筆文字）", category: "日本語" },
  { value: "Klee One", label: "Klee One（鉛筆書き風）", category: "日本語" },
  // English — handwritten / pop
  { value: "Permanent Marker", label: "Permanent Marker（手書き）", category: "英字" },
  { value: "Boogaloo", label: "Boogaloo（ポップ英字）", category: "英字" },
  { value: "Lobster", label: "Lobster（筆記体ポップ）", category: "英字" },
  // English — impact
  { value: "Bungee", label: "Bungee（極太装飾）", category: "英字" },
  { value: "Bangers", label: "Bangers（コミック風）", category: "英字" },
  // English — pixel
  { value: "Press Start 2P", label: "Press Start 2P（ピクセル）", category: "英字" },
];

export const TEXT_POSITION_OPTIONS: { value: TextPosition; label: string }[] = [
  { value: "top", label: "上" },
  { value: "center", label: "中央" },
  { value: "bottom", label: "下" },
];

export type ProcessingStage =
  | "idle"
  | "removing-background"
  | "brush-editing"
  | "processing"
  | "generating-preview"
  | "ready"
  | "exporting";

export interface EmoteVariant {
  size: number;
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

export interface BorderOption {
  value: BorderStyle;
  label: string;
  subscriberOnly?: boolean;
}

export const BORDER_OPTIONS: BorderOption[] = [
  { value: "none", label: "なし" },
  { value: "white", label: "白フチ" },
  { value: "black", label: "黒フチ" },
  { value: "shadow", label: "影付き" },
  { value: "custom", label: "カスタム色", subscriberOnly: true },
  // fix6: visual variation styles. All free (no subscriberOnly).
  { value: "neon", label: "ネオン" },
  { value: "double", label: "二重フチ" },
  { value: "sticker", label: "ステッカー風" },
  { value: "outline-only", label: "輪郭のみ" },
  { value: "gradient", label: "グラデ" },
  { value: "chrome", label: "クロム" },
  { value: "dotted", label: "点線" },
];

export interface FrameOption {
  value: FrameType;
  label: string;
  subscriberOnly?: boolean;
}

export const FRAME_OPTIONS: FrameOption[] = [
  { value: "none", label: "なし" },
  { value: "stars", label: "星", subscriberOnly: true },
  { value: "hearts", label: "ハート", subscriberOnly: true },
  { value: "gaming", label: "ゲーミング", subscriberOnly: true },
  { value: "sparkles", label: "キラキラ", subscriberOnly: true },
  { value: "rainbow", label: "レインボー", subscriberOnly: true },
  { value: "dots", label: "ドット", subscriberOnly: true },
  // fix9: simple/structured styles.
  { value: "neon", label: "ネオン", subscriberOnly: true },
  { value: "pixel", label: "レトロ8bit", subscriberOnly: true },
  { value: "gold", label: "金枠", subscriberOnly: true },
  { value: "silver", label: "銀枠", subscriberOnly: true },
  { value: "comic", label: "コミック", subscriberOnly: true },
  // fix9: decorative styles.
  { value: "cat", label: "猫耳", subscriberOnly: true },
  { value: "sakura", label: "桜", subscriberOnly: true },
  { value: "hologram", label: "ホログラム", subscriberOnly: true },
  // fix9: effect styles.
  { value: "fire", label: "ファイア", subscriberOnly: true },
  { value: "coin", label: "実績", subscriberOnly: true },
];

export const COMPOSITE_OPTIONS: { value: CompositeMode; label: string; desc: string }[] = [
  { value: "none", label: "なし", desc: "" },
  { value: "overlay-br", label: "右下に重ねる", desc: "サブ画像を右下に小さく" },
  { value: "overlay-bl", label: "左下に重ねる", desc: "サブ画像を左下に小さく" },
  { value: "sidebyside", label: "左右に並べる", desc: "2枚を横並びに" },
];

export interface AnimationOption {
  value: AnimationType;
  label: string;
  subscriberOnly?: boolean;
}

/**
 * Picker options derived from the catalog (コミット C). `subscriberOnly` now
 * means "not usable in the trial state" — every fixed animation is available
 * with a follow or a passphrase.
 */
export const ANIMATION_OPTIONS: AnimationOption[] = [
  { value: "none", label: "なし（静止画）" },
  ...ANIMATION_LIST.map((a) => ({ value: a.id as AnimationType, label: a.label, subscriberOnly: !a.trial })),
];

export const ANIMATION_SPEED_OPTIONS: { value: AnimationSpeed; label: string }[] = [
  { value: "slow", label: "遅い" },
  { value: "normal", label: "普通" },
  { value: "fast", label: "速い" },
];

