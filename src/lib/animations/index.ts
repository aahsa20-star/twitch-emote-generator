/**
 * Animation registry and GIF generation entry point.
 *
 * To add a new animation (コミット C):
 * 1. Add its entry to `catalog.ts` (id / label / category / tags)
 * 2. Implement a FrameGenerator in a category file
 * 3. Add it to `generators` below — the map is typed `Record<AnimationId, …>`,
 *    so a catalog id without a generator (or vice versa) is a compile error.
 */
import { AnimationType, AnimationSpeed } from "@/types/emote";
import { ANIMATION_CATALOG, type AnimationId } from "./catalog";
import { downscale } from "@/lib/canvasPipeline";
import { canvasesToFrames, encodeGifFrames, type EncodeJobOptions } from "@/lib/gif/encode";

import type { FrameGenerator } from "./types";

// Basic animations
import {
  createSwayFrame,
  createShakeFrame,
  createBlinkFrame,
  createBounceFrame,
  createZoomInFrame,
  createSpinFrame,
  createHeartsFrame,
  createStretchFrame,
  createFallFrame,
  createInflateFrame,
  createTiltFrame,
  createBobbingFrame,
} from "./basic";

// Effect animations
import {
  createGamingFrame,
  createGlitchFrame,
  createSparkleFrame,
  createAfterimageFrame,
  createNeonFrame,
  createVhsFrame,
  createMatrixFrame,
  createHologramFrame,
  createPixelateFrame,
  createKaleidoscopeFrame,
  createElectricFrame,
  createStaticFrame,
} from "./effects";

// Motion animations
import {
  createFastSpinFrame,
  createFloatFrame,
  createWobbleFrame,
  createDrunkFrame,
  createConfettiFrame,
  createHypnoFrame,
  createSnowFrame,
  createFireFrame,
  createTvFrame,
  createEarthquakeFrame,
  createPartyFrame,
  createFlipFrame,
  createGhostFrame,
  createGlitch2Frame,
  createSpiralFrame,
  createHeartbeatFrame,
  createSpringFrame,
  createJellyFrame,
  createRicochetFrame,
  createFigure8Frame,
  createSpiralFallFrame,
  createRandomWarpFrame,
  createStaggerFrame,
} from "./motion";

// Reaction animations
import {
  createAngryFrame,
  createCryFrame,
  createBlushFrame,
  createSurpriseFrame,
  createSleepyFrame,
} from "./reactions";

// v2 (2026-09, 05 設計案)
import {
  createBowFrame, createLaughBurstFrame, createSweatFrame, createThinkingFrame,
  createQuestionFrame, createIdeaFrame, createDefeatedFrame, createProudFrame,
} from "./v2-reactions";
import {
  createPeekLeftFrame, createPeekBottomFrame, createCurtainOpenFrame, createIrisOpenFrame,
  createDiagonalRevealFrame, createStampFrame, createPaperUnfoldFrame, createTeleportRingFrame,
  createBrushRevealFrame,
} from "./v2-entrance";
import {
  createOrbitFrame, createZigzagFrame, createStairsFrame, createRollAcrossFrame,
  createSwingRopeFrame, createSlingshotFrame, createCrawlFrame, createOrbitPairFrame,
} from "./v2-motion";
import {
  createSpeechPopFrame, createApplauseFrame, createCheerRaysFrame, createCrownFrame,
  createCheckmarkFrame, createCrossmarkFrame, createExclamationFrame, createLoadingDotsFrame,
} from "./v2-decor";
import {
  createSakuraPetalsFrame, createAutumnLeavesFrame, createUnderwaterFrame, createRainUmbrellaFrame,
  createSunRiseFrame, createShootingStarFrame, createMoonCloudFrame, createFlowerBloomFrame,
} from "./v2-scene";
import {
  createStickerPeelFrame, createContourTraceFrame, createPuzzleAssembleFrame, createTileSlideFrame,
  createPageTurnFrame, createVenetianBlindsFrame, createRippleRingFrame,
} from "./v2-transform";

