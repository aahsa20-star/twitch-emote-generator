/**
 * v2 reactions (05 設計案 #1–#8): bow, laugh-burst, sweat, thinking, question,
 * idea, defeated, proud. Distinct from v1 shake/sway: discrete beats, not
 * continuous jitter.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeInOut, easeOut, easeOutBack, seg, lineWidth, contentBounds, outlinedText, star } from "./helpers";

/** おじぎ: lean forward (vertical squash from the bottom), hold low, return. */
export const createBowFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const down = t < 0.35 ? easeInOut(seg(t, 0, 0.35)) : t < 0.6 ? 1 : 1 - easeInOut(seg(t, 0.6, 0.95));
  drawBase(ctx, base, { scaleY: 1 - 0.28 * down, scaleX: 1 + 0.05 * down, py: 1, dy: 0, rotation: 0 });
  return c;
};

/** 大笑い: two quick squashes with laugh lines near the mouth. */
export const createLaughBurstFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const beat = Math.max(0, Math.sin(t * Math.PI * 4)); // two beats per loop
  const squash = 0.14 * beat;
  drawBase(ctx, base, { scaleY: 1 - squash, scaleX: 1 + squash * 0.6, py: 1 });
  if (beat > 0.35) {
    const b = contentBounds(base);
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lineWidth(size, 0.035);
    ctx.lineCap = "round";
    ctx.globalAlpha = Math.min(1, (beat - 0.35) * 2);
    const y = b.top + b.h * 0.62;
    const len = size * 0.09;
    for (const s of [-1, 1]) {
      const x = s < 0 ? b.left - len * 0.4 : b.right + len * 0.4;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x, y + k * len * 0.7);
        ctx.lineTo(x + s * len, y + k * len * 1.1);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  return c;
};

function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.6);
  ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r);
  ctx.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.6);
  ctx.fillStyle = "#8fd3ff";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.25);
  ctx.strokeStyle = "#1f6fb2";
  ctx.stroke();
  ctx.restore();
}

/** あせあせ: sweat drops alternate left / right and slide down-outward. */
export const createSweatFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const wob = Math.sin(t * Math.PI * 4) * size * 0.01;
  drawBase(ctx, base, { dx: wob });
  const r = Math.max(2.5, size * 0.045);
  for (const [side, phase] of [[-1, 0], [1, 0.5]] as const) {
    const p = (t + phase) % 1;
    const y = b.top + b.h * 0.15 + p * b.h * 0.45;
    const x = (side < 0 ? b.left + b.w * 0.12 : b.right - b.w * 0.12) + side * p * size * 0.12;
    const alpha = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
    drop(ctx, x, y, r, alpha);
  }
  return c;
};

/** 考え中: three dots light up in turn above the head, then a small head tilt. */
export const createThinkingFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  // tilt returns to 0 by frame 19 (t = 0.95) so the loop back to frame 0 has no jump
  const tilt = t >= 0.7 ? Math.sin(seg(t, 0.7, 0.95) * Math.PI) * (8 * Math.PI) / 180 : 0;
  drawBase(ctx, base, { rotation: tilt, py: 0.85 });
  const r = Math.max(2, size * 0.035);
  const y = Math.max(r * 1.5, b.top - size * 0.08);
  const lit = t < 0.7 ? Math.floor((t / 0.7) * 3) : 3;
  // fade the dots out at the very end so the loop back to "no dots" has no jump
  const dotAlpha = t < 0.9 ? 1 : 1 - seg(t, 0.9, 1);
  ctx.save();
  ctx.globalAlpha = dotAlpha;
  for (let k = 0; k < 3; k++) {
    const x = b.cx + (k - 1) * r * 3.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = k < lit ? "#ffffff" : "rgba(255,255,255,0.25)";
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.35);
    ctx.strokeStyle = "#333";
    ctx.stroke();
  }
  ctx.restore();
  return c;
};

