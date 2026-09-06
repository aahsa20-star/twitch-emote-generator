/**
 * v2 entrances (05 設計案 #9–#16, #45): peek-left, peek-bottom, curtain-open,
 * iris-open, diagonal-reveal, stamp, paper-unfold, teleport-ring, brush-reveal.
 * Each cycle: appear → hold → leave, so frame n-1 connects to frame 0 without a
 * visible pop.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeInOut, easeOut, easeIn, easeOutBack, seg, lineWidth, contentBounds } from "./helpers";

/** 横からちらっ: half of the body slides in from the left edge, waits, slides back. */
export const createPeekLeftFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const hidden = -(b.right + 2);
  const half = -(b.left + b.w * 0.5);
  const k = t < 0.3 ? easeOut(seg(t, 0, 0.3)) : t < 0.65 ? 1 : t < 0.95 ? 1 - easeIn(seg(t, 0.65, 0.95)) : 0;
  drawBase(ctx, base, { dx: hidden + (half - hidden) * k });
  return c;
};

/** 下からちらっ: rises from the bottom edge to eye level, bobs, sinks back. */
export const createPeekBottomFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const hidden = size - b.top + 2;
  const eye = size - b.top - b.h * 0.45;
  const k = t < 0.3 ? easeOut(seg(t, 0, 0.3)) : t < 0.7 ? 1 : t < 0.95 ? 1 - easeIn(seg(t, 0.7, 0.95)) : 0;
  const bob = t >= 0.3 && t < 0.7 ? Math.sin(seg(t, 0.3, 0.7) * Math.PI * 2) * size * 0.02 : 0;
  drawBase(ctx, base, { dy: hidden + (eye - hidden) * k + bob });
  return c;
};

function curtainPanel(ctx: CanvasRenderingContext2D, x: number, w: number, size: number) {
  ctx.fillStyle = "#5a2d91";
  ctx.fillRect(x, 0, w, size);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1, size * 0.02);
  const step = Math.max(4, size * 0.08);
  for (let px = x + step / 2; px < x + w; px += step) {
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, size);
    ctx.stroke();
  }
}

/** 幕あけ: curtains part from the center, reveal, then close. */
export const createCurtainOpenFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const open = t < 0.35 ? easeInOut(seg(t, 0, 0.35)) : t < 0.65 ? 1 : 1 - easeInOut(seg(t, 0.65, 0.95));
  drawBase(ctx, base);
  const gap = (size / 2) * open;
  curtainPanel(ctx, 0, size / 2 - gap, size);
  curtainPanel(ctx, size / 2 + gap, size / 2 - gap, size);
  return c;
};

/** 丸く登場: circular iris grows from the center, holds, shrinks. */
export const createIrisOpenFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const open = t < 0.35 ? easeOut(seg(t, 0, 0.35)) : t < 0.65 ? 1 : t < 0.95 ? 1 - easeIn(seg(t, 0.65, 0.95)) : 0;
  if (open <= 0) return c;
  const r = size * 0.72 * open;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = lineWidth(size, 0.02);
  ctx.stroke();
  return c;
};

/** ななめ登場: a diagonal edge sweeps across to reveal, a second sweep hides. */
export const createDiagonalRevealFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const kIn = t < 0.4 ? easeInOut(seg(t, 0, 0.4)) : 1;
  const kOut = t < 0.6 ? 0 : easeInOut(seg(t, 0.6, 1));
  const front = kIn * 2 * size; // x + y < front is revealed
  const back = kOut * 2 * size;  // x + y < back is hidden again
  if (front <= back) return c;
  ctx.save();
  ctx.beginPath();
  // region back <= x+y <= front
  ctx.moveTo(back, 0);
  ctx.lineTo(front, 0);
  ctx.lineTo(0, front);
  ctx.lineTo(0, back);
  ctx.closePath();
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = lineWidth(size, 0.02);
  ctx.beginPath();
  ctx.moveTo(front, 0);
  ctx.lineTo(0, front);
  ctx.stroke();
  return c;
};

