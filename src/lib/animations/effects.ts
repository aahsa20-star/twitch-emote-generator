/**
 * Effect animations: gaming, glitch, sparkle, afterimage, neon, vhs, matrix,
 * hologram, pixelate, kaleidoscope, electric, static
 */
import type { FrameGenerator } from "./types";

export const createGamingFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createGlitchFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createSparkleFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createAfterimageFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
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
};

export const createNeonFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const hue = t * 360;
  const blur = 10 + 10 * Math.sin(t * Math.PI * 2);

  ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  // Draw twice for stronger glow
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.drawImage(baseCanvas, 0, 0);
  return canvas;
};

export const createVhsFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, size, size);
  const src = new Uint8ClampedArray(imgData.data);
  const seed = frameIndex * 13;

  // Horizontal slice displacement (fine, many slices)
  const sliceCount = 6;
  for (let s = 0; s < sliceCount; s++) {
    const sliceY = Math.floor(((seed + s * 31) % 100) / 100 * size);
    const sliceH = Math.max(1, Math.floor(size * 0.02));
    const sliceShift = Math.round((((seed + s * 47) % 100) / 100 - 0.5) * size * 0.05);
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

  // Scanlines + sepia tint
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Sepia tint
      const r = imgData.data[idx], g = imgData.data[idx + 1], b = imgData.data[idx + 2];
      imgData.data[idx] = Math.min(255, r * 1.1 + 20);
      imgData.data[idx + 1] = Math.min(255, g * 0.95 + 10);
      imgData.data[idx + 2] = Math.min(255, b * 0.8);
      // Scanline darkening every 2 rows
      if (y % 4 < 2) {
        imgData.data[idx] = Math.floor(imgData.data[idx] * 0.85);
        imgData.data[idx + 1] = Math.floor(imgData.data[idx + 1] * 0.85);
        imgData.data[idx + 2] = Math.floor(imgData.data[idx + 2] * 0.85);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
};

export const createMatrixFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const columns = 7;
  const charSize = Math.max(4, Math.floor(size * 0.08));

  ctx.font = `${charSize}px monospace`;
  ctx.textAlign = "center";

  for (let col = 0; col < columns; col++) {
    const x = (col + 0.5) * (size / columns);
    const speed = 0.4 + (col * 17 % 6) / 10;
    const charsInCol = 6;

    for (let c = 0; c < charsInCol; c++) {
      const progress = (t * speed + c / charsInCol + col * 0.13) % 1;
      const y = progress * size * 1.2 - size * 0.1;
      const alpha = progress < 0.1 ? progress * 10 : progress > 0.8 ? (1 - progress) * 5 : 1;
      const char = ((col * 7 + c * 13 + frameIndex) % 2 === 0) ? "0" : "1";

      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = `hsl(120, 100%, ${50 + c * 5}%)`;
      ctx.fillText(char, x, y);
      ctx.restore();
    }
  }

  return canvas;
};

/** ホログラム: semi-transparent with scanlines and color shift */
export const createHologramFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const hue = 180 + 30 * Math.sin(t * Math.PI * 2);

  ctx.filter = `hue-rotate(${hue}deg) brightness(1.2)`;
  ctx.globalAlpha = 0.7 + 0.15 * Math.sin(t * Math.PI * 4);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.filter = "none";

  // Scanlines
  ctx.globalAlpha = 0.15;
  const scanlineSpacing = Math.max(2, Math.floor(size / 20));
  const scanOffset = Math.floor(t * scanlineSpacing * 2) % scanlineSpacing;
  for (let y = scanOffset; y < size; y += scanlineSpacing) {
    ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
    ctx.fillRect(0, y, size, 1);
  }

  return canvas;
};

/** ピクセル化: mosaic effect that oscillates */
export const createPixelateFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Pixel size oscillates: 1 (sharp) -> max (blocky) -> 1
  const maxPixel = Math.max(4, Math.floor(size / 8));
  const pixelSize = Math.max(1, Math.floor(maxPixel * Math.abs(Math.sin(t * Math.PI))));

  if (pixelSize <= 1) {
    ctx.drawImage(baseCanvas, 0, 0);
  } else {
    // Downsample then upsample
    const small = Math.ceil(size / pixelSize);
    ctx.imageSmoothingEnabled = false;
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = small;
    tmpCanvas.height = small;
    const tmpCtx = tmpCanvas.getContext("2d")!;
    tmpCtx.imageSmoothingEnabled = true;
    tmpCtx.drawImage(baseCanvas, 0, 0, small, small);
    ctx.drawImage(tmpCanvas, 0, 0, size, size);
    tmpCanvas.width = 0;
    tmpCanvas.height = 0;
  }

  return canvas;
};

/** 万華鏡: rotation with hue cycling */
export const createKaleidoscopeFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  const angle = t * Math.PI * 2;
  const hue = t * 360;

  ctx.translate(size / 2, size / 2);
  ctx.rotate(angle * 0.5);
  ctx.translate(-size / 2, -size / 2);
  ctx.filter = `hue-rotate(${hue}deg) saturate(1.5)`;
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.filter = "none";

  // Draw mirrored overlay
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.translate(size, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.restore();

  return canvas;
};

/** 電流: electric crackling edge effect */
export const createElectricFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const t = frameIndex / totalFrames;
  // Slight random shake
  const shakeX = (Math.sin(frameIndex * 17.3) * 2) * (size / 112);
  const shakeY = (Math.cos(frameIndex * 23.7) * 2) * (size / 112);

  ctx.drawImage(baseCanvas, shakeX, shakeY);

  // Electric arcs around edges
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * Math.PI * 6);
  ctx.strokeStyle = `hsl(${200 + 40 * Math.sin(t * Math.PI * 4)}, 100%, 70%)`;
  ctx.lineWidth = Math.max(1, size * 0.015);
  ctx.shadowColor = "#00ccff";
  ctx.shadowBlur = Math.max(3, size * 0.05);

  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const seed = frameIndex * 7 + i * 31;
    const startAngle = (i / segments) * Math.PI * 2;
    const r = size * 0.42;
    const cx = size / 2;
    const cy = size / 2;

    ctx.beginPath();
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    ctx.moveTo(x1, y1);

    const jitterX = ((seed * 43) % 20 - 10) * (size / 112);
    const jitterY = ((seed * 67) % 20 - 10) * (size / 112);
    const x2 = cx + Math.cos(startAngle + 0.3) * r + jitterX;
    const y2 = cy + Math.sin(startAngle + 0.3) * r + jitterY;
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  return canvas;
};

/** 砂嵐: noise overlay that comes and goes */
export const createStaticFrame: FrameGenerator = (baseCanvas, frameIndex, totalFrames) => {
  const size = baseCanvas.width;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(baseCanvas, 0, 0);

  const t = frameIndex / totalFrames;
  const noiseIntensity = Math.abs(Math.sin(t * Math.PI * 2)) * 0.4;

  if (noiseIntensity > 0.02) {
    const imgData = ctx.getImageData(0, 0, size, size);
    const seed = frameIndex * 997;
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i + 3] === 0) continue; // Skip transparent
      const noise = ((seed + i * 7) % 255 - 128) * noiseIntensity;
      imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + noise));
      imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + noise));
      imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
};
