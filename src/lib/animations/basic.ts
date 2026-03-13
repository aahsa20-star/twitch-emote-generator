/**
 * Basic animations: sway, shake, blink, bounce, zoomin, spin, hearts
 */
import type { FrameGenerator } from "./types";

export const createSwayFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createShakeFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createBlinkFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2));

  ctx.globalAlpha = alpha;
  ctx.drawImage(baseCanvas, 0, 0);

  return canvas;
};

export const createBounceFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const bounceHeight = Math.abs(Math.sin(t * Math.PI * 2)) * size * 0.1;

  ctx.drawImage(baseCanvas, 0, -bounceHeight);

  return canvas;
};

export const createZoomInFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const scale = 0.85 + 0.2 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2));

  const drawSize = size * scale;
  const offset = (size - drawSize) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(baseCanvas, offset, offset, drawSize, drawSize);

  return canvas;
};

export const createSpinFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createHeartsFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

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
    ctx.fillText("\u2764", x, y);
    ctx.restore();
  }

  return canvas;
};
