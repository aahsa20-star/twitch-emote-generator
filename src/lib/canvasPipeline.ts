/**
 * Re-export barrel — preserves all existing `import { ... } from '@/lib/canvasPipeline'` paths.
 * Actual implementations live in src/lib/canvas/*.ts
 */
export { HI_RES, GIF_HI_RES, releaseCanvas } from "./canvas/types";
export type { TextOverlayOptions, Bounds } from "./canvas/types";
export { centerAndResize, centerAndResizeWithBounds, computeUnionBounds } from "./canvas/backgroundRemoval";
export type { ContentAdjustment } from "./canvas/backgroundRemoval";
export { applyBorder, applyTextOverlay, compositeImages, applyFrame, renderBadge } from "./canvas/drawing";
export { downscale, processEmote, processEmoteWithHiRes, processFrameWithBounds } from "./canvas/pipeline";
