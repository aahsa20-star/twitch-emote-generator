import { AnimationType } from "@/types/emote";
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

function createGamingFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const angle = (frameIndex / totalFrames) * 360;
  ctx.filter = `hue-rotate(${angle}deg) saturate(1.3)`;
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.filter = "none";

  return canvas;
}

function createGlitchFrame(
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

  // RGB channel split (chromatic aberration)
  const t = frameIndex / totalFrames;
  const shift = Math.sin(t * Math.PI * 4) * size * 0.03;

  const imgData = ctx.getImageData(0, 0, size, size);
  const src = new Uint8ClampedArray(imgData.data);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Shift red channel right
      const rxSrc = Math.min(size - 1, Math.max(0, Math.round(x - shift)));
      const rIdx = (y * size + rxSrc) * 4;
      imgData.data[idx] = src[rIdx]; // R
      // Shift blue channel left
      const bxSrc = Math.min(size - 1, Math.max(0, Math.round(x + shift)));
      const bIdx = (y * size + bxSrc) * 4;
      imgData.data[idx + 2] = src[bIdx + 2]; // B
    }
  }

  // Random horizontal slice displacement
  const sliceCount = 3;
  const seed = frameIndex * 7;
  for (let s = 0; s < sliceCount; s++) {
    const sliceY = Math.floor(((seed + s * 37) % 100) / 100 * size);
    const sliceH = Math.max(1, Math.floor(size * 0.04));
    const sliceShift = Math.round((((seed + s * 53) % 100) / 100 - 0.5) * size * 0.08);
    for (let y = sliceY; y < Math.min(size, sliceY + sliceH); y++) {
      for (let x = 0; x < size; x++) {
        const dstIdx = (y * size + x) * 4;
        const srcX = Math.min(size - 1, Math.max(0, x - sliceShift));
        const srcIdx = (y * size + srcX) * 4;
        imgData.data[dstIdx] = src[srcIdx];
        imgData.data[dstIdx + 1] = src[srcIdx + 1];
        imgData.data[dstIdx + 2] = src[srcIdx + 2];
        imgData.data[dstIdx + 3] = src[srcIdx + 3];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function createSparkleFrame(
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

  const t = frameIndex / totalFrames;

  // Draw 5 four-pointed star sparkles
  const sparkles = [
    { x: 0.15, y: 0.2, delay: 0 },
    { x: 0.8, y: 0.15, delay: 0.2 },
    { x: 0.85, y: 0.7, delay: 0.4 },
    { x: 0.2, y: 0.75, delay: 0.6 },
    { x: 0.5, y: 0.1, delay: 0.8 },
  ];

  for (const sp of sparkles) {
    const progress = (t + sp.delay) % 1;
    // Twinkle: fade in then out
    const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    const sparkleSize = Math.max(2, size * 0.06) * (0.5 + alpha * 0.5);
    const rotation = progress * Math.PI * 2;

    const cx = sp.x * size;
    const cy = sp.y * size;

    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Draw four-pointed star
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const outerX = Math.cos(angle) * sparkleSize;
      const outerY = Math.sin(angle) * sparkleSize;
      const innerAngle = angle + Math.PI / 4;
      const innerX = Math.cos(innerAngle) * sparkleSize * 0.25;
      const innerY = Math.sin(innerAngle) * sparkleSize * 0.25;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fillStyle = "#fffbe6";
    ctx.fill();
    ctx.restore();
  }

  return canvas;
}

function createAfterimageFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;

  // Draw 3 trailing copies with decreasing opacity
  const trails = [
    { delay: 0.15, alpha: 0.15 },
    { delay: 0.1, alpha: 0.25 },
    { delay: 0.05, alpha: 0.4 },
  ];

  for (const trail of trails) {
    const trailT = (t - trail.delay + 1) % 1;
    const offsetX = Math.sin(trailT * Math.PI * 2) * size * 0.06;
    const offsetY = Math.cos(trailT * Math.PI * 2) * size * 0.03;

    ctx.save();
    ctx.globalAlpha = trail.alpha;
    ctx.drawImage(baseCanvas, offsetX, offsetY);
    ctx.restore();
  }

  // Draw main image with movement
  const mainOffsetX = Math.sin(t * Math.PI * 2) * size * 0.06;
  const mainOffsetY = Math.cos(t * Math.PI * 2) * size * 0.03;
  ctx.globalAlpha = 1;
  ctx.drawImage(baseCanvas, mainOffsetX, mainOffsetY);

  return canvas;
}

function createFastSpinFrame(
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
): HTMLCanvasElement {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // 2x speed spin
  const angle = (frameIndex / totalFrames) * Math.PI * 4;

  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);

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
  gaming: createGamingFrame,
  glitch: createGlitchFrame,
  sparkle: createSparkleFrame,
  afterimage: createAfterimageFrame,
  fastspin: createFastSpinFrame,
};

export async function generateGif(
  baseCanvas: HTMLCanvasElement,
  animationType: AnimationType,
  size: number
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
    const frameDelay = 50;

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
