// Internal render size: process at high resolution for crisp borders/text
export const HI_RES = 224;

/** GIF animation render size: higher than output for crisp animation frames */
export const GIF_HI_RES = 256;

/** Max size at which USM sharpening is applied (56px and below) */
export const USM_MAX_SIZE = 56;

export interface Bounds {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface TextOverlayOptions {
  text: string;
  font: string;
  fillColor: string;
  strokeColor: string;
  position: import("@/types/emote").TextPosition;
  userFontSize?: number;
  offsetX?: number;
  offsetY?: number;
  outlineWidth?: number;
}

/** Release GPU/system memory held by a canvas that is no longer needed. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export function findContentBounds(imageData: ImageData): Bounds {
  const { width, height, data } = imageData;
  let top = height,
    left = width,
    right = 0,
    bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  if (right === 0 && bottom === 0) {
    return { top: 0, left: 0, right: width, bottom: height };
  }

  return { top, left, right: right + 1, bottom: bottom + 1 };
}
