/**
 * Animation catalog — the single typed list of every fixed animation
 * (コミット C, 04 指示「100種類の仕様」).
 *
 * - `id` is stable and must never change (existing 52 ids preserved).
 * - `label` / `category` / `tags` drive the picker (分類・検索・お気に入り).
 * - `trial` marks the two animations usable in the trial state (bounce / shake).
 * - Generators live in `index.ts`; `AnimationId` is derived from this list so a
 *   missing generator is a *type error* (定義と選択肢と実装の不整合を検出).
 *
 * No DOM / no generators here: safe to import from server code and tests.
 */

export type AnimationCategory =
  | "basic"      // 基本の動き
  | "motion"     // 移動・軌道
  | "effect"     // 映像エフェクト
  | "reaction"   // 感情・リアクション
  | "entrance"   // 登場・退場
  | "decor"      // 記号・装飾
  | "scene"      // 季節・情景
  | "transform"; // 変形・分割

export const ANIMATION_CATEGORIES: ReadonlyArray<{ id: AnimationCategory; label: string }> = [
  { id: "basic", label: "基本" },
  { id: "motion", label: "移動" },
  { id: "effect", label: "エフェクト" },
  { id: "reaction", label: "リアクション" },
  { id: "entrance", label: "登場" },
  { id: "decor", label: "記号・装飾" },
  { id: "scene", label: "情景" },
  { id: "transform", label: "変形" },
];

export interface AnimationCatalogEntry {
  id: string;
  label: string;
  category: AnimationCategory;
  /** Search keywords (Japanese + English). */
  tags: readonly string[];
  /** Usable in the trial state (SITE_LOCK_ENABLED=false, not unlocked). */
  trial?: boolean;
  /** "v1" = original 52, "v2" = 2026-09 additions (05 設計案). */
  since: "v1" | "v2";
  /**
   * Representative frame (0..19) for the static card. Entrance / reveal
   * animations are empty on frame 0, so they name a frame from their hold
   * phase (R2 §3). Default 0.
   */
  previewFrame?: number;
}

const E = <T extends readonly AnimationCatalogEntry[]>(list: T) => list;

