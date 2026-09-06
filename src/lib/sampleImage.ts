/**
 * Bundled sample subject (09 §1): a purple disc with a white star, drawn at
 * runtime — no third-party asset, nothing uploaded by anyone is reused.
 */

export const SAMPLE_FILE_NAME = "sample-star.png";

export function drawSampleIcon(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#9147ff";
  ctx.fill();

  const starR = r * 0.5;
  const starInner = starR * 0.4;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const ox = cx + starR * Math.cos(angle);
    const oy = cy + starR * Math.sin(angle);
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    const ia = angle + (2 * Math.PI) / 10;
    ctx.lineTo(cx + starInner * Math.cos(ia), cy + starInner * Math.sin(ia));
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return canvas;
}

/** The sample as a transparent PNG File (already background-free). */
export function createSampleFile(size = 256): Promise<File> {
  const canvas = drawSampleIcon(size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) return reject(new Error("sample toBlob failed"));
      resolve(new File([blob], SAMPLE_FILE_NAME, { type: "image/png" }));
    }, "image/png");
  });
}
