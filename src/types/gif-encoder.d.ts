/**
 * Minimal typing for gif.js's internal encoder (used directly by
 * src/lib/gif/encoder-core.ts so transparency can be applied at the palette
 * index level). Not part of gif.js's public API — pinned to gif.js 0.2.0.
 */
declare module "gif.js/src/GIFEncoder.js" {
  interface ByteArray {
    pages: Uint8Array[];
    cursor: number;
    page: number;
    writeByte(v: number): void;
    writeUTFBytes(s: string): void;
    writeBytes(a: ArrayLike<number>, offset?: number, length?: number): void;
  }
  class GIFEncoder {
    constructor(width: number, height: number);
    width: number;
    height: number;
    firstFrame: boolean;
    transparent: number | null;
    transIndex: number;
    delay: number;
    repeat: number;
    colorTab: number[] | Uint8Array | null;
    indexedPixels: Uint8Array;
    pixels: Uint8Array | null;
    out: ByteArray;
    setDelay(ms: number): void;
    setRepeat(repeat: number): void;
    setTransparent(color: number | null): void;
    setQuality(q: number): void;
    setDither(d: string | boolean): void;
    setGlobalPalette(p: unknown): void;
    writeHeader(): void;
    addFrame(data: Uint8Array | Uint8ClampedArray): void;
    analyzePixels(): void;
    writeGraphicCtrlExt(): void;
    writeShort(v: number): void;
    finish(): void;
    stream(): ByteArray;
  }
  export = GIFEncoder;
}