/** Animation id -> frame generator. Typed against the catalog. */
export const generators: Record<AnimationId, FrameGenerator> = {
  // Basic
  sway: createSwayFrame,
  shake: createShakeFrame,
  blink: createBlinkFrame,
  bounce: createBounceFrame,
  zoomin: createZoomInFrame,
  spin: createSpinFrame,
  hearts: createHeartsFrame,
  // Effects
  gaming: createGamingFrame,
  glitch: createGlitchFrame,
  sparkle: createSparkleFrame,
  afterimage: createAfterimageFrame,
  neon: createNeonFrame,
  vhs: createVhsFrame,
  matrix: createMatrixFrame,
  // Motion
  fastspin: createFastSpinFrame,
  float: createFloatFrame,
  wobble: createWobbleFrame,
  drunk: createDrunkFrame,
  confetti: createConfettiFrame,
  hypno: createHypnoFrame,
  snow: createSnowFrame,
  fire: createFireFrame,
  tv: createTvFrame,
  earthquake: createEarthquakeFrame,
  party: createPartyFrame,
  flip: createFlipFrame,
  ghost: createGhostFrame,
  glitch2: createGlitch2Frame,
  spiral: createSpiralFrame,
  heartbeat: createHeartbeatFrame,
  spring: createSpringFrame,
  jelly: createJellyFrame,
  // Basic (new)
  stretch: createStretchFrame,
  fall: createFallFrame,
  inflate: createInflateFrame,
  tilt: createTiltFrame,
  bobbing: createBobbingFrame,
  // Effects (new)
  hologram: createHologramFrame,
  pixelate: createPixelateFrame,
  kaleidoscope: createKaleidoscopeFrame,
  electric: createElectricFrame,
  static: createStaticFrame,
  // Motion (new)
  ricochet: createRicochetFrame,
  figure8: createFigure8Frame,
  spiralfall: createSpiralFallFrame,
  randomwarp: createRandomWarpFrame,
  stagger: createStaggerFrame,
  // Reactions (new)
  angry: createAngryFrame,
  cry: createCryFrame,
  blush: createBlushFrame,
  surprise: createSurpriseFrame,
  sleepy: createSleepyFrame,
  // v2 reactions
  bow: createBowFrame,
  "laugh-burst": createLaughBurstFrame,
  sweat: createSweatFrame,
  thinking: createThinkingFrame,
  question: createQuestionFrame,
  idea: createIdeaFrame,
  defeated: createDefeatedFrame,
  proud: createProudFrame,
  // v2 entrance
  "peek-left": createPeekLeftFrame,
  "peek-bottom": createPeekBottomFrame,
  "curtain-open": createCurtainOpenFrame,
  "iris-open": createIrisOpenFrame,
  "diagonal-reveal": createDiagonalRevealFrame,
  stamp: createStampFrame,
  "paper-unfold": createPaperUnfoldFrame,
  "teleport-ring": createTeleportRingFrame,
  "brush-reveal": createBrushRevealFrame,
  // v2 motion
  orbit: createOrbitFrame,
  zigzag: createZigzagFrame,
  stairs: createStairsFrame,
  "roll-across": createRollAcrossFrame,
  "swing-rope": createSwingRopeFrame,
  slingshot: createSlingshotFrame,
  crawl: createCrawlFrame,
  "orbit-pair": createOrbitPairFrame,
  // v2 decor
  "speech-pop": createSpeechPopFrame,
  applause: createApplauseFrame,
  "cheer-rays": createCheerRaysFrame,
  crown: createCrownFrame,
  checkmark: createCheckmarkFrame,
  crossmark: createCrossmarkFrame,
  exclamation: createExclamationFrame,
  "loading-dots": createLoadingDotsFrame,
  // v2 scene
  "sakura-petals": createSakuraPetalsFrame,
  "autumn-leaves": createAutumnLeavesFrame,
  underwater: createUnderwaterFrame,
  "rain-umbrella": createRainUmbrellaFrame,
  "sun-rise": createSunRiseFrame,
  "shooting-star": createShootingStarFrame,
  "moon-cloud": createMoonCloudFrame,
  "flower-bloom": createFlowerBloomFrame,
  // v2 transform
  "sticker-peel": createStickerPeelFrame,
  "contour-trace": createContourTraceFrame,
  "puzzle-assemble": createPuzzleAssembleFrame,
  "tile-slide": createTileSlideFrame,
  "page-turn": createPageTurnFrame,
  "venetian-blinds": createVenetianBlindsFrame,
  "ripple-ring": createRippleRingFrame,
};

/** Frame generator for an id (undefined for "none" / unknown). */
export function getFrameGenerator(id: AnimationType): FrameGenerator | undefined {
  return id === "none" ? undefined : generators[id as AnimationId];
}

/** Runtime consistency check used by tests and the dev page. */
export function registryConsistency(): { ok: boolean; missing: string[]; extra: string[]; count: number } {
  const ids = new Set(ANIMATION_CATALOG.map((a) => a.id));
  const impl = new Set(Object.keys(generators));
  const missing = [...ids].filter((i) => !impl.has(i));
  const extra = [...impl].filter((i) => !ids.has(i as AnimationId));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra, count: ids.size };
}

export const FRAME_COUNT = 20;
export { SPEED_DELAY };

const SPEED_DELAY: Record<AnimationSpeed, number> = {
  slow: 80,
  normal: 50,
  fast: 25,
};

/**
 * Generate an animated GIF.
 * When hiResCanvas is provided, frames are generated at hi-res and downscaled
 * to the output size for sharper animation quality.
 */
export async function generateGif(
  baseCanvas: HTMLCanvasElement,
  animationType: AnimationType,
  size: number,
  speed: AnimationSpeed = "normal",
  hiResCanvas?: HTMLCanvasElement,
  jobOpts: EncodeJobOptions = {}
): Promise<Blob> {
  const generator = getFrameGenerator(animationType);
  if (!generator) {
    throw new Error(`No animation generator for: ${animationType}`);
  }

  // Use hi-res source if available, otherwise fall back to output-size canvas
  const sourceCanvas = hiResCanvas ?? baseCanvas;
  const needsDownscale = sourceCanvas.width > size;

  const totalFrames = FRAME_COUNT;
  const frameDelay = SPEED_DELAY[speed];

  // Render every frame first (元画像は読むだけ), then flatten alpha with a
  // per-GIF sentinel so opaque black never becomes transparent (B12).
  const frameCanvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const hiResFrame = generator(sourceCanvas, i, totalFrames);
    let outputFrame: HTMLCanvasElement;
    if (needsDownscale) {
      outputFrame = downscale(hiResFrame, size);
      hiResFrame.width = 0;
      hiResFrame.height = 0;
    } else {
      outputFrame = hiResFrame;
    }
    frameCanvases.push(outputFrame);
  }
  const delays = frameCanvases.map(() => frameDelay);
  try {
    // R2 §1: index-level transparency. 07 §1: canvases stay alive until the
    // encode settles so a worker crash can rebuild the frames from them.
    const { blob } = await encodeGifFrames(
      canvasesToFrames(frameCanvases, delays),
      { repeat: 0, quality: 10, dither: "FloydSteinberg" },
      { ...jobOpts, rebuild: () => canvasesToFrames(frameCanvases, delays) },
    );
    return blob;
  } finally {
    for (const fc of frameCanvases) {
      fc.width = 0;
      fc.height = 0;
    }
  }
}
