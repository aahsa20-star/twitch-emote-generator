/**
 * v2 scenes (05 設計案 #33–#40): sakura-petals, autumn-leaves, underwater,
 * rain-umbrella, sun-rise, shooting-star, moon-cloud, flower-bloom.
 * Particles are seeded (prng) so the same settings always produce the same GIF.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeInOut, easeOut, seg, lineWidth, contentBounds, prng } from "./helpers";

function petal(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r, -r * 0.6, r * 0.6, r * 0.4);
  ctx.quadraticCurveTo(r * 0.25, r * 0.2, 0, r * 0.7); // notch
  ctx.quadraticCurveTo(-r * 0.25, r * 0.2, -r * 0.6, r * 0.4);
  ctx.quadraticCurveTo(-r, -r * 0.6, 0, -r);
  ctx.closePath();
}

/** 桜吹雪: notched petals drift across on curved paths (shape + path differ from snow). */
export const createSakuraPetalsFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base);
  const rnd = prng(0x5a4a);
  const count = 8;
  for (let k = 0; k < count; k++) {
    const y0 = rnd(), sp = 0.6 + rnd() * 0.6, amp = rnd(), rot = rnd() * Math.PI * 2, r = Math.max(2, size * (0.03 + rnd() * 0.025));
    const p = (t * sp + k / count) % 1;
    const x = -size * 0.15 + p * size * 1.3;
    const y = y0 * size * 0.9 + Math.sin(p * Math.PI * 2 + amp * 6) * size * 0.12 + p * size * 0.15;
    ctx.save();
    ctx.globalAlpha = p < 0.1 ? p * 10 : p > 0.9 ? (1 - p) * 10 : 0.95;
    ctx.translate(x, y);
    ctx.rotate(rot + p * Math.PI * 3);
    petal(ctx, r);
    ctx.fillStyle = "#ffb7d5";
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.18);
    ctx.strokeStyle = "#e0619a";
    ctx.stroke();
    ctx.restore();
  }
  return c;
};

/** 木の葉: a few leaves tumble down diagonally. */
export const createAutumnLeavesFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base);
  const rnd = prng(0xa07);
  const colors = ["#d9822b", "#c1440e", "#e0b23a", "#9c3d1a", "#f0a04b"];
  for (let k = 0; k < 5; k++) {
    const x0 = rnd(), sp = 0.7 + rnd() * 0.5, spin = 1 + rnd() * 2, r = Math.max(2.5, size * (0.04 + rnd() * 0.02));
    const p = (t * sp + k / 5) % 1;
    const x = x0 * size * 0.8 - size * 0.1 + p * size * 0.35 + Math.sin(p * Math.PI * 3) * size * 0.05;
    const y = -size * 0.1 + p * size * 1.2;
    ctx.save();
    ctx.globalAlpha = p > 0.9 ? (1 - p) * 10 : 0.95;
    ctx.translate(x, y);
    ctx.rotate(p * Math.PI * 2 * spin);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = colors[k % colors.length];
    ctx.fill();
    ctx.lineWidth = Math.max(0.8, r * 0.15);
    ctx.strokeStyle = "#5a2a0a";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.restore();
  }
  return c;
};

/** 水の中: slow horizontal refraction in strips, rising bubbles, faint blue tint. */
export const createUnderwaterFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const strips = 14;
  const h = size / strips;
  for (let s = 0; s < strips; s++) {
    const y = s * h;
    const dx = Math.sin(t * Math.PI * 2 + s * 0.7) * size * 0.015;
    ctx.drawImage(base, 0, y, size, h, dx, y, size, h);
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(70,150,255,0.14)";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  const rnd = prng(0xb0b);
  for (let k = 0; k < 6; k++) {
    const x0 = rnd(), sp = 0.6 + rnd() * 0.6, r = Math.max(1.5, size * (0.02 + rnd() * 0.025));
    const p = (t * sp + k / 6) % 1;
    const x = size * 0.1 + x0 * size * 0.8 + Math.sin(p * Math.PI * 4) * size * 0.03;
    const y = size * 1.05 - p * size * 1.15;
    ctx.save();
    ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 0.85;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#dff4ff";
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.stroke();
    ctx.restore();
  }
  return c;
};

