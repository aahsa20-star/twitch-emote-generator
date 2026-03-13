/**
 * Animation registry and GIF generation entry point.
 *
 * To add a new animation:
 * 1. Create a FrameGenerator function in the appropriate category file (basic/effects/motion)
 * 2. Export it from that file
 * 3. Import it here and add it to the `generators` registry
 * 4. Add the animation type to AnimationType in types/emote.ts
 */
import { AnimationType, AnimationSpeed } from "@/types/emote";
import { downscale } from "@/lib/canvasPipeline";
import GIF from "gif.js";

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

/** Animation name -> frame generator mapping */
const generators: Record<string, FrameGenerator> = {
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
};

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
  hiResCanvas?: HTMLCanvasElement
): Promise<Blob> {
  const generator = generators[animationType];
  if (!generator) {
    throw new Error(`No animation generator for: ${animationType}`);
  }

  // Use hi-res source if available, otherwise fall back to output-size canvas
  const sourceCanvas = hiResCanvas ?? baseCanvas;
  const needsDownscale = sourceCanvas.width > size;

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: size,
      height: size,
      workerScript: "/gif.worker.js",
      transparent: 0x00000000 as unknown as string,
      repeat: 0,
    });

    const totalFrames = 20;
    const frameDelay = SPEED_DELAY[speed];

    const frameCanvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const hiResFrame = generator(sourceCanvas, i, totalFrames);

      // Downscale frame to output size if generated at hi-res
      let outputFrame: HTMLCanvasElement;
      if (needsDownscale) {
        outputFrame = downscale(hiResFrame, size);
        // Release hi-res frame immediately to save memory
        hiResFrame.width = 0;
        hiResFrame.height = 0;
      } else {
        outputFrame = hiResFrame;
      }

      gif.addFrame(outputFrame, { delay: frameDelay, copy: true });
      frameCanvases.push(outputFrame);
    }

    gif.on("finished", (blob: Blob) => {
      for (const fc of frameCanvases) {
        fc.width = 0;
        fc.height = 0;
      }
      resolve(blob);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gif as any).on("error", (err: Error) => {
      for (const fc of frameCanvases) {
        fc.width = 0;
        fc.height = 0;
      }
      reject(err);
    });
    gif.render();
  });
}
