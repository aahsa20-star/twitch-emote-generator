/**
 * Frame generator function signature.
 * Each animation implements this interface to produce a single frame.
 */
export type FrameGenerator = (
  baseCanvas: HTMLCanvasElement,
  frameIndex: number,
  totalFrames: number
) => HTMLCanvasElement;