export const ANIMATION_CATALOG = E([
  // ---------------- v1 (52) — ids preserved ----------------
  { id: "sway", label: "揺れる", category: "basic", tags: ["ゆらゆら", "sway", "rotate"], since: "v1" },
  { id: "shake", label: "震える", category: "basic", tags: ["ぶるぶる", "shake", "vibrate"], trial: true, since: "v1" },
  { id: "blink", label: "点滅", category: "basic", tags: ["ちかちか", "blink", "fade"], since: "v1" },
  { id: "bounce", label: "ぴょこぴょこ", category: "basic", tags: ["ジャンプ", "bounce", "hop"], trial: true, since: "v1" },
  { id: "zoomin", label: "ズームイン", category: "basic", tags: ["拡大", "zoom", "scale"], since: "v1" },
  { id: "spin", label: "回転", category: "basic", tags: ["くるくる", "spin", "rotate"], since: "v1" },
  { id: "hearts", label: "ハートぷかぷか", category: "decor", tags: ["ハート", "heart", "love"], since: "v1", previewFrame: 5 },
  { id: "gaming", label: "ゲーミング", category: "effect", tags: ["虹", "rainbow", "rgb", "hue"], since: "v1" },
  { id: "glitch", label: "グリッチ", category: "effect", tags: ["ノイズ", "glitch", "digital"], since: "v1" },
  { id: "sparkle", label: "キラキラ", category: "decor", tags: ["星", "sparkle", "shine"], since: "v1", previewFrame: 4 },
  { id: "afterimage", label: "残像", category: "effect", tags: ["ブレ", "afterimage", "ghost"], since: "v1" },
  { id: "fastspin", label: "高速回転", category: "motion", tags: ["回転", "spin", "fast"], since: "v1" },
  { id: "float", label: "ふわふわ", category: "basic", tags: ["浮く", "float", "hover"], since: "v1" },
  { id: "wobble", label: "ぐにゃぐにゃ", category: "transform", tags: ["歪む", "wobble", "warp"], since: "v1" },
  { id: "neon", label: "ネオン", category: "effect", tags: ["光る", "neon", "glow"], since: "v1" },
  { id: "vhs", label: "VHS", category: "effect", tags: ["レトロ", "vhs", "tape"], since: "v1" },
  { id: "snow", label: "雪", category: "scene", tags: ["冬", "snow", "winter"], since: "v1" },
  { id: "fire", label: "炎", category: "scene", tags: ["火", "fire", "burn"], since: "v1" },
  { id: "matrix", label: "マトリックス", category: "effect", tags: ["コード", "matrix", "digital"], since: "v1" },
  { id: "drunk", label: "酔っ払い", category: "motion", tags: ["ふらふら", "drunk", "dizzy"], since: "v1" },
  { id: "confetti", label: "紙吹雪", category: "decor", tags: ["祝", "confetti", "party"], since: "v1", previewFrame: 5 },
  { id: "hypno", label: "催眠", category: "effect", tags: ["渦", "hypno", "spiral"], since: "v1" },
  { id: "tv", label: "ブラウン管", category: "effect", tags: ["テレビ", "tv", "crt"], since: "v1" },
  { id: "earthquake", label: "地震", category: "motion", tags: ["揺れ", "earthquake", "quake"], since: "v1" },
  { id: "party", label: "パーティ", category: "effect", tags: ["色", "party", "flash"], since: "v1" },
  { id: "flip", label: "ひっくり返る", category: "transform", tags: ["反転", "flip"], since: "v1" },
  { id: "ghost", label: "幽霊", category: "effect", tags: ["透明", "ghost", "fade"], since: "v1" },
  { id: "glitch2", label: "デジタル崩壊", category: "effect", tags: ["崩れる", "glitch", "corrupt"], since: "v1" },
  { id: "spiral", label: "スパイラル", category: "motion", tags: ["渦巻き", "spiral"], since: "v1" },
  { id: "heartbeat", label: "鼓動", category: "basic", tags: ["ドキドキ", "heartbeat", "pulse"], since: "v1" },
  { id: "spring", label: "バネ", category: "transform", tags: ["びよーん", "spring", "boing"], since: "v1" },
  { id: "jelly", label: "ジェリー", category: "transform", tags: ["ぷるぷる", "jelly", "wiggle"], since: "v1" },
  { id: "stretch", label: "伸び縮み", category: "transform", tags: ["伸びる", "stretch"], since: "v1" },
  { id: "fall", label: "落下", category: "motion", tags: ["落ちる", "fall", "drop"], since: "v1" },
  { id: "inflate", label: "膨らむ", category: "transform", tags: ["ふくらむ", "inflate", "balloon"], since: "v1" },
  { id: "tilt", label: "傾く", category: "basic", tags: ["かたむく", "tilt", "lean"], since: "v1" },
  { id: "bobbing", label: "浮き沈み", category: "basic", tags: ["ぷかぷか", "bobbing", "wave"], since: "v1" },
  { id: "hologram", label: "ホログラム", category: "effect", tags: ["SF", "hologram", "scanline"], since: "v1" },
  { id: "pixelate", label: "ピクセル化", category: "effect", tags: ["モザイク", "pixelate", "8bit"], since: "v1" },
  { id: "kaleidoscope", label: "万華鏡", category: "effect", tags: ["鏡", "kaleidoscope", "mirror"], since: "v1" },
  { id: "electric", label: "電流", category: "effect", tags: ["ビリビリ", "electric", "lightning"], since: "v1" },
  { id: "static", label: "砂嵐", category: "effect", tags: ["ノイズ", "static", "noise"], since: "v1" },
  { id: "ricochet", label: "弾む", category: "motion", tags: ["跳ね返る", "ricochet", "bounce"], since: "v1" },
  { id: "figure8", label: "8の字", category: "motion", tags: ["∞", "figure8", "infinity"], since: "v1" },
  { id: "spiralfall", label: "螺旋落下", category: "motion", tags: ["落ちる", "spiral", "fall"], since: "v1" },
  { id: "randomwarp", label: "ランダムワープ", category: "motion", tags: ["瞬間移動", "warp", "teleport"], since: "v1" },
  { id: "stagger", label: "酔い歩き", category: "motion", tags: ["よろける", "stagger"], since: "v1" },
  { id: "angry", label: "怒る", category: "reaction", tags: ["💢", "angry", "mad"], since: "v1", previewFrame: 3 },
  { id: "cry", label: "泣く", category: "reaction", tags: ["涙", "cry", "sad"], since: "v1", previewFrame: 5 },
  { id: "blush", label: "照れる", category: "reaction", tags: ["赤面", "blush", "shy"], since: "v1", previewFrame: 5 },
  { id: "surprise", label: "驚く", category: "reaction", tags: ["！", "surprise", "shock"], since: "v1", previewFrame: 3 },
  { id: "sleepy", label: "眠る", category: "reaction", tags: ["zzz", "sleepy", "sleep"], since: "v1", previewFrame: 8 },

  // ---------------- v2 (48) — 05 設計案 ----------------
  // reactions
  { id: "bow", label: "おじぎ", category: "reaction", tags: ["礼", "bow", "thanks"], since: "v2", previewFrame: 7 },
  { id: "laugh-burst", label: "大笑い", category: "reaction", tags: ["笑", "laugh", "lol", "www"], since: "v2", previewFrame: 5 },
  { id: "sweat", label: "あせあせ", category: "reaction", tags: ["汗", "sweat", "nervous"], since: "v2", previewFrame: 6 },
  { id: "thinking", label: "考え中", category: "reaction", tags: ["…", "thinking", "hmm"], since: "v2", previewFrame: 12 },
  { id: "question", label: "はてな", category: "reaction", tags: ["？", "question", "confused"], since: "v2", previewFrame: 6 },
  { id: "idea", label: "ひらめき", category: "reaction", tags: ["電球", "idea", "bulb"], since: "v2", previewFrame: 10 },
  { id: "defeated", label: "がっくり", category: "reaction", tags: ["落胆", "defeated", "orz"], since: "v2", previewFrame: 10 },
  { id: "proud", label: "どやっ", category: "reaction", tags: ["ドヤ", "proud", "smug"], since: "v2", previewFrame: 8 },
  // entrance
  { id: "peek-left", label: "横からちらっ", category: "entrance", tags: ["覗く", "peek", "hide"], since: "v2", previewFrame: 9 },
  { id: "peek-bottom", label: "下からちらっ", category: "entrance", tags: ["覗く", "peek", "bottom"], since: "v2", previewFrame: 9 },
  { id: "curtain-open", label: "幕あけ", category: "entrance", tags: ["カーテン", "curtain", "reveal"], since: "v2", previewFrame: 10 },
  { id: "iris-open", label: "丸く登場", category: "entrance", tags: ["円", "iris", "circle"], since: "v2", previewFrame: 10 },
  { id: "diagonal-reveal", label: "ななめ登場", category: "entrance", tags: ["斜め", "diagonal", "wipe"], since: "v2", previewFrame: 10 },
  { id: "stamp", label: "ぺたん", category: "entrance", tags: ["押印", "stamp", "slam"], since: "v2", previewFrame: 10 },
  { id: "paper-unfold", label: "パタンと開く", category: "entrance", tags: ["折り紙", "unfold", "paper"], since: "v2", previewFrame: 10 },
  { id: "teleport-ring", label: "転送", category: "entrance", tags: ["ワープ", "teleport", "beam"], since: "v2", previewFrame: 12 },
  // motion
  { id: "orbit", label: "円を描く", category: "motion", tags: ["円軌道", "orbit", "circle"], since: "v2" },
  { id: "zigzag", label: "ジグザグ", category: "motion", tags: ["折れ線", "zigzag"], since: "v2" },
  { id: "stairs", label: "階段のぼり", category: "motion", tags: ["階段", "stairs", "climb"], since: "v2", previewFrame: 6 },
  { id: "roll-across", label: "ころころ移動", category: "motion", tags: ["転がる", "roll"], since: "v2" },
  { id: "swing-rope", label: "ブランコ", category: "motion", tags: ["振り子", "swing", "pendulum"], since: "v2" },
  { id: "slingshot", label: "ひっぱって発射", category: "motion", tags: ["パチンコ", "slingshot", "launch"], since: "v2", previewFrame: 4 },
  { id: "crawl", label: "もぞもぞ", category: "motion", tags: ["這う", "crawl", "worm"], since: "v2" },
  { id: "orbit-pair", label: "分身まわり", category: "motion", tags: ["分身", "clone", "orbit"], since: "v2" },
  // decor
  { id: "speech-pop", label: "ふきだし", category: "decor", tags: ["吹き出し", "speech", "talk"], since: "v2", previewFrame: 12 },
  { id: "applause", label: "拍手", category: "decor", tags: ["👏", "applause", "clap"], since: "v2", previewFrame: 5 },
  { id: "cheer-rays", label: "応援", category: "decor", tags: ["がんばれ", "cheer", "rays"], since: "v2", previewFrame: 3 },
  { id: "crown", label: "王冠", category: "decor", tags: ["👑", "crown", "king"], since: "v2", previewFrame: 12 },
  { id: "checkmark", label: "オッケー", category: "decor", tags: ["✓", "ok", "check"], since: "v2", previewFrame: 10 },
  { id: "crossmark", label: "ダメ", category: "decor", tags: ["✗", "no", "cross"], since: "v2", previewFrame: 6 },
  { id: "exclamation", label: "注目", category: "decor", tags: ["！", "exclamation", "alert"], since: "v2", previewFrame: 5 },
  { id: "loading-dots", label: "待機中", category: "decor", tags: ["…", "loading", "wait"], since: "v2", previewFrame: 2 },
  // scene
  { id: "sakura-petals", label: "桜吹雪", category: "scene", tags: ["春", "sakura", "petal"], since: "v2" },
  { id: "autumn-leaves", label: "木の葉", category: "scene", tags: ["秋", "leaf", "autumn"], since: "v2" },
  { id: "underwater", label: "水の中", category: "scene", tags: ["泡", "underwater", "bubble"], since: "v2" },
  { id: "rain-umbrella", label: "雨やどり", category: "scene", tags: ["傘", "rain", "umbrella"], since: "v2" },
  { id: "sun-rise", label: "日の出", category: "scene", tags: ["太陽", "sunrise", "sun"], since: "v2", previewFrame: 8 },
  { id: "shooting-star", label: "流れ星", category: "scene", tags: ["星", "shooting star", "night"], since: "v2", previewFrame: 6 },
  { id: "moon-cloud", label: "月と雲", category: "scene", tags: ["夜", "moon", "cloud"], since: "v2" },
  { id: "flower-bloom", label: "花が咲く", category: "scene", tags: ["花", "flower", "bloom"], since: "v2", previewFrame: 12 },
  // transform
  { id: "sticker-peel", label: "シールめくり", category: "transform", tags: ["めくれる", "sticker", "peel"], since: "v2", previewFrame: 8 },
  { id: "contour-trace", label: "ふちを描く", category: "transform", tags: ["輪郭", "outline", "trace"], since: "v2", previewFrame: 11 },
  { id: "puzzle-assemble", label: "パズル", category: "transform", tags: ["組み立て", "puzzle", "assemble"], since: "v2", previewFrame: 12 },
  { id: "tile-slide", label: "タイル入替", category: "transform", tags: ["タイル", "tile", "slide"], since: "v2", previewFrame: 3 },
  { id: "brush-reveal", label: "筆で登場", category: "entrance", tags: ["筆", "brush", "paint"], since: "v2", previewFrame: 14 },
  { id: "page-turn", label: "ページめくり", category: "transform", tags: ["本", "page", "turn"], since: "v2", previewFrame: 5 },
  { id: "venetian-blinds", label: "ブラインド", category: "transform", tags: ["ブラインド", "blinds", "stripes"], since: "v2", previewFrame: 10 },
  { id: "ripple-ring", label: "波紋", category: "transform", tags: ["波", "ripple", "water"], since: "v2", previewFrame: 5 },
] as const);

