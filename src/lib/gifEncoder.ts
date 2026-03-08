import { AnimationType, EmoteSize } from "@/types/emote";
import GIF from "gif.js";

type FrameGenerator = (
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
) => HTMLCanvasElement;

function createSwayFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const angle =
    Math.sin((frameIndex / totalFrames) * Math.PI * 2) * (10 * Math.PI) / 180;

  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);

  return canvas;
}

function createShakeFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const maxOffset = Math.max(1, size * 0.03);
  const offsetX =
    Math.sin((frameIndex / totalFrames) * Math.PI * 4) * maxOffset;
  const offsetY =
    Math.cos((frameIndex / totalFrames) * Math.PI * 6) * maxOffset * 0.5;

  ctx.drawImage(baseCanvas, offsetX, offsetY);

  return canvas;
}

function createBlinkFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Smooth fade: use cosine for natural in/out
  const t = frameIndex / totalFrames;
  const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2));

  ctx.globalAlpha = alpha;
  ctx.drawImage(baseCanvas, 0, 0);

  return canvas;
}

function createBounceFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Bounce: abs(sin) for a natural bounce curve
  const t = frameIndex / totalFrames;
  const bounceHeight = Math.abs(Math.sin(t * Math.PI * 2)) * size * 0.1;

  ctx.drawImage(baseCanvas, 0, -bounceHeight);

  return canvas;
}

function createZoomInFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Scale from 0.85 to 1.05 then back
  const t = frameIndex / totalFrames;
  const scale = 0.85 + 0.2 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));

  const drawSize = size * scale;
  const offset = (size - drawSize) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(baseCanvas, offset, offset, drawSize, drawSize);

  return canvas;
}

function createSpinFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const angle = (frameIndex / totalFrames) * Math.PI * 2;

  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);

  return canvas;
}

function createHeartsFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  // Draw floating hearts
  const heartSize = Math.max(6, size * 0.12);
  const t = frameIndex / totalFrames;

  const hearts = [
    { xBase: 0.75, delay: 0 },
    { xBase: 0.85, delay: 0.33 },
    { xBase: 0.65, delay: 0.66 },
  ];

  for (const heart of hearts) {
    const progress = (t + heart.delay) % 1;
    const x = heart.xBase * size + Math.sin(progress * Math.PI * 3) * size * 0.05;
    const y = size * (0.8 - progress * 0.7);
    const alpha = progress < 0.8 ? 1 : 1 - (progress - 0.8) / 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${heartSize}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("❤", x, y);
    ctx.restore();
  }

  return canvas;
}

const generators: Record<string, FrameGenerator> = {
  sway: createSwayFrame,
  shake: createShakeFrame,
  blink: createBlinkFrame,
  bounce: createBounceFrame,
  zoomin: createZoomInFrame,
  spin: createSpinFrame,
  hearts: createHeartsFrame,
};

export async function generateGif(
  baseCanvas: HTMLCanvasElement,
  animationType: AnimationType,
  size: EmoteSize
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

    const totalFrames = 12;
    const frameDelay = 80;

    for (let i = 0; i < totalFrames; i++) {
      const frameCanvas = generator(baseCanvas, i, totalFrames);
      gif.addFrame(frameCanvas, { delay: frameDelay, copy: true });
    }

    gif.on("finished", (blob: Blob) => resolve(blob));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gif as any).on("error", (err: Error) => reject(err));
    gif.render();
  });
}
