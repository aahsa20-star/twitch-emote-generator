export const EMOTE_SIZES = [28, 56, 112] as const;
export type EmoteSize = (typeof EMOTE_SIZES)[number];

export const DISCORD_SIZES = [32, 64, 128] as const;
export type DiscordSize = (typeof DISCORD_SIZES)[number];

export const SEVENTV_SIZES = [32, 64, 96, 128] as const;
export type SeventvSize = (typeof SEVENTV_SIZES)[number];

export type ExportMode = "twitch" | "discord" | "7tv" | "bttv" | "ffz";

export type BgRemovalQuality = "speed" | "quality";

export type BorderStyle = "none" | "white" | "black" | "shadow" | "custom";

export type FrameType =
  | "none"
  | "stars"
  | "hearts"
  | "gaming"
  | "sparkles"
  | "rainbow"
  | "dots";

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

export type AnimationSpeed = "slow" | "normal" | "fast";

export type AnimationType = "none" | "sway" | "shake" | "blink" | "bounce" | "zoomin" | "spin" | "hearts"
  | "gaming" | "glitch" | "sparkle" | "afterimage" | "fastspin"
  | "float" | "wobble" | "neon" | "vhs" | "snow" | "fire" | "matrix" | "drunk" | "confetti" | "hypno"
  | "tv" | "earthquake" | "party" | "flip" | "ghost" | "glitch2" | "spiral" | "heartbeat" | "spring"
  | "jelly"
  | "stretch" | "fall" | "inflate" | "tilt" | "bobbing"
  | "hologram" | "pixelate" | "kaleidoscope" | "electric" | "static"
  | "ricochet" | "figure8" | "spiralfall" | "randomwarp" | "stagger"
  | "angry" | "cry" | "blush" | "surprise" | "sleepy"
  | "ai-custom";

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
  /** AI生成コード文字列（type === "ai-custom" 時のみ使用） */
  aiAnimationCode?: string;
}

export interface EmoteConfig {
  outline: OutlineConfig;
  frame: FrameConfig;
  subImage: SubImageConfig;
  text: TextConfig;
  animation: AnimationConfig;
  badge: BadgeSettings;
  /** Canvas padding ratio (0 = no margin, 0.15 = 15% margin). Default 0.05. */
  padding: number;
  /** Content offset X in normalized units (-1 to 1). Default 0. */
  contentOffsetX: number;
  /** Content offset Y in normalized units (-1 to 1). Default 0. */
  contentOffsetY: number;
  /** Content scale multiplier (0.5 to 2.0). Default 1.0. */
  contentScale: number;
}

/** One-level deep partial: top keys optional, nested object keys also optional. */
export type PartialEmoteConfig = {
  [K in keyof EmoteConfig]?: Partial<EmoteConfig[K]>;
};

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
  loginOnly?: boolean;
}

export const ANIMATION_OPTIONS: AnimationOption[] = [
  { value: "none", label: "なし（静止画）" },
  { value: "sway", label: "揺れる" },
  { value: "shake", label: "震える" },
  { value: "blink", label: "点滅" },
  { value: "bounce", label: "ぴょこぴょこ" },
  { value: "zoomin", label: "ズームイン" },
  { value: "spin", label: "回転" },
  { value: "hearts", label: "ハートぷかぷか" },
  { value: "gaming", label: "ゲーミング", loginOnly: true },
  { value: "glitch", label: "グリッチ", loginOnly: true },
  { value: "sparkle", label: "キラキラ", subscriberOnly: true },
  { value: "afterimage", label: "残像", subscriberOnly: true },
  { value: "fastspin", label: "高速回転", subscriberOnly: true },
  { value: "float", label: "ふわふわ", subscriberOnly: true },
  { value: "wobble", label: "ぐにゃぐにゃ", subscriberOnly: true },
  { value: "neon", label: "ネオン", loginOnly: true },
  { value: "vhs", label: "VHS", subscriberOnly: true },
  { value: "snow", label: "雪", subscriberOnly: true },
  { value: "fire", label: "炎", subscriberOnly: true },
  { value: "matrix", label: "マトリックス", subscriberOnly: true },
  { value: "drunk", label: "酔っ払い", subscriberOnly: true },
  { value: "confetti", label: "紙吹雪", subscriberOnly: true },
  { value: "hypno", label: "催眠", subscriberOnly: true },
  { value: "tv", label: "ブラウン管", subscriberOnly: true },
  { value: "earthquake", label: "地震", subscriberOnly: true },
  { value: "party", label: "パーティ", subscriberOnly: true },
  { value: "flip", label: "ひっくり返る", subscriberOnly: true },
  { value: "ghost", label: "幽霊", subscriberOnly: true },
  { value: "glitch2", label: "デジタル崩壊", subscriberOnly: true },
  { value: "spiral", label: "スパイラル", subscriberOnly: true },
  { value: "heartbeat", label: "鼓動", subscriberOnly: true },
  { value: "spring", label: "バネ", subscriberOnly: true },
  { value: "jelly", label: "ジェリー", subscriberOnly: true },
  // New basic
  { value: "stretch", label: "伸び縮み", subscriberOnly: true },
  { value: "fall", label: "落下", subscriberOnly: true },
  { value: "inflate", label: "膨らむ", subscriberOnly: true },
  { value: "tilt", label: "傾く", subscriberOnly: true },
  { value: "bobbing", label: "浮き沈み", subscriberOnly: true },
  // New effects
  { value: "hologram", label: "ホログラム", subscriberOnly: true },
  { value: "pixelate", label: "ピクセル化", subscriberOnly: true },
  { value: "kaleidoscope", label: "万華鏡", subscriberOnly: true },
  { value: "electric", label: "電流", subscriberOnly: true },
  { value: "static", label: "砂嵐", subscriberOnly: true },
  // New motion
  { value: "ricochet", label: "弾む", subscriberOnly: true },
  { value: "figure8", label: "8の字", subscriberOnly: true },
  { value: "spiralfall", label: "螺旋落下", subscriberOnly: true },
  { value: "randomwarp", label: "ランダムワープ", subscriberOnly: true },
  { value: "stagger", label: "酔い歩き", subscriberOnly: true },
  // Reactions
  { value: "angry", label: "怒る", subscriberOnly: true },
  { value: "cry", label: "泣く", subscriberOnly: true },
  { value: "blush", label: "照れる", subscriberOnly: true },
  { value: "surprise", label: "驚く", subscriberOnly: true },
  { value: "sleepy", label: "眠る", subscriberOnly: true },
];

export const ANIMATION_SPEED_OPTIONS: { value: AnimationSpeed; label: string }[] = [
  { value: "slow", label: "遅い" },
  { value: "normal", label: "普通" },
  { value: "fast", label: "速い" },
];

// --- Template Gallery types ---

export const TEMPLATE_TAGS = [
  "ゲーミング", "かわいい", "シンプル", "面白い", "クール", "その他",
] as const;
export type TemplateTag = (typeof TEMPLATE_TAGS)[number];

export interface Template {
  id: string;
  user_id: string;
  user_name: string;
  user_login?: string | null;
  user_image?: string | null;
  title: string;
  tags: string[];
  config: EmoteConfig;
  likes_count: number;
  created_at: string;
  liked_by_me?: boolean;
}
