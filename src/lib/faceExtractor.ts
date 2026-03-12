/**
 * Video face extraction pipeline:
 * 1. Extract frames from video at 1-second intervals
 * 2. Detect faces using MediaPipe FaceDetector
 * 3. Return top candidates sorted by detection confidence, deduped
 */

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorInstance: FaceDetector | null = null;

async function getDetector(): Promise<FaceDetector> {
  if (detectorInstance) return detectorInstance;
  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
  detectorInstance = await FaceDetector.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_CDN, delegate: "GPU" },
    runningMode: "IMAGE",
    minDetectionConfidence: 0.5,
  });
  return detectorInstance;
}

export interface FaceCandidate {
  /** Frame timestamp in seconds */
  time: number;
  /** Detection confidence score */
  score: number;
  /** Full frame as canvas */
  frameCanvas: HTMLCanvasElement;
  /** Auto-cropped face region as canvas (square with padding) */
  croppedCanvas: HTMLCanvasElement;
}

/** Extract frames from video at 1-second intervals */
async function extractFrames(
  video: HTMLVideoElement,
  onProgress: (pct: number) => void
): Promise<{ time: number; canvas: HTMLCanvasElement }[]> {
  const duration = Math.min(video.duration, 30);
  const totalFrames = Math.floor(duration);
  const frames: { time: number; canvas: HTMLCanvasElement }[] = [];

  for (let t = 0; t < duration; t += 1) {
    video.currentTime = t;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    frames.push({ time: t, canvas });

    onProgress(((t + 1) / totalFrames) * 0.5); // frames = first 50%
  }

  return frames;
}

/** Compute average pixel difference between two same-size canvases (0-255 scale) */
function pixelDiffAvg(a: HTMLCanvasElement, b: HTMLCanvasElement): number {
  const size = 64; // downscale for speed
  const tmpA = document.createElement("canvas");
  tmpA.width = size;
  tmpA.height = size;
  const ctxA = tmpA.getContext("2d")!;
  ctxA.drawImage(a, 0, 0, size, size);
  const dataA = ctxA.getImageData(0, 0, size, size).data;

  const tmpB = document.createElement("canvas");
  tmpB.width = size;
  tmpB.height = size;
  const ctxB = tmpB.getContext("2d")!;
  ctxB.drawImage(b, 0, 0, size, size);
  const dataB = ctxB.getImageData(0, 0, size, size).data;

  let sum = 0;
  const len = dataA.length;
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(dataA[i] - dataB[i]);
    sum += Math.abs(dataA[i + 1] - dataB[i + 1]);
    sum += Math.abs(dataA[i + 2] - dataB[i + 2]);
  }

  // cleanup
  tmpA.width = 0; tmpA.height = 0;
  tmpB.width = 0; tmpB.height = 0;

  return sum / ((len / 4) * 3);
}

/** Crop a square region around the face bounding box with padding */
function cropFace(
  frameCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  padding: number = 0.25
): HTMLCanvasElement {
  const fw = frameCanvas.width;
  const fh = frameCanvas.height;

  // Expand bounding box with padding
  const padX = w * padding;
  const padY = h * padding;
  let cx = x - padX;
  let cy = y - padY;
  let cw = w + padX * 2;
  let ch = h + padY * 2;

  // Make square (use the larger dimension)
  const side = Math.max(cw, ch);
  cx = cx - (side - cw) / 2;
  cy = cy - (side - ch) / 2;
  cw = side;
  ch = side;

  // Clamp to frame bounds
  cx = Math.max(0, Math.min(cx, fw - 1));
  cy = Math.max(0, Math.min(cy, fh - 1));
  cw = Math.min(cw, fw - cx);
  ch = Math.min(ch, fh - cy);

  const cropCanvas = document.createElement("canvas");
  const outSize = Math.max(256, Math.round(Math.min(cw, ch)));
  cropCanvas.width = outSize;
  cropCanvas.height = outSize;
  const ctx = cropCanvas.getContext("2d")!;
  ctx.drawImage(frameCanvas, cx, cy, cw, ch, 0, 0, outSize, outSize);

  return cropCanvas;
}

const SIMILARITY_THRESHOLD = 15; // pixel diff below this = too similar
const MAX_CANDIDATES = 8;

/** Main pipeline: extract faces from video file */
export async function extractFacesFromVideo(
  file: File,
  onProgress: (pct: number, label: string) => void
): Promise<FaceCandidate[]> {
  // Validate
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("動画ファイルは50MB以下にしてください");
  }

  // Load video
  onProgress(0, "動画を読み込み中...");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(file);

  try {
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("動画の読み込みに失敗しました"));
    });

    if (video.duration > 35) {
      throw new Error("30秒以内の動画を選択してください");
    }

    // Extract frames
    onProgress(0.05, "フレームを抽出中...");
    const frames = await extractFrames(video, (pct) =>
      onProgress(pct, "フレームを抽出中...")
    );

    // Detect faces
    onProgress(0.5, "顔を検出中...");
    const detector = await getDetector();

    type RawCandidate = {
      time: number;
      score: number;
      frameCanvas: HTMLCanvasElement;
      faceX: number;
      faceY: number;
      faceW: number;
      faceH: number;
    };

    const rawCandidates: RawCandidate[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const result = detector.detect(frame.canvas);
      const detections = result.detections || [];

      for (const det of detections) {
        const bb = det.boundingBox;
        if (!bb) continue;
        const score = det.categories?.[0]?.score ?? 0;
        if (score < 0.5) continue;

        rawCandidates.push({
          time: frame.time,
          score,
          frameCanvas: frame.canvas,
          faceX: bb.originX,
          faceY: bb.originY,
          faceW: bb.width,
          faceH: bb.height,
        });
      }

      onProgress(0.5 + ((i + 1) / frames.length) * 0.4, "顔を検出中...");
    }

    // Sort by score descending
    rawCandidates.sort((a, b) => b.score - a.score);

    // Deduplicate similar frames
    onProgress(0.9, "候補を選別中...");
    const candidates: FaceCandidate[] = [];

    for (const raw of rawCandidates) {
      if (candidates.length >= MAX_CANDIDATES) break;

      const croppedCanvas = cropFace(
        raw.frameCanvas,
        raw.faceX,
        raw.faceY,
        raw.faceW,
        raw.faceH
      );

      // Check similarity with existing candidates
      let tooSimilar = false;
      for (const existing of candidates) {
        if (pixelDiffAvg(croppedCanvas, existing.croppedCanvas) < SIMILARITY_THRESHOLD) {
          tooSimilar = true;
          croppedCanvas.width = 0;
          croppedCanvas.height = 0;
          break;
        }
      }

      if (!tooSimilar) {
        candidates.push({
          time: raw.time,
          score: raw.score,
          frameCanvas: raw.frameCanvas,
          croppedCanvas,
        });
      }
    }

    // Cleanup unused frames
    for (const frame of frames) {
      if (!candidates.some((c) => c.frameCanvas === frame.canvas)) {
        frame.canvas.width = 0;
        frame.canvas.height = 0;
      }
    }

    onProgress(1, "完了");
    return candidates;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convert a canvas to a File (PNG) for passing to existing pipeline */
export function canvasToFile(canvas: HTMLCanvasElement, filename: string = "face_crop.png"): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], filename, { type: "image/png" }));
    }, "image/png");
  });
}
