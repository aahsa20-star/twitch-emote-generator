/**
 * v2 decor / symbols (05 設計案 #25–#32): speech-pop, applause, cheer-rays,
 * crown, checkmark, crossmark, exclamation, loading-dots. Symbols are drawn
 * with outlines and minimum stroke widths so they read at 28px.
 */
import type { FrameGenerator } from "./types";
import { newCanvas, drawBase, easeOut, easeOutBack, easeInOut, seg, lineWidth, contentBounds, outlinedText, roundedRect, star } from "./helpers";

/** ふきだし: a speech bubble grows above and shows three dots in turn. */
export const createSpeechPopFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  const grow = t < 0.25 ? easeOutBack(seg(t, 0, 0.25)) : t < 0.85 ? 1 : 1 - easeInOut(seg(t, 0.85, 1));
  if (grow <= 0.02) return c;
  const w = size * 0.42 * grow, h = size * 0.24 * grow;
  const x = Math.min(size - w - 1, b.right - b.w * 0.25), y = Math.max(1, b.top - h - size * 0.04);
  ctx.save();
  roundedRect(ctx, x, y, w, h, h * 0.45);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = lineWidth(size, 0.02, 1);
  ctx.strokeStyle = "#333";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h);
  ctx.lineTo(x + w * 0.2, y + h + h * 0.35);
  ctx.lineTo(x + w * 0.45, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const dots = t < 0.7 ? Math.floor(seg(t, 0.3, 0.7) * 3.999) : 3;
  const r = Math.max(1.5, h * 0.14);
  for (let k = 0; k < dots; k++) {
    ctx.beginPath();
    ctx.arc(x + w * (0.3 + k * 0.2), y + h * 0.5, r, 0, Math.PI * 2);
    ctx.fillStyle = "#333";
    ctx.fill();
  }
  ctx.restore();
  return c;
};

function hand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  roundedRect(ctx, -w / 2, -h / 2, w, h, w * 0.3);
  ctx.fillStyle = "#ffd9b3";
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.12);
  ctx.strokeStyle = "#8a5a2b";
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + (w * (k + 1)) / 4, -h / 2);
    ctx.lineTo(-w / 2 + (w * (k + 1)) / 4, -h * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** 拍手: two simple hands clap twice per loop with contact lines. */
export const createApplauseFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  const clap = Math.max(0, Math.sin(t * Math.PI * 4)); // two claps
  const w = Math.max(5, size * 0.13), h = w * 1.25;
  const y = Math.min(size - h / 2 - 1, b.bottom - h * 0.2);
  const gap = size * 0.1 * (1 - clap) + w * 0.55;
  hand(ctx, b.cx - gap, y, w, h, false);
  hand(ctx, b.cx + gap, y, w, h, true);
  if (clap > 0.85) {
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = lineWidth(size, 0.025);
    ctx.lineCap = "round";
    ctx.globalAlpha = (clap - 0.85) / 0.15;
    for (const a of [-1.2, 0, 1.2]) {
      ctx.beginPath();
      ctx.moveTo(b.cx + Math.sin(a) * w * 0.2, y - h * 0.65 + Math.cos(a) * -w * 0.1);
      ctx.lineTo(b.cx + Math.sin(a) * w * 0.7, y - h * 0.65 - Math.cos(a) * w * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  return c;
};

/** 応援: short lines from the left and right edges flash inward alternately. */
export const createCheerRaysFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  drawBase(ctx, base, { scale: 1 + 0.02 * Math.max(0, Math.sin(t * Math.PI * 4)), py: 1 });
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = lineWidth(size, 0.035);
  for (const [side, phase] of [[-1, 0], [1, 0.5]] as const) {
    const p = (t + phase) % 1;
    const a = p < 0.5 ? Math.sin(p * Math.PI * 2) : 0;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.strokeStyle = side < 0 ? "#ff7eb3" : "#7ec8ff";
    const x0 = side < 0 ? size * 0.02 : size * 0.98;
    const len = size * (0.12 + 0.06 * a);
    for (let k = -1; k <= 1; k++) {
      const y = size * 0.5 + k * size * 0.16;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 - side * len, y + k * size * 0.03);
      ctx.stroke();
    }
  }
  ctx.restore();
  return c;
};

/** 王冠: lands on the head, straightens, flashes once, lifts off. */
export const createCrownFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  const w = Math.max(8, b.w * 0.5), h = w * 0.55;
  const restY = Math.max(h * 0.5 + 1, b.top - h * 0.15);
  let y: number, tilt: number, alpha = 1;
  if (t < 0.3) {
    const p = easeOutBack(seg(t, 0, 0.3));
    y = -h + (restY + h) * p;
    tilt = -0.35;
  } else if (t < 0.45) {
    y = restY;
    tilt = -0.35 * (1 - easeInOut(seg(t, 0.3, 0.45)));
  } else if (t < 0.9) {
    y = restY;
    tilt = 0;
  } else {
    const p = seg(t, 0.9, 1);
    y = restY - p * size * 0.3;
    tilt = 0;
    alpha = 1 - p;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(b.cx, y);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-w / 2, h / 2);
  ctx.lineTo(-w / 2, -h * 0.2);
  ctx.lineTo(-w / 4, h * 0.1);
  ctx.lineTo(0, -h / 2);
  ctx.lineTo(w / 4, h * 0.1);
  ctx.lineTo(w / 2, -h * 0.2);
  ctx.lineTo(w / 2, h / 2);
  ctx.closePath();
  ctx.fillStyle = "#ffcc33";
  ctx.fill();
  ctx.lineWidth = Math.max(1, size * 0.018);
  ctx.strokeStyle = "#8a5a00";
  ctx.stroke();
  for (const px of [-w / 2, 0, w / 2]) {
    ctx.beginPath();
    ctx.arc(px, px === 0 ? -h / 2 : -h * 0.2, Math.max(1, w * 0.06), 0, Math.PI * 2);
    ctx.fillStyle = "#ff4d6d";
    ctx.fill();
  }
  ctx.restore();
  if (t >= 0.5 && t < 0.65) {
    const p = Math.sin(seg(t, 0.5, 0.65) * Math.PI);
    ctx.save();
    ctx.globalAlpha = p;
    star(ctx, b.cx + w * 0.55, y - h * 0.4, Math.max(2, size * 0.05) * p, 4, 0.35);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }
  return c;
};

