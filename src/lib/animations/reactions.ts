/**
 * Reaction animations: angry, cry, blush, surprise, sleepy
 */
import type { FrameGenerator } from "./types";

/** 怒る: red tint with intense shaking */
export const createAngryFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const shakeX = Math.sin(t * Math.PI * 8) * size * 0.03;
  const shakeY = Math.cos(t * Math.PI * 10) * size * 0.02;
  const redIntensity = 0.3 + 0.2 * Math.sin(t * Math.PI * 4);

  ctx.drawImage(baseCanvas, shakeX, shakeY);

  // Red overlay
  ctx.save();
  ctx.globalAlpha = redIntensity;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#ff3333";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Anger symbol (💢-like cross marks)
  const markSize = Math.max(3, size * 0.08);
  const pulse = 0.8 + 0.2 * Math.sin(t * Math.PI * 6);

  ctx.save();
  ctx.globalAlpha = 0.8 * pulse;
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = Math.max(1, size * 0.02);
  ctx.lineCap = "round";

  const mx = size * 0.78;
  const my = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(mx - markSize, my - markSize);
  ctx.lineTo(mx + markSize, my + markSize);
  ctx.moveTo(mx + markSize, my - markSize);
  ctx.lineTo(mx - markSize, my + markSize);
  ctx.stroke();
  ctx.restore();

  return canvas;
};

/** 泣く: blue tint with downward sway + tear drops */
export const createCryFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const swayY = Math.sin(t * Math.PI * 3) * size * 0.02;

  ctx.drawImage(baseCanvas, 0, swayY);

  // Blue tint
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#4488ff";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Tear drops
  const tears = [
    { x: 0.35, delay: 0 },
    { x: 0.65, delay: 0.5 },
  ];

  for (const tear of tears) {
    const progress = (t + tear.delay) % 1;
    const tx = tear.x * size;
    const ty = size * (0.45 + progress * 0.4);
    const alpha = progress < 0.8 ? 0.7 : 0.7 * (1 - (progress - 0.8) / 0.2);
    const tearSize = Math.max(2, size * 0.03);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#66aaff";
    ctx.beginPath();
    // Tear drop shape
    ctx.arc(tx, ty, tearSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvas;
};

/** 照れる: pink flash with small wobble */
export const createBlushFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const wobble = Math.sin(t * Math.PI * 6) * size * 0.01;

  ctx.drawImage(baseCanvas, wobble, 0);

  // Pink flash
  const pinkIntensity = 0.15 + 0.1 * Math.sin(t * Math.PI * 4);
  ctx.save();
  ctx.globalAlpha = pinkIntensity;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#ff88aa";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // Blush lines on cheeks
  const lineAlpha = 0.4 + 0.3 * Math.sin(t * Math.PI * 3);
  const lineSize = Math.max(2, size * 0.06);
  ctx.save();
  ctx.globalAlpha = lineAlpha;
  ctx.strokeStyle = "#ff6688";
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.lineCap = "round";

  // Left cheek
  for (let i = 0; i < 3; i++) {
    const lx = size * 0.25 + i * lineSize * 0.5;
    const ly = size * 0.6;
    ctx.beginPath();
    ctx.moveTo(lx, ly - lineSize * 0.3);
    ctx.lineTo(lx + lineSize * 0.3, ly + lineSize * 0.3);
    ctx.stroke();
  }
  // Right cheek
  for (let i = 0; i < 3; i++) {
    const rx = size * 0.6 + i * lineSize * 0.5;
    const ry = size * 0.6;
    ctx.beginPath();
    ctx.moveTo(rx, ry - lineSize * 0.3);
    ctx.lineTo(rx + lineSize * 0.3, ry + lineSize * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  return canvas;
};

/** 驚く: quick scale-up jolt then settle */
export const createSurpriseFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Sharp jolt at t=0, then damped oscillation
  const jolt = Math.exp(-t * 6) * 0.25 * Math.cos(t * Math.PI * 8);
  const scale = 1.0 + jolt;

  const drawSize = size * scale;
  const offset = (size - drawSize) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(baseCanvas, offset, offset, drawSize, drawSize);

  // Exclamation effect on jolt frames
  if (t < 0.3) {
    const alpha = 1 - t / 0.3;
    const markSize = Math.max(4, size * 0.1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.font = `bold ${markSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffee00";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = Math.max(1, markSize * 0.1);
    ctx.strokeText("!", size * 0.82, size * 0.15);
    ctx.fillText("!", size * 0.82, size * 0.15);
    ctx.restore();
  }

  return canvas;
};

/** 眠る: slow tilt with fade + Zzz */
export const createSleepyFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Gentle tilt as if nodding off
  const tiltAngle = Math.sin(t * Math.PI * 2) * (8 * Math.PI / 180);
  const alpha = 0.7 + 0.3 * Math.cos(t * Math.PI * 2);

  ctx.globalAlpha = alpha;
  ctx.translate(size / 2, size * 0.7);
  ctx.rotate(tiltAngle);
  ctx.translate(-size / 2, -size * 0.7);
  ctx.drawImage(baseCanvas, 0, 0);

  // Zzz text floating up
  ctx.resetTransform();
  const zSize = Math.max(4, size * 0.08);
  const zzzs = [
    { delay: 0, scale: 0.7 },
    { delay: 0.33, scale: 0.85 },
    { delay: 0.66, scale: 1.0 },
  ];

  for (const z of zzzs) {
    const progress = (t + z.delay) % 1;
    const zx = size * 0.75 + progress * size * 0.1;
    const zy = size * (0.4 - progress * 0.35);
    const zAlpha = progress < 0.7 ? 0.6 : 0.6 * (1 - (progress - 0.7) / 0.3);

    ctx.save();
    ctx.globalAlpha = zAlpha;
    ctx.font = `bold ${zSize * z.scale}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#aabbdd";
    ctx.fillText("z", zx, zy);
    ctx.restore();
  }

  return canvas;
};