/** 雨やどり: a small umbrella overhead and rain streaks falling around it. */
export const createRainUmbrellaFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  const uw = Math.max(10, b.w * 0.75), uh = uw * 0.42;
  const ux = b.cx, uy = Math.max(uh + 1, b.top - size * 0.02);
  const rnd = prng(0x4a1);
  ctx.save();
  ctx.strokeStyle = "#9ad0ff";
  ctx.lineWidth = lineWidth(size, 0.018, 1);
  ctx.lineCap = "round";
  for (let k = 0; k < 14; k++) {
    const x0 = rnd() * size, sp = 1 + rnd(), len = size * (0.06 + rnd() * 0.04);
    const p = (t * sp + rnd()) % 1;
    const x = x0 + p * size * 0.08, y = -len + p * (size + len);
    // skip streaks under the umbrella canopy
    if (Math.abs(x - ux) < uw / 2 && y > uy - uh && y < uy + b.h) continue;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size * 0.01, y + len);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ux, uy, uw / 2, uh, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#ff6b6b";
  ctx.fill();
  ctx.lineWidth = lineWidth(size, 0.02, 1);
  ctx.strokeStyle = "#7a1f1f";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ux, uy);
  ctx.lineTo(ux, uy + uh * 0.5);
  ctx.strokeStyle = "#5c3b1e";
  ctx.stroke();
  ctx.restore();
  return c;
};

/** 日の出: a half-sun with short rays rises behind the body and sets again. */
export const createSunRiseFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const up = t < 0.4 ? easeOut(seg(t, 0, 0.4)) : t < 0.6 ? 1 : 1 - easeInOut(seg(t, 0.6, 1));
  const r = size * 0.3;
  const cy = size * 0.75 - up * size * 0.28;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, size * 0.75);
  ctx.clip();
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = lineWidth(size, 0.025);
  ctx.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k / 8) * Math.PI + t * 0.3;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 1.15);
    ctx.lineTo(size / 2 + Math.cos(a) * r * (1.35 + 0.1 * up), cy + Math.sin(a) * r * (1.35 + 0.1 * up));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(size / 2, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffb703";
  ctx.fill();
  ctx.restore();
  drawBase(ctx, base);
  return c;
};

/** 流れ星: one star with a tail streaks diagonally behind the body. */
export const createShootingStarFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const p = t < 0.55 ? easeOut(seg(t, 0.05, 0.55)) : -1;
  if (p >= 0) {
    const x = size * 1.1 - p * size * 1.3, y = -size * 0.1 + p * size * 0.75;
    const alpha = p < 0.1 ? p * 10 : p > 0.85 ? (1 - p) / 0.15 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    const tail = size * 0.3;
    const g = ctx.createLinearGradient(x, y, x + tail, y - tail * 0.58);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = lineWidth(size, 0.03);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tail, y - tail * 0.58);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, size * 0.03), 0, Math.PI * 2);
    ctx.fillStyle = "#fffbe6";
    ctx.fill();
    ctx.restore();
  }
  drawBase(ctx, base);
  return c;
};

/** 月と雲: crescent moon at the top corner, a small cloud drifts past it. */
export const createMoonCloudFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const mr = Math.max(4, size * 0.11);
  const mx = Math.min(size - mr - 1, b.right + mr * 0.2), my = Math.max(mr + 1, b.top - mr * 0.3);
  const [moon, mctx] = newCanvas(size);
  mctx.beginPath();
  mctx.arc(mx, my, mr, 0, Math.PI * 2);
  mctx.fillStyle = "#fff3b0";
  mctx.fill();
  mctx.globalCompositeOperation = "destination-out";
  mctx.beginPath();
  mctx.arc(mx + mr * 0.45, my - mr * 0.25, mr * 0.85, 0, Math.PI * 2);
  mctx.fill();
  ctx.drawImage(moon, 0, 0);
  moon.width = 0;
  drawBase(ctx, base);
  const p = (t + 0.5) % 1;
  const cx = mx - mr * 2.2 + p * mr * 4.4;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const [ox, oy, r] of [[-0.6, 0.1, 0.45], [0, -0.15, 0.6], [0.6, 0.1, 0.45]] as const) {
    ctx.beginPath();
    ctx.arc(cx + ox * mr, my + mr * 0.4 + oy * mr, mr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return c;
};

/** 花が咲く: two flowers at the bottom corners open petal by petal, then close. */
export const createFlowerBloomFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base);
  const open = t < 0.5 ? seg(t, 0, 0.5) : t < 0.7 ? 1 : 1 - easeInOut(seg(t, 0.7, 1));
  const r = Math.max(3, size * 0.06);
  for (const [fx, col] of [[size * 0.12, "#ff8fab"], [size * 0.88, "#ffd166"]] as const) {
    const fy = size * 0.86;
    ctx.save();
    ctx.strokeStyle = "#3a8f3a";
    ctx.lineWidth = lineWidth(size, 0.02, 1);
    ctx.beginPath();
    ctx.moveTo(fx, size);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const local = Math.max(0, Math.min(1, open * 5 - k)); // petals open in order
      if (local <= 0) continue;
      const a = -Math.PI / 2 + (k / 5) * Math.PI * 2;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(a);
      ctx.scale(local, local);
      ctx.beginPath();
      ctx.ellipse(r * 0.9, 0, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = Math.max(0.8, r * 0.15);
      ctx.strokeStyle = "#7a2a4a";
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(fx, fy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe66d";
    ctx.fill();
    ctx.restore();
  }
  return c;
};