/** Draw a fraction of a polyline (0..1 of its total length). */
function partialPath(ctx: CanvasRenderingContext2D, pts: [number, number][], frac: number) {
  const lens: number[] = [];
  let total = 0;
  for (let k = 1; k < pts.length; k++) {
    const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    lens.push(l);
    total += l;
  }
  let remain = total * frac;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) {
    const l = lens[k - 1];
    if (remain >= l) {
      ctx.lineTo(pts[k][0], pts[k][1]);
      remain -= l;
    } else {
      const f = remain / l;
      ctx.lineTo(pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * f, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * f);
      break;
    }
  }
}

/** オッケー: a check mark is drawn beside the body, held, then fades. */
export const createCheckmarkFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base, { scale: 1 + 0.03 * Math.sin(Math.min(1, seg(t, 0.1, 0.4)) * Math.PI), py: 1 });
  if (t < 0.1 || t >= 0.9) return c;
  const frac = easeOut(seg(t, 0.1, 0.4));
  const alpha = t < 0.75 ? 1 : 1 - seg(t, 0.75, 0.9);
  const s = Math.max(8, size * 0.28);
  const x = Math.min(size - s * 0.55, b.right - b.w * 0.05), y = b.top + b.h * 0.25;
  const pts: [number, number][] = [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.35], [x + s * 0.5, y - s * 0.4]];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth(size, 0.075, 3);
  ctx.strokeStyle = "#ffffff";
  partialPath(ctx, pts, frac);
  ctx.stroke();
  ctx.lineWidth = lineWidth(size, 0.045, 2);
  ctx.strokeStyle = "#2ecc71";
  partialPath(ctx, pts, frac);
  ctx.stroke();
  ctx.restore();
  return c;
};

/** ダメ: two quick strokes draw an X in front, then it disappears. */
export const createCrossmarkFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const shake = t >= 0.1 && t < 0.3 ? Math.sin(seg(t, 0.1, 0.3) * Math.PI * 4) * size * 0.015 : 0;
  drawBase(ctx, base, { dx: shake });
  if (t < 0.1 || t >= 0.65) return c;
  const s = Math.max(8, Math.min(b.w, b.h) * 0.45);
  const cx = b.cx, cy = b.cy;
  const f1 = easeOut(seg(t, 0.1, 0.2)), f2 = easeOut(seg(t, 0.2, 0.3));
  const alpha = t < 0.5 ? 1 : 1 - seg(t, 0.5, 0.65);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = "round";
  for (const [lw, col] of [[0.09, "#ffffff"], [0.055, "#e63946"]] as const) {
    ctx.lineWidth = lineWidth(size, lw, col === "#ffffff" ? 3 : 2);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s);
    ctx.lineTo(cx - s + 2 * s * f1, cy - s + 2 * s * f1);
    ctx.stroke();
    if (f2 > 0) {
      ctx.beginPath();
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx + s - 2 * s * f2, cy - s + 2 * s * f2);
      ctx.stroke();
    }
  }
  ctx.restore();
  return c;
};

/** 注目: "!" pops above the head quickly, holds a beat, and goes. */
export const createExclamationFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  const hop = t < 0.2 ? Math.sin(seg(t, 0.05, 0.2) * Math.PI) * size * 0.04 : 0;
  drawBase(ctx, base, { dy: -hop });
  if (t < 0.05 || t >= 0.6) return c;
  const pop = easeOutBack(seg(t, 0.05, 0.2));
  const alpha = t < 0.5 ? 1 : 1 - seg(t, 0.5, 0.6);
  const px = Math.max(10, size * 0.32) * Math.max(0.01, pop);
  ctx.save();
  ctx.globalAlpha = alpha;
  outlinedText(ctx, "!", b.cx, Math.max(px * 0.55, b.top - size * 0.03 - hop), px, "#ff3b3b", "#ffffff");
  ctx.restore();
  return c;
};

/** 待機中: three dots bounce in sequence below the body; body stays still. */
export const createLoadingDotsFrame: FrameGenerator = (base, i, n) => {
  const size = base.width;
  const [c, ctx] = newCanvas(size);
  const t = i / n;
  const b = contentBounds(base);
  drawBase(ctx, base);
  const r = Math.max(2, size * 0.04);
  const y0 = Math.min(size - r - 1, b.bottom + r * 1.2);
  for (let k = 0; k < 3; k++) {
    const p = (t - k * 0.15 + 1) % 1;
    const up = p < 0.4 ? Math.sin((p / 0.4) * Math.PI) : 0;
    const x = b.cx + (k - 1) * r * 3.2;
    const y = y0 - up * r * 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.strokeStyle = "#333";
    ctx.stroke();
  }
  return c;
};
