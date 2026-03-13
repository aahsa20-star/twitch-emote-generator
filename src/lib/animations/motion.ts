/**
 * Motion animations: fastspin, float, wobble, drunk, confetti, hypno,
 * snow, fire, tv, earthquake, party, flip, ghost, glitch2,
 * spiral, heartbeat, spring, jelly,
 * ricochet, figure8, spiralfall, randomwarp, stagger
 */
import type { FrameGenerator } from "./types";

export const createFastSpinFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createFloatFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const offsetY = Math.sin(t * Math.PI * 2) * size * 0.05;

  ctx.drawImage(baseCanvas, 0, offsetY);
  return canvas;
};

export const createWobbleFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const scaleX = 1 + 0.15 * Math.sin(t * Math.PI * 2);
  const scaleY = 1 + 0.15 * Math.sin(t * Math.PI * 2 + Math.PI);

  ctx.translate(size / 2, size / 2);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

export const createDrunkFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const offsetX = Math.sin(t * Math.PI * 2) * size * 0.06;
  const offsetY = Math.cos(t * Math.PI * 2 * 1.3) * size * 0.06;
  const angle = Math.sin(t * Math.PI * 2 * 0.7) * (8 * Math.PI / 180);

  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

export const createConfettiFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const pieces = 10;

  for (let i = 0; i < pieces; i++) {
    const seed = i * 59 + 11;
    const xBase = ((seed * 43) % 100) / 100;
    const speed = 0.3 + ((seed * 31) % 70) / 100;
    const progress = (t * speed + i / pieces) % 1;

    const x = xBase * size + Math.sin(progress * Math.PI * 4 + i * 2) * size * 0.06;
    const y = progress * size * 1.2 - size * 0.1;
    const rotation = progress * Math.PI * 4 + i;
    const hue = (seed * 67) % 360;
    const w = Math.max(2, size * 0.025);
    const h = Math.max(1, size * 0.015);

    ctx.save();
    ctx.globalAlpha = progress > 0.9 ? (1 - progress) * 10 : 0.8;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  return canvas;
};

export const createHypnoFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.6;
  const rings = 6;
  const rotation = t * Math.PI * 2;
  const scale = 0.8 + 0.2 * Math.sin(t * Math.PI * 2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  for (let i = rings; i >= 1; i--) {
    const r = (i / rings) * maxRadius;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0
      ? "rgba(168, 85, 247, 0.15)"
      : "rgba(255, 255, 255, 0.12)";
    ctx.fill();
  }

  ctx.restore();
  return canvas;
};

export const createSnowFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const snowflakes = 8;

  for (let i = 0; i < snowflakes; i++) {
    const seed = i * 73 + 17;
    const xBase = ((seed * 37) % 100) / 100;
    const speed = 0.7 + ((seed * 53) % 30) / 100;
    const snowSize = 2 + ((seed * 19) % 3);
    const progress = (t * speed + i / snowflakes) % 1;

    const x = xBase * size + Math.sin(progress * Math.PI * 2 + i) * size * 0.04;
    const y = progress * size * 1.1 - size * 0.05;

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, snowSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvas;
};

