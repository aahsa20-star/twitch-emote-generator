/**
 * Re-export barrel — preserves all existing `import { ... } from '@/lib/canvasPipeline'` paths.
 * Actual implementations live in src/lib/canvas/*.ts
 */
export { HI_RES, GIF_HI_RES, releaseCanvas } from "./canvas/types";
export type { TextOverlayOptions } from "./canvas/types";
export { centerAndResize } from "./canvas/backgroundRemoval";
export { applyBorder, applyTextOverlay, compositeImages, applyFrame, renderBadge } from "./canvas/drawing";
export { downscale, processEmote, processEmoteWithHiRes } from "./canvas/pipeline";
