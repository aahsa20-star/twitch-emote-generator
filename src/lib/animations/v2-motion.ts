/**
 * v2 motion (05 設計案 #17–#24): orbit, zigzag, stairs, roll-across,
 * swing-rope, slingshot, crawl, orbit-pair. Every path is closed so the loop
 * seam has no jump.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeInOut, easeOut, easeIn, seg, lineWidth, contentBounds } from "./helpers";

/** 円を描く: small circular path, orientation kept. */
export const createOrbitFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const r = size * 0.07;
  drawBase(ctx, base, { dx: Math.cos(t * Math.PI * 2) * r, dy: Math.sin(t * Math.PI * 2) * r });
  return c;
};

/** ジグザグ: polyline path with short stops at each corner (closed loop). */
export const createZigzagFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const a = size * 0.09;
  const pts = [[-a, a], [0, -a], [a, a], [0, -a * 0.2], [-a, a]] as const; // back to start
  const segs = pts.length - 1;
  const local = t * segs;
  const k = Math.min(segs - 1, Math.floor(local));
  const f = local - k;
  const move = f < 0.75 ? easeInOut(f / 0.75) : 1; // 25% of each segment is a stop
  const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
  drawBase(ctx, base, { dx: x0 + (x1 - x0) * move, dy: y0 + (y1 - y0) * move });
  return c;
};

/** 階段のぼり: three steps up-right, exits at the edge, reappears at the start. */
export const createStairsFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const step = size * 0.055;
  // faint steps for context
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = lineWidth(size, 0.02, 1);
  const bx = size * 0.32, by = size * 0.9;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    ctx.moveTo(bx + k * step * 1.6, by - k * step);
    ctx.lineTo(bx + (k + 1) * step * 1.6, by - k * step);
    ctx.lineTo(bx + (k + 1) * step * 1.6, by - (k + 1) * step);
  }
  ctx.stroke();
  ctx.restore();
  let dx = -step * 1.6 * 1.5, dy = step * 1.5, alpha = 1;
  if (t < 0.72) {
    const local = (t / 0.72) * 3;
    const k = Math.min(2, Math.floor(local));
    const f = local - k;
    const upX = k * step * 1.6, upY = -k * step;
    const hop = f < 0.5 ? easeOut(f / 0.5) : 1;
    const jumpArc = Math.sin(Math.min(1, f / 0.5) * Math.PI) * step * 0.6;
    dx += upX + step * 1.6 * hop;
    dy += upY - step * hop - jumpArc;
  } else if (t < 0.86) {
    const p = easeIn(seg(t, 0.72, 0.86));
    dx += 3 * step * 1.6 + p * size * 0.35;
    dy += -3 * step - p * size * 0.35;
    alpha = 1 - p;
  } else {
    alpha = seg(t, 0.86, 1);
  }
  drawBase(ctx, base, { dx, dy, alpha });
  return c;
};

/** ころころ移動: rolls right and back along the bottom edge, rotation synced to travel. */
export const createRollAcrossFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const travel = size * 0.22;
  const tri = t < 0.5 ? t * 2 : 2 - t * 2; // 0→1→0
  const x = (easeInOut(tri) * 2 - 1) * travel;
  const radius = Math.max(b.w, b.h) / 2;
  const angle = x / radius;
  drawBase(ctx, base, { dx: x, rotation: angle, px: b.cx / size, py: b.cy / size });
  return c;
};

/** ブランコ: swings from a pivot above the canvas on a thin rope. */
export const createSwingRopeFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const pivotX = size / 2, pivotY = -size * 0.15;
  const angle = Math.sin(t * Math.PI * 2) * (22 * Math.PI) / 180;
  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);
  ctx.translate(-pivotX, -pivotY);
  ctx.strokeStyle = "#c9a36b";
  ctx.lineWidth = lineWidth(size, 0.018, 1);
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(b.cx, b.top + b.h * 0.05);
  ctx.stroke();
  ctx.drawImage(base, 0, 0);
  ctx.restore();
  return c;
};

/** ひっぱって発射: pulled left, held, launched right, wraps around from the left. */
export const createSlingshotFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  let dx: number, sx = 1, alpha = 1;
  if (t < 0.3) {
    const p = easeOut(seg(t, 0, 0.3));
    dx = -size * 0.14 * p;
    sx = 1 + 0.12 * p;
  } else if (t < 0.45) {
    dx = -size * 0.14 + Math.sin(seg(t, 0.3, 0.45) * Math.PI * 6) * size * 0.008;
    sx = 1.12;
  } else if (t < 0.7) {
    const p = easeIn(seg(t, 0.45, 0.7));
    dx = -size * 0.14 + p * size * 1.3;
    sx = 1.12 - 0.3 * Math.min(1, p * 2);
    alpha = p > 0.75 ? 1 - (p - 0.75) * 4 : 1;
  } else {
    const p = easeOut(seg(t, 0.7, 1));
    dx = -size * 0.6 + p * size * 0.6;
    alpha = Math.min(1, p * 3);
  }
  drawBase(ctx, base, { dx, scaleX: sx });
  return c;
};

/** もぞもぞ: inch-worm — alternate edge compressions while creeping along the bottom. */
export const createCrawlFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const phase = t * Math.PI * 4;
  const s = Math.sin(phase);
  const squeeze = 0.12 * Math.abs(s);
  const px = s >= 0 ? 0 : 1; // compress from left, then from right
  const tri = t < 0.5 ? t * 2 : 2 - t * 2;
  const dx = (easeInOut(tri) * 2 - 1) * size * 0.05;
  drawBase(ctx, base, { scaleX: 1 - squeeze, scaleY: 1 + squeeze * 0.4, px, py: 1, dx });
  return c;
};

/** 分身まわり: two small clones orbit, passing behind and in front of the body. */
export const createOrbitPairFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const r = Math.max(b.w, b.h) * 0.42 + size * 0.06;
  const clones = [0, Math.PI].map((off) => {
    const a = t * Math.PI * 2 + off;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.35, front: Math.sin(a) > 0, a };
  });
  const drawClone = (cl: { x: number; y: number }) =>
    drawBase(ctx, base, { dx: cl.x, dy: cl.y, scale: 0.3, alpha: 0.9, px: b.cx / size, py: b.cy / size });
  for (const cl of clones) if (!cl.front) drawClone(cl);
  drawBase(ctx, base);
  for (const cl of clones) if (cl.front) drawClone(cl);
  return c;
};