export type AnimationId = (typeof ANIMATION_CATALOG)[number]["id"];

/** Catalog entry with a narrowed id (use this for iteration / UI). */
export type CatalogEntry = Omit<AnimationCatalogEntry, "id"> & { id: AnimationId };

/** Same list, widened to the interface so optional fields are uniformly typed. */
export const ANIMATION_LIST: readonly CatalogEntry[] = ANIMATION_CATALOG;

export const ANIMATION_COUNT = ANIMATION_LIST.length;

export const TRIAL_ANIMATION_IDS: readonly AnimationId[] = ANIMATION_LIST.filter((a) => a.trial).map((a) => a.id);

export function getAnimationEntry(id: string): CatalogEntry | undefined {
  return ANIMATION_LIST.find((a) => a.id === id);
}

export function isAnimationId(id: unknown): id is AnimationId {
  return typeof id === "string" && ANIMATION_CATALOG.some((a) => a.id === id);
}

/** Normalize for search: lowercase, NFKC, remove spaces. */
function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export interface AnimationFilter {
  query?: string;
  category?: AnimationCategory | "all" | "favorites";
  favorites?: ReadonlySet<string>;
}

export function filterAnimations(filter: AnimationFilter): CatalogEntry[] {
  const q = norm(filter.query ?? "");
  return ANIMATION_LIST.filter((a) => {
    if (filter.category === "favorites") {
      if (!filter.favorites?.has(a.id)) return false;
    } else if (filter.category && filter.category !== "all" && a.category !== filter.category) {
      return false;
    }
    if (!q) return true;
    const cat = ANIMATION_CATEGORIES.find((c) => c.id === a.category)?.label ?? "";
    return [a.id, a.label, cat, ...a.tags].some((t) => norm(t).includes(q));
  });
}
