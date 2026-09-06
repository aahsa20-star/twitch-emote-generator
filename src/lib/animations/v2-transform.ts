/**
 * v2 transforms (05 設計案 #41–#48 except brush-reveal): sticker-peel,
 * contour-trace, puzzle-assemble, tile-slide, page-turn, venetian-blinds,
 * ripple-ring.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeInOut, easeOut, easeOutBack, seg, lineWidth, silhouetteOutline } from "./helpers";

/** シールめくり: the bottom-right corner peels up as a triangle with a shadow, then flattens. */
export const createStickerPeelFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const k = t < 0.4 ? easeOut(seg(t, 0, 0.4)) : t < 0.6 ? 1 : 1 - easeInOut(seg(t, 0.6, 1));
  const p = size * 0.42 * k; // peel length along each edge
  if (p < 1) {
    drawBase(ctx, base);
    return c;
  }
  // visible part: everything except the peeled triangle
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size, size - p);
  ctx.lineTo(size - p, size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  // shadow under the fold
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(size, size - p);
  ctx.lineTo(size - p, size);
  ctx.lineTo(size - p * 0.9, size - p * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // folded-back face (mirrored across the fold line x + y = 2size - p)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(size, size - p);
  ctx.lineTo(size - p, size);
  ctx.lineTo(size - p, size - p);
  ctx.closePath();
  ctx.clip();
  ctx.translate(size, size);
  ctx.rotate(Math.PI / 2);
  ctx.scale(-1, 1);
  ctx.rotate(-Math.PI / 2);
  ctx.translate(-size, -size);
  ctx.translate(-p, -p);
  ctx.drawImage(base, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(235,235,235,0.85)";
  ctx.fillRect(0, 0, size * 2, size * 2);
  ctx.restore();
  return c;
};

/** ふちを描く: the silhouette outline is traced around by an angular sweep, completes, fades. */
export const createContourTraceFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base);
  const outline = silhouetteOutline(base, "#ffffff", lineWidth(size, 0.03));
  const sweep = t < 0.55 ? easeInOut(seg(t, 0, 0.55)) : 1;
  const alpha = t < 0.75 ? 1 : 1 - seg(t, 0.75, 0.9);
  if (alpha <= 0 || sweep <= 0) return c;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(size / 2, size / 2);
  ctx.arc(size / 2, size / 2, size, -Math.PI / 2, -Math.PI / 2 + sweep * Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(outline, 0, 0);
  ctx.restore();
  return c;
};

/** パズル: four quadrants fly in from four directions, lock, then scatter. */
export const createPuzzleAssembleFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const k = t < 0.45 ? 1 - easeOutBack(seg(t, 0, 0.45)) : t < 0.8 ? 0 : easeInOut(seg(t, 0.8, 1));
  const alpha = t < 0.8 ? 1 : 1 - seg(t, 0.8, 1) * 0.9;
  const d = size * 0.55 * k;
  const half = size / 2;
  const quads = [[0, 0, -d, -d], [half, 0, d, -d], [0, half, -d, d], [half, half, d, d]] as const;
  ctx.globalAlpha = alpha;
  for (const [qx, qy, ox, oy] of quads) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(qx + ox, qy + oy, half, half);
    ctx.clip();
    ctx.drawImage(base, ox, oy);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  return c;
};

/** タイル入替: 3×3 tiles; one row at a time slides sideways (wrapping) and back. */
export const createTileSlideFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const rows = 3;
  const rh = size / rows;
  const active = Math.min(rows - 1, Math.floor(t * rows));
  const local = t * rows - active;
  const shift = Math.sin(local * Math.PI) * (size / 3) * (active === 1 ? -1 : 1);
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const dx = r === active ? shift : 0;
    // draw the row twice for wrap-around
    ctx.drawImage(base, 0, y, size, rh, dx, y, size, rh);
    if (dx > 0) ctx.drawImage(base, 0, y, size, rh, dx - size, y, size, rh);
    if (dx < 0) ctx.drawImage(base, 0, y, size, rh, dx + size, y, size, rh);
  }
  return c;
};

/** ページめくり: the page turns from the right edge onto the same image beneath. */
export const createPageTurnFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const k = t < 0.6 ? easeInOut(seg(t, 0, 0.6)) : 1;
  const foldX = size * (1 - k);
  drawBase(ctx, base); // next page (same image)
  if (foldX < size - 1 && foldX > 0) {
    // the turning leaf: right part of the page mirrored onto the left of the fold
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0, 2 * foldX - size), 0, size - foldX, size);
    ctx.clip();
    ctx.translate(foldX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-foldX, 0);
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * k})`;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = lineWidth(size, 0.015, 1);
    ctx.beginPath();
    ctx.moveTo(foldX, 0);
    ctx.lineTo(foldX, size);
    ctx.stroke();
  }
  return c;
};

/** ブラインド: horizontal slats open together, hold, close. */
export const createVenetianBlindsFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const open = t < 0.35 ? easeOut(seg(t, 0, 0.35)) : t < 0.65 ? 1 : 1 - easeInOut(seg(t, 0.65, 1));
  if (open <= 0) return c;
  const slats = 6;
  const sh = size / slats;
  ctx.save();
  ctx.beginPath();
  for (let s = 0; s < slats; s++) {
    const y = s * sh + (sh * (1 - open)) / 2;
    ctx.rect(0, y, size, sh * open);
  }
  ctx.clip();
  drawBase(ctx, base);
  ctx.restore();
  return c;
};

/** 波紋: two expanding rings; only pixels near each ring are slightly displaced. */
export const createRippleRingFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base);
  const cx = size / 2, cy = size / 2;
  for (const phase of [0, 0.5]) {
    const p = (t + phase) % 1;
    const r = p * size * 0.75;
    const w = Math.max(3, size * 0.07);
    const strength = 1 + 0.06 * Math.sin(p * Math.PI);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r + w / 2, 0, Math.PI * 2);
    ctx.arc(cx, cy, Math.max(0, r - w / 2), 0, Math.PI * 2, true);
    ctx.clip();
    drawBase(ctx, base, { scale: strength, alpha: 1 });
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - p);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lineWidth(size, 0.015, 1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  return c;
};