/** はてな: a "?" pops up, tilts, and fades. */
export const createQuestionFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  if (t >= 0.1 && t < 0.9) {
    const pop = easeOutBack(seg(t, 0.1, 0.3));
    const tiltA = t < 0.4 ? 0 : Math.sin(seg(t, 0.4, 0.7) * Math.PI * 2) * 0.35;
    const alpha = t < 0.7 ? 1 : 1 - seg(t, 0.7, 0.9);
    const px = Math.max(10, size * 0.3) * Math.max(0.01, pop);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.right - b.w * 0.15, Math.max(px * 0.6, b.top - size * 0.02));
    ctx.rotate(tiltA);
    outlinedText(ctx, "?", 0, 0, px, "#ffe45c", "#3a2a00");
    ctx.restore();
  }
  return c;
};

/** ひらめき: light bulb above the head switches on with short rays. */
export const createIdeaFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const on = t >= 0.2 && t < 0.8;
  const glow = on ? easeOut(seg(t, 0.2, 0.3)) * (t > 0.7 ? 1 - seg(t, 0.7, 0.8) : 1) : 0;
  drawBase(ctx, base, { scale: 1 + glow * 0.03, py: 1 });
  const r = Math.max(3, size * 0.07);
  const cx = b.cx, cy = Math.max(r * 2.2, b.top - size * 0.06);
  ctx.save();
  if (glow > 0) {
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = lineWidth(size, 0.025);
    ctx.lineCap = "round";
    ctx.globalAlpha = glow;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.45;
      const inner = r * 1.5, outer = r * (1.9 + 0.5 * glow);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = glow > 0 ? `rgba(255,${210 + Math.round(30 * glow)},80,1)` : "rgba(200,200,200,0.5)";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.strokeStyle = "#333";
  ctx.stroke();
  ctx.fillStyle = "#666";
  ctx.fillRect(cx - r * 0.45, cy + r * 0.85, r * 0.9, r * 0.5);
  ctx.restore();
  return c;
};

/** がっくり: body slumps low; short dejection lines fall from above. */
export const createDefeatedFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const slump = t < 0.3 ? easeInOut(seg(t, 0, 0.3)) : t < 0.8 ? 1 : 1 - easeInOut(seg(t, 0.8, 1));
  drawBase(ctx, base, { scaleY: 1 - 0.18 * slump, scaleX: 1 + 0.06 * slump, py: 1, rotation: 0.05 * slump, px: 0.5 });
  if (t >= 0.2 && t < 0.85) {
    ctx.save();
    ctx.strokeStyle = "#6b7fb3";
    ctx.lineWidth = lineWidth(size, 0.025);
    ctx.lineCap = "round";
    const len = size * 0.09;
    for (let k = 0; k < 3; k++) {
      const p = (seg(t, 0.2, 0.85) * 1.6 + k * 0.33) % 1;
      const x = b.cx + (k - 1) * size * 0.12;
      const y = b.top - size * 0.14 + p * size * 0.2;
      ctx.globalAlpha = p < 0.8 ? 0.9 : (1 - p) * 4.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }
  return c;
};

/** どやっ: chest puff (upper body widens) and one star flash on one side. */
export const createProudFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const puff = t < 0.3 ? easeOutBack(seg(t, 0, 0.3)) : t < 0.7 ? 1 : 1 - easeInOut(seg(t, 0.7, 1));
  drawBase(ctx, base, { scale: 1 + 0.08 * puff, scaleX: 1 + 0.04 * puff, py: 1, dy: -size * 0.01 * puff });
  if (t >= 0.35 && t < 0.6) {
    const p = seg(t, 0.35, 0.6);
    const a = Math.sin(p * Math.PI);
    const r = Math.max(3, size * 0.07) * (0.6 + 0.4 * a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(b.right + size * 0.02, b.top + b.h * 0.25);
    ctx.rotate(p * Math.PI * 0.5);
    star(ctx, 0, 0, r, 4, 0.35);
    ctx.fillStyle = "#fff7c2";
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.15);
    ctx.strokeStyle = "#d4a017";
    ctx.stroke();
    ctx.restore();
  }
  return c;
};