/** ぺたん: drops in large and faint, lands like a stamp with impact lines, lifts off at the end. */
export const createStampFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  if (t < 0.25) {
    const k = easeIn(seg(t, 0, 0.25));
    drawBase(ctx, base, { scale: 1.7 - 0.7 * k, alpha: 0.25 + 0.75 * k });
    return c;
  }
  if (t < 0.85) {
    drawBase(ctx, base);
    if (t < 0.42) {
      const p = seg(t, 0.25, 0.42);
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = lineWidth(size, 0.03);
      ctx.lineCap = "round";
      ctx.globalAlpha = 1 - p;
      const r0 = Math.max(b.w, b.h) * 0.55, r1 = r0 + size * (0.05 + 0.12 * p);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.beginPath();
        ctx.moveTo(b.cx + Math.cos(a) * r0, b.cy + Math.sin(a) * r0);
        ctx.lineTo(b.cx + Math.cos(a) * r1, b.cy + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
    }
    return c;
  }
  // lift-off ends exactly where frame 0 starts (scale 1.7 / alpha 0.25) so the loop has no jump
  // alpha drops below 0.5 by frame 19 (GIF 1-bit transparency) so the decoded
  // loop goes empty → empty → fade-in without a visible pop
  const k = seg(t, 0.85, 1);
  drawBase(ctx, base, { scale: 1 + 0.7 * k, alpha: 1 - k * 0.9 });
  return c;
};

/** パタンと開く: two folded halves open from the center line, then fold back. */
export const createPaperUnfoldFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const open = t < 0.4 ? easeOutBack(seg(t, 0, 0.4)) : t < 0.7 ? 1 : 1 - easeInOut(seg(t, 0.7, 1));
  const sx = Math.max(0.02, Math.min(1, open));
  for (const side of [-1, 1] as const) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(side < 0 ? 0 : size / 2, 0, size / 2, size);
    ctx.clip();
    ctx.translate(size / 2, 0);
    ctx.scale(sx, 1);
    ctx.translate(-size / 2, 0);
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - sx)})`;
    ctx.fillRect(side < 0 ? 0 : size / 2, 0, size / 2, size);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, size * 0.012);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  return c;
};

/** 転送: a light ring travels bottom→top revealing the body below it, then top→bottom hiding it. */
export const createTeleportRingFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  let ringY: number, visibleFrom: number;
  if (t < 0.45) {
    ringY = size * (1 - easeInOut(seg(t, 0, 0.45)));
    visibleFrom = ringY;
  } else if (t < 0.7) {
    ringY = -size;
    visibleFrom = 0;
  } else {
    ringY = size * easeInOut(seg(t, 0.7, 1));
    visibleFrom = ringY; // hide from the top down
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, visibleFrom, size, size - visibleFrom);
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  if (ringY >= -size * 0.1 && ringY <= size * 1.1) {
    ctx.save();
    ctx.strokeStyle = "#7df9ff";
    ctx.lineWidth = lineWidth(size, 0.035);
    ctx.shadowColor = "#7df9ff";
    ctx.shadowBlur = size * 0.06;
    ctx.beginPath();
    ctx.ellipse(size / 2, ringY, size * 0.42, size * 0.06, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  return c;
};

/** 筆で登場: thick brush strokes paint the image in band by band, then it fades. */
export const createBrushRevealFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const bands = 4;
  const bandH = size / bands;
  const paintT = seg(t, 0, 0.6) * bands; // bands painted sequentially
  const alpha = t < 0.8 ? 1 : 1 - seg(t, 0.8, 0.95);
  if (alpha <= 0) return c;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (let k = 0; k < bands; k++) {
    const p = Math.min(1, Math.max(0, paintT - k));
    if (p <= 0) continue;
    const w = size * p;
    const y = k * bandH;
    const leftToRight = k % 2 === 0;
    const x = leftToRight ? 0 : size - w;
    // slightly wavy top/bottom edges for a brush feel
    const wave = bandH * 0.12;
    ctx.moveTo(x, y + wave);
    for (let s = 0; s <= 4; s++) ctx.lineTo(x + (w * s) / 4, y + (s % 2 === 0 ? wave : 0));
    ctx.lineTo(x + w, y + bandH);
    for (let s = 4; s >= 0; s--) ctx.lineTo(x + (w * s) / 4, y + bandH - (s % 2 === 0 ? wave : 0));
    ctx.closePath();
  }
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  return c;
};
