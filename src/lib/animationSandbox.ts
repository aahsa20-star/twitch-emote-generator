/**
 * iframe sandbox for executing AI-generated animation code safely.
 *
 * The iframe runs with sandbox="allow-scripts" (no DOM access to parent).
 * Communication via postMessage with request IDs for multiplexing.
 * Always operates on 256×256 ImageData.
 */

const IFRAME_SIZE = 256;
const FRAME_TIMEOUT_MS = 10_000;

let iframe: HTMLIFrameElement | null = null;
let requestCounter = 0;
const pendingRequests = new Map<
  string,
  { resolve: (data: ImageData) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

/** HTML source for the sandboxed iframe */
const IFRAME_SRCDOC = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body><script>
// Listen for frame generation requests from parent
window.addEventListener("message", function(e) {
  var d = e.data;
  if (d.type !== "generate-frame") return;

  var reqId = d.requestId;
  try {
    // Reconstruct ImageData from raw pixel data
    var baseImageData = new ImageData(
      new Uint8ClampedArray(d.pixels),
      d.width,
      d.height
    );

    // Create an OffscreenCanvas with the base image
    var baseCanvas = document.createElement("canvas");
    baseCanvas.width = d.width;
    baseCanvas.height = d.height;
    var baseCtx = baseCanvas.getContext("2d");
    baseCtx.putImageData(baseImageData, 0, 0);

    // Execute the user-provided function body
    var fn = new Function("baseCanvas", "frameIndex", "totalFrames", d.code);
    var result = fn(baseCanvas, d.frameIndex, d.totalFrames);

    // result should be a Canvas element
    if (!result || !result.getContext) {
      throw new Error("Function must return a canvas element");
    }

    var resultCtx = result.getContext("2d");
    var outData = resultCtx.getImageData(0, 0, result.width, result.height);

    parent.postMessage({
      type: "frame-result",
      requestId: reqId,
      pixels: Array.from(outData.data),
      width: outData.width,
      height: outData.height
    }, "*");
  } catch (err) {
    parent.postMessage({
      type: "frame-error",
      requestId: reqId,
      error: err.message || String(err)
    }, "*");
  }
});

parent.postMessage({ type: "sandbox-ready" }, "*");
<\/script></body></html>`;

function handleMessage(e: MessageEvent) {
  const d = e.data;
  if (!d || !d.type) return;

  if (d.type === "frame-result") {
    const pending = pendingRequests.get(d.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(d.requestId);
      const imageData = new ImageData(
        new Uint8ClampedArray(d.pixels),
        d.width,
        d.height
      );
      pending.resolve(imageData);
    }
  } else if (d.type === "frame-error") {
    const pending = pendingRequests.get(d.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(d.requestId);
      pending.reject(new Error(d.error));
    }
  }
}

/** Ensure the sandbox iframe exists and is ready */
function ensureIframe(): Promise<void> {
  if (iframe && iframe.parentNode) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    iframe = document.createElement("iframe");
    iframe.sandbox.add("allow-scripts");
    iframe.style.display = "none";
    iframe.srcdoc = IFRAME_SRCDOC;

    const onReady = (e: MessageEvent) => {
      if (e.data?.type === "sandbox-ready") {
        window.removeEventListener("message", onReady);
        resolve();
      }
    };
    window.addEventListener("message", onReady);
    window.addEventListener("message", handleMessage);

    document.body.appendChild(iframe);
  });
}

/**
 * Generate a single animation frame by executing code in the sandbox.
 *
 * @param code - The function body string (params: baseCanvas, frameIndex, totalFrames)
 * @param baseImageData - 256×256 source ImageData
 * @param frameIndex - Current frame number (0-based)
 * @param totalFrames - Total number of frames
 * @returns Promise<ImageData> - The generated frame
 */
export async function generateFrameInSandbox(
  code: string,
  baseImageData: ImageData,
  frameIndex: number,
  totalFrames: number
): Promise<ImageData> {
  await ensureIframe();

  const requestId = `req-${++requestCounter}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Frame generation timed out (${FRAME_TIMEOUT_MS}ms)`));
    }, FRAME_TIMEOUT_MS);

    pendingRequests.set(requestId, { resolve, reject, timer });

    iframe!.contentWindow!.postMessage(
      {
        type: "generate-frame",
        requestId,
        code,
        pixels: Array.from(baseImageData.data),
        width: baseImageData.width,
        height: baseImageData.height,
        frameIndex,
        totalFrames,
      },
      "*"
    );
  });
}

/**
 * Generate all 20 animation frames using the sandbox.
 * Returns an array of ImageData (256×256 each).
 */
export async function generateAllFrames(
  code: string,
  baseImageData: ImageData,
  totalFrames: number = 20
): Promise<ImageData[]> {
  const frames: ImageData[] = [];
  for (let i = 0; i < totalFrames; i++) {
    const frame = await generateFrameInSandbox(code, baseImageData, i, totalFrames);
    frames.push(frame);
  }
  return frames;
}

/**
 * Convert ImageData frames into an animated GIF blob.
 * Uses gif.js (already available in the project).
 */
export async function framesToGif(
  frames: ImageData[],
  size: number = IFRAME_SIZE,
  frameDelay: number = 50
): Promise<Blob> {
  const GIF = (await import("gif.js")).default;

  return new Promise((resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: size,
      height: size,
      workerScript: "/gif.worker.js",
      transparent: 0x00000000 as unknown as string,
      repeat: 0,
    });

    for (const frame of frames) {
      // Create a canvas from ImageData for gif.js
      const canvas = document.createElement("canvas");
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(frame, 0, 0);
      gif.addFrame(canvas, { delay: frameDelay, copy: true });
    }

    gif.on("finished", (blob: Blob) => resolve(blob));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gif as any).on("error", (err: Error) => reject(err));
    gif.render();
  });
}

/** Clean up the sandbox iframe */
export function destroySandbox() {
  if (iframe?.parentNode) {
    iframe.parentNode.removeChild(iframe);
  }
  iframe = null;
  for (const [, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error("Sandbox destroyed"));
  }
  pendingRequests.clear();
  window.removeEventListener("message", handleMessage);
}