export const createFireFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const particles = 8;

  for (let i = 0; i < particles; i++) {
    const seed = i * 67 + 23;
    const xBase = 0.2 + ((seed * 41) % 60) / 100;
    const speed = 0.5 + ((seed * 29) % 50) / 100;
    const progress = (t * speed + i / particles) % 1;

    const x = xBase * size + Math.sin(progress * Math.PI * 3 + i) * size * 0.03;
    const y = size * (1.0 - progress * 0.7);
    const alpha = 1 - progress;
    const particleSize = Math.max(2, size * 0.03) * (1 - progress * 0.5);
    const hue = 15 + progress * 45;
    const lightness = 50 + progress * 20;

    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
    ctx.beginPath();
    ctx.arc(x, y, particleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvas;
};

export const createTvFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // CRT turn-off: scaleY goes 1 -> 0 -> 1
  const scaleY = Math.abs(Math.cos(t * Math.PI));

  ctx.translate(size / 2, size / 2);
  ctx.scale(1, Math.max(0.02, scaleY));
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);

  // White flash line at minimum scale
  if (scaleY < 0.15) {
    ctx.resetTransform();
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - scaleY / 0.15})`;
    ctx.fillRect(0, size / 2 - 1, size, 2);
  }

  return canvas;
};

export const createEarthquakeFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const maxOffset = Math.max(2, size * 0.06);
  const offsetX = Math.sin(t * Math.PI * 8) * maxOffset;
  const offsetY = Math.cos(t * Math.PI * 6) * maxOffset * 0.4;
  // Occasional big Y jolt
  const jolt = (frameIndex % 5 === 0) ? maxOffset * 0.8 * ((frameIndex % 2 === 0) ? 1 : -1) : 0;

  ctx.drawImage(baseCanvas, offsetX, offsetY + jolt);
  return canvas;
};

export const createPartyFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const hue = t * 360;
  const bounceHeight = Math.abs(Math.sin(t * Math.PI * 4)) * size * 0.08;

  ctx.filter = `hue-rotate(${hue}deg) saturate(1.4)`;
  ctx.drawImage(baseCanvas, 0, -bounceHeight);
  ctx.filter = "none";
  return canvas;
};

export const createFlipFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // scaleX: 1 -> 0 -> -1 -> 0 -> 1
  const scaleX = Math.cos(t * Math.PI * 2);

  ctx.translate(size / 2, 0);
  ctx.scale(scaleX, 1);
  ctx.translate(-size / 2, 0);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

export const createGhostFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Alpha fades from 1 -> 0.1 -> 1
  const alpha = 0.1 + 0.9 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2));
  // Wide float movement
  const offsetY = Math.sin(t * Math.PI * 2) * size * 0.08;

  ctx.globalAlpha = alpha;
  ctx.drawImage(baseCanvas, 0, offsetY);
  return canvas;
};

export const createGlitch2Frame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // White flash on specific frames
  if (frameIndex % 7 === 3) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.4;
    ctx.drawImage(baseCanvas, 0, 0);
    return canvas;
  }

  ctx.drawImage(baseCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, size, size);
  const src = new Uint8ClampedArray(imgData.data);
  const seed = frameIndex * 11;

  // 3x stronger RGB channel split
  const shift = Math.sin((frameIndex / totalFrames) * Math.PI * 4) * size * 0.09;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const rxSrc = Math.min(size - 1, Math.max(0, Math.round(x - shift)));
      imgData.data[idx] = src[(y * size + rxSrc) * 4];
      const bxSrc = Math.min(size - 1, Math.max(0, Math.round(x + shift)));
      imgData.data[idx + 2] = src[(y * size + bxSrc) * 4 + 2];
    }
  }

  // 8 heavy slices
  for (let s = 0; s < 8; s++) {
    const sliceY = Math.floor(((seed + s * 29) % 100) / 100 * size);
    const sliceH = Math.max(2, Math.floor(size * 0.05));
    const sliceShift = Math.round((((seed + s * 41) % 100) / 100 - 0.5) * size * 0.2);
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
};

export const createSpiralFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const angle = t * Math.PI * 2;
  // Radius oscillates 0 -> size*0.05 -> 0
  const r = Math.sin(t * Math.PI * 2) * size * 0.05;
  const offsetX = Math.cos(angle) * r;
  const offsetY = Math.sin(angle) * r;

  ctx.drawImage(baseCanvas, offsetX, offsetY);
  return canvas;
};

export const createHeartbeatFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Two beats per cycle: scale peaks at t=0.15 and t=0.35
  const beat1 = Math.exp(-((t - 0.15) * (t - 0.15)) / 0.003) * 0.15;
  const beat2 = Math.exp(-((t - 0.35) * (t - 0.35)) / 0.003) * 0.10;
  const scale = 1.0 + beat1 + beat2;

  const drawSize = size * scale;
  const offset = (size - drawSize) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(baseCanvas, offset, offset, drawSize, drawSize);
  return canvas;
};

export const createSpringFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Enhanced bounce with overshoot: damped spring oscillation
  const decay = Math.exp(-t * 4);
  const bounceHeight = Math.abs(Math.sin(t * Math.PI * 6)) * size * 0.15 * decay;
  // Slight squash at bottom
  const scaleY = 1.0 - (1.0 - Math.abs(Math.sin(t * Math.PI * 6))) * 0.08 * decay;
  const scaleX = 1.0 + (1.0 - scaleY) * 0.5;

  ctx.translate(size / 2, size);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-size / 2, -size);
  ctx.drawImage(baseCanvas, 0, -bounceHeight);
  return canvas;
};

export const createJellyFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const scaleY = 1.0 + 0.18 * Math.sin(t * Math.PI * 2);
  const scaleX = 1.0 - (scaleY - 1.0) * 0.6;

  ctx.translate(size / 2, size);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-size / 2, -size);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

/** 弾む: horizontal movement with bouncing */
export const createRicochetFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const offsetX = Math.sin(t * Math.PI * 2) * size * 0.08;
  const bounceY = Math.abs(Math.sin(t * Math.PI * 4)) * size * 0.06;

  ctx.drawImage(baseCanvas, offsetX, -bounceY);
  return canvas;
};

/** 8の字: figure-8 path */
export const createFigure8Frame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const angle = t * Math.PI * 2;
  const offsetX = Math.sin(angle) * size * 0.06;
  const offsetY = Math.sin(angle * 2) * size * 0.04;

  ctx.drawImage(baseCanvas, offsetX, offsetY);
  return canvas;
};

/** 螺旋落下: spiral descent */
export const createSpiralFallFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const angle = t * Math.PI * 4;
  const radius = size * 0.05;
  const offsetX = Math.cos(angle) * radius;
  const fallY = (t * size * 0.15) % (size * 0.15);
  const rotAngle = t * Math.PI * 2;

  ctx.translate(size / 2 + offsetX, size / 2 + fallY - size * 0.075);
  ctx.rotate(rotAngle * 0.3);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

/** ランダムワープ: teleport to random positions */
export const createRandomWarpFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Deterministic pseudo-random based on frameIndex
  const seed = frameIndex * 137;
  const warpInterval = 4; // Warp every N frames

  if (frameIndex % warpInterval === 0) {
    // Warp frame: flash effect
    ctx.globalAlpha = 0.5;
    ctx.drawImage(baseCanvas, 0, 0);
    return canvas;
  }

  const group = Math.floor(frameIndex / warpInterval);
  const offsetX = ((group * 73 + 11) % 17 - 8) * (size / 112) * 3;
  const offsetY = ((group * 97 + 23) % 17 - 8) * (size / 112) * 3;
  const scale = 0.95 + ((seed % 10) / 100);

  const drawSize = size * scale;
  const ox = (size - drawSize) / 2 + offsetX;
  const oy = (size - drawSize) / 2 + offsetY;

  ctx.drawImage(baseCanvas, ox, oy, drawSize, drawSize);
  return canvas;
};

/** 酔い歩き: random-direction staggering */
export const createStaggerFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Accumulated pseudo-random walk
  const maxDrift = size * 0.06;
  const offsetX = Math.sin(t * Math.PI * 3.7 + 1.3) * maxDrift
    + Math.sin(t * Math.PI * 7.1) * maxDrift * 0.3;
  const offsetY = Math.cos(t * Math.PI * 2.9 + 0.7) * maxDrift
    + Math.cos(t * Math.PI * 5.3) * maxDrift * 0.3;
  const angle = Math.sin(t * Math.PI * 2.3) * (5 * Math.PI / 180);

  ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
  ctx.rotate(angle);
  ctx.translate(-size / 2, -size / 2);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};
