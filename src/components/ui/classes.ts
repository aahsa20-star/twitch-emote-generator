/**
 * Shared class strings for the studio UI (09 §視覚). Kept as plain strings so
 * every component composes the same buttons / panels without a wrapper layer.
 */

export const primaryBtn =
  "inline-flex items-center justify-center gap-2 min-h-[46px] px-[18px] py-3 rounded-[10px] text-[13px] font-bold leading-normal " +
  "bg-studio-accent text-studio-accent-ink hover:bg-[#ddceff] disabled:opacity-45 disabled:cursor-default transition-colors";

export const secondaryBtn =
  "inline-flex items-center justify-center gap-2 min-h-[46px] px-[18px] py-3 rounded-[10px] text-[13px] font-bold leading-normal " +
  "bg-[#2a2833] border border-[#45404f] text-[#ede6f6] hover:bg-[#36313e] disabled:opacity-45 disabled:cursor-default transition-colors";

export const textBtn =
  "inline-flex items-center gap-1 min-h-[36px] px-1.5 py-2 text-[12px] text-studio-accent hover:underline disabled:opacity-45 disabled:no-underline";

export const chipBtn =
  "inline-flex items-center justify-center min-h-[38px] px-3 py-2 rounded-[7px] text-[12px] " +
  "bg-[#2c2934] border border-[#433b4c] text-studio-text hover:bg-[#36313e] transition-colors";

export const chipBtnActive = "border-studio-accent bg-[#352b45] text-studio-accent";

export const panel = "bg-studio-surface border border-studio-stroke rounded-studio";

export const fieldLabel = "block text-[12px] font-semibold text-studio-text mb-2.5";

export const inputCls =
  "w-full min-h-[44px] px-3 py-2.5 rounded-[10px] bg-studio-bg text-studio-text border border-studio-stroke " +
  "placeholder:text-studio-muted focus:outline-none focus-visible:outline";

export const segmented = "inline-flex bg-[#111216] border border-[#36323d] rounded-[8px] p-[3px] gap-[3px]";
export const segmentedBtn = "min-h-[34px] px-3 py-1.5 rounded-[5px] text-[12px] text-studio-muted transition-colors";
export const segmentedBtnActive = "text-studio-text bg-[#41364f]";

/** Style option card (フチ / フレーム). */
export const optionCard =
  "flex flex-col items-center justify-center gap-1.5 min-h-[56px] px-1.5 py-2.5 rounded-[10px] text-[12px] " +
  "bg-[#23212b] border border-[#41394c] text-studio-text hover:bg-[#2c2934] transition-colors";
export const optionCardActive = "border-studio-accent bg-[#352b45]";
export const optionCardLocked = "opacity-50 cursor-not-allowed";
