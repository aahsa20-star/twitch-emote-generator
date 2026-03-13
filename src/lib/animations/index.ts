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
} from "./motion";

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
};

const SPEED_DELAY: Record<AnimationSpeed, number> = {
  slow: 80,
  normal: 50,
  fast: 25,
};

export async function generateGif(
  baseCanvas: HTMLCanvasElement,
  animationType: AnimationType,
  size: number,
  speed: AnimationSpeed = "normal"
): Promise<Blob> {
  const generator = generators[animationType];
  if (!generator) {
    throw new Error(`No animation generator for: ${animationType}`);
  }

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
      const frameCanvas = generator(baseCanvas, i, totalFrames);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });
      frameCanvases.push(frameCanvas);
    }

    gif.on("finished", (blob: Blob) => {
      // Release all frame canvases after GIF rendering completes
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
