/**
 * Video face extraction pipeline:
 * 1. Extract frames from video (seek-based on PC, playback-based on mobile)
 * 2. Detect faces using MediaPipe FaceDetector
 * 3. Return top candidates sorted by detection confidence, deduped
 *
 * Mobile Safari cannot reliably seek via video.currentTime, so mobile uses
 * video.play() at 2x speed with requestAnimationFrame to capture frames.
 */

import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";
const MODEL_CDN = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let detectorInstance: FaceDetector | null = null;
let detectorDelegate: "GPU" | "CPU" | null = null;

const isMobile = () =>
  typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

/**
 * WebGL がソフトウェアレンダリング（SwiftShader / llvmpipe 等）で動いているか判定。
 *
 * Windows + Edge で GPU ハードウェアアクセラレーションが無効な環境では、
 * WebGL コンテキスト作成が「成功はするが SwiftShader にフォールバックして
 * 極端に遅い」ことがある。その場合 MediaPipe の GPU delegate を使うと
 * detect() が数秒/フレームになりメインスレッドをブロック → フリーズ。
 * 事前にソフトウェアレンダリングを検出して CPU delegate (XNNPACK) を優先する。
 *
 * 取得不能/WebGL 無しは「ソフトウェア扱い（= CPU 優先）」に倒す。
 */
function isSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return true; // WebGL 自体が使えない → CPU 優先
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbg) return false; // renderer 不明 → ハードウェアと仮定（従来どおり GPU 優先）
    const renderer = String(
      gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "",
    ).toLowerCase();
    return (
      renderer === "" ||
      renderer.includes("swiftshader") ||
      renderer.includes("software") ||
      renderer.includes("llvmpipe") ||
      renderer.includes("basic render")
    );
  } catch {
    return false;
  }
}

/**
 * FaceDetector を取得（delegate フォールバック付き）。
 *
 * 動作確定済みの原因（fix12）:
 *   GPU 非アクセラレーション環境で `delegate: "GPU"` のまま初期化すると
 *   `emscripten_webgl_create_context() returned error 0; StartGraph failed`
 *   で初期化が失敗する。これを catch して CPU delegate にフォールバックする。
 *
 * delegate 選択順:
 *   - Mobile           → ["CPU"]
 *   - PC + ソフトウェアGL → ["CPU"]（SwiftShader の遅い detect を回避）
 *   - PC + ハードウェアGL → ["GPU", "CPU"]（GPU 失敗時は CPU に降格）
 *
 * 全 delegate が失敗したら "FACE_DETECTOR_INIT_FAILED" を throw（UI が
 * 環境非対応メッセージを表示）。
 *
 * キャッシュ: 一度成功した detector はどの delegate でも再利用する。
 */
async function getDetector(): Promise<FaceDetector> {
  if (detectorInstance) return detectorInstance;

  let preferredDelegates: ("GPU" | "CPU")[];
  if (isMobile()) {
    preferredDelegates = ["CPU"];
  } else if (isSoftwareWebGL()) {
    preferredDelegates = ["CPU"];
  } else {
    preferredDelegates = ["GPU", "CPU"];
  }

  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

  let lastError: unknown = null;
  for (const delegate of preferredDelegates) {
    try {
      const instance = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_CDN, delegate },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.15,
      });
      detectorInstance = instance;
      detectorDelegate = delegate;
      if (delegate === "CPU" && preferredDelegates[0] === "GPU") {
        console.warn(
          "[faceExtractor] GPU delegate 初期化失敗 → CPU フォールバックで動作",
        );
      }
      return instance;
    } catch (e) {
      lastError = e;
      console.warn(`[faceExtractor] ${delegate} delegate 初期化失敗`, e);
    }
  }

  console.error("[faceExtractor] 全 delegate の初期化に失敗", lastError);
  throw new Error("FACE_DETECTOR_INIT_FAILED");
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

const MAX_FRAME_WIDTH_PC = 960;
const MAX_FRAME_WIDTH_PC_LOW = 640; // fix13: 低メモリ環境のフレーム幅
const MAX_FRAME_WIDTH_MOBILE = 640;
const FRAME_INTERVAL_PC = 1;
const FRAME_INTERVAL_PC_LOW = 3; // fix13: 低メモリ環境のフレーム間隔（秒）
const FRAME_INTERVAL_MOBILE = 3;
const MOBILE_PLAYBACK_RATE = 2;

/**
 * fix13: 低メモリ環境の判定（client-side runtime のみで呼ぶこと）。
 *
 * ⚠️ module top-level では呼ばない。Next.js の SSR/build 時に評価されると
 * navigator / document が存在せずクラッシュする。必ず extractFacesFromVideo
 * など関数内（ブラウザ実行時）で呼ぶ。
 *
 * 判定基準:
 *   - navigator.deviceMemory <= 4 (GB)（Chrome/Edge のみ。Safari は undefined）
 *   - WebGL がソフトウェアレンダリング（SwiftShader 等、fix12 の検出を再利用）
 *
 * いずれかに該当すれば軽量モード（フレーム間引き + 解像度低下）で動作させ、
 * 30秒動画 60MB+ のフレーム保持による OOM タブ kill を回避する。
 */
export function isLowMemoryEnvironment(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  if (typeof memory === "number" && memory <= 4) return true;
  if (isSoftwareWebGL()) return true;
  return false;
}

/** Seek video and wait until frame data is ready (PC only) */
async function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  video.currentTime = time;
  await new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      if (video.readyState >= 2) done();
    };
    video.addEventListener("seeked", onSeeked);

    let polls = 0;
    const poll = () => {
      if (resolved) return;
      if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.5) {
        done();
        return;
      }
      if (++polls > 100) { done(); return; }
      setTimeout(poll, 50);
    };
    setTimeout(poll, 100);
  });
}

/** Extract a single frame from video at the given time via seek (PC only) */
async function extractFrame(
  video: HTMLVideoElement,
  time: number,
  maxWidth: number = MAX_FRAME_WIDTH_PC
): Promise<HTMLCanvasElement> {
  await seekTo(video, time);
  return captureCurrentFrame(video, maxWidth);
}

/** Capture the current video frame to a downscaled canvas */
function captureCurrentFrame(
  video: HTMLVideoElement,
  maxWidth: number
): HTMLCanvasElement {
  const scale = video.videoWidth > maxWidth
    ? maxWidth / video.videoWidth
    : 1;
  const w = Math.round(video.videoWidth * scale);
  const h = Math.round(video.videoHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas;
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

type RawCandidate = {
  time: number;
  score: number;
  frameCanvas: HTMLCanvasElement;
  faceX: number;
  faceY: number;
  faceW: number;
  faceH: number;
};

/** Detect faces in a frame canvas and push results to rawCandidates */
function detectFacesInFrame(
  frameCanvas: HTMLCanvasElement,
  time: number,
  detector: FaceDetector,
  rawCandidates: RawCandidate[],
  usedCanvases: Set<HTMLCanvasElement>
): void {
  const result = detector.detect(frameCanvas);
  const detections = result.detections || [];
  let frameUsed = false;

  for (const det of detections) {
    const bb = det.boundingBox;
    if (!bb) continue;
    const score = det.categories?.[0]?.score ?? 0;
    if (score < 0.15) continue;

    rawCandidates.push({
      time,
      score,
      frameCanvas,
      faceX: bb.originX,
      faceY: bb.originY,
      faceW: bb.width,
      faceH: bb.height,
    });
    frameUsed = true;
  }

  if (!frameUsed) {
    frameCanvas.width = 0;
    frameCanvas.height = 0;
  } else {
    usedCanvases.add(frameCanvas);
  }
}

/** Error thrown when the user cancels processing mid-flight. */
export class FaceExtractAbortError extends Error {
  constructor() {
    super("FACE_EXTRACT_ABORTED");
    this.name = "FaceExtractAbortError";
  }
}

/** PC: seek-based frame extraction (fast, reliable on desktop browsers) */
async function extractFramesSeekBased(
  video: HTMLVideoElement,
  duration: number,
  detector: FaceDetector,
  onProgress: (pct: number, label: string) => void,
  signal: AbortSignal | undefined,
  frameInterval: number,
  maxWidth: number,
  progressLabel: string
): Promise<{ rawCandidates: RawCandidate[]; usedCanvases: Set<HTMLCanvasElement>; playbackFailed?: boolean }> {
  const rawCandidates: RawCandidate[] = [];
  const usedCanvases = new Set<HTMLCanvasElement>();
  const totalFrames = Math.max(1, Math.floor(duration / frameInterval));

  for (let t = 0; t < duration; t += frameInterval) {
    await new Promise<void>((r) => setTimeout(r, 0));
    // fix12 Stage 4: ユーザーがキャンセルしたら即中断（部分結果を解放）
    if (signal?.aborted) {
      for (const c of usedCanvases) {
        c.width = 0;
        c.height = 0;
      }
      throw new FaceExtractAbortError();
    }
    const frameCanvas = await extractFrame(video, t, maxWidth);
    detectFacesInFrame(frameCanvas, t, detector, rawCandidates, usedCanvases);

    const frameIdx = Math.floor(t / frameInterval) + 1;
    onProgress(0.05 + (frameIdx / totalFrames) * 0.85, progressLabel);
  }

  return { rawCandidates, usedCanvases };
}

/**
 * Mobile: playback-based frame capture.
 * Instead of seeking (unreliable on mobile Safari), plays the video at 2x speed
 * and captures frames via requestAnimationFrame at ~3 second intervals.
 */
async function extractFramesPlaybackBased(
  video: HTMLVideoElement,
  duration: number,
  detector: FaceDetector,
  onProgress: (pct: number, label: string) => void
): Promise<{ rawCandidates: RawCandidate[]; usedCanvases: Set<HTMLCanvasElement>; playbackFailed?: boolean }> {
  const rawCandidates: RawCandidate[] = [];
  const usedCanvases = new Set<HTMLCanvasElement>();

  // Seek to start first (mobile needs this before play)
  video.currentTime = 0;
  await new Promise<void>((resolve) => {
    const onReady = () => {
      video.removeEventListener("canplay", onReady);
      resolve();
    };
    video.addEventListener("canplay", onReady);
    // Fallback timeout
    setTimeout(resolve, 2000);
  });

  // Set playback rate (iOS caps at 2x)
  video.playbackRate = MOBILE_PLAYBACK_RATE;

  return new Promise((resolve) => {
    let lastCaptureTime = -FRAME_INTERVAL_MOBILE; // ensure first frame is captured
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      video.pause();
      resolve({ rawCandidates, usedCanvases });
    };

    const captureLoop = () => {
      if (finished) return;

      const currentTime = video.currentTime;

      // Check if playback reached the end
      if (currentTime >= duration || video.ended) {
        finish();
        return;
      }

      // Update progress based on actual playback position
      const progress = currentTime / duration;
      onProgress(0.05 + progress * 0.85, "顔を検出中（再生中）...");

      // Capture frame at intervals
      if (currentTime - lastCaptureTime >= FRAME_INTERVAL_MOBILE) {
        const frameCanvas = captureCurrentFrame(video, MAX_FRAME_WIDTH_MOBILE);
        detectFacesInFrame(frameCanvas, currentTime, detector, rawCandidates, usedCanvases);
        lastCaptureTime = currentTime;
      }

      requestAnimationFrame(captureLoop);
    };

    // Safety timeout: duration / playbackRate + generous buffer
    const maxWaitMs = (duration / MOBILE_PLAYBACK_RATE + 5) * 1000;
    setTimeout(finish, maxWaitMs);

    // Start playback and capture loop
    video.play().then(() => {
      requestAnimationFrame(captureLoop);
    }).catch(() => {
      // play() can fail on mobile (autoplay restrictions, codec issues, etc.)
      finished = true;
      video.pause();
      resolve({ rawCandidates: [], usedCanvases, playbackFailed: true });
    });
  });
}

/** Deduplicate and rank raw candidates into final FaceCandidate list */
function deduplicateCandidates(
  rawCandidates: RawCandidate[],
  usedCanvases: Set<HTMLCanvasElement>
): FaceCandidate[] {
  // Sort by score descending
  rawCandidates.sort((a, b) => b.score - a.score);

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

  // Cleanup unused frame canvases
  for (const canvas of usedCanvases) {
    if (!candidates.some((c) => c.frameCanvas === canvas)) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return candidates;
}

/** Main pipeline: extract faces from video file */
export async function extractFacesFromVideo(
  file: File,
  onProgress: (pct: number, label: string) => void,
  signal?: AbortSignal
): Promise<FaceCandidate[]> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error("動画ファイルは50MB以下にしてください");
  }

  onProgress(0, "動画を読み込み中...");
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
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

    if (signal?.aborted) throw new FaceExtractAbortError();

    // fix12 Stage 3: 初期化（getDetector）は遅くなりうるので専用ラベル
    onProgress(0.05, "顔検出エンジンを初期化中...");
    const detector = await getDetector();
    const duration = Math.min(video.duration, 30);

    // fix13: 低メモリ環境（runtime 判定）なら軽量モードで間引き + 解像度低下
    const mobile = isMobile();
    const lowMem = !mobile && isLowMemoryEnvironment();
    const frameInterval = lowMem ? FRAME_INTERVAL_PC_LOW : FRAME_INTERVAL_PC;
    const maxWidth = lowMem ? MAX_FRAME_WIDTH_PC_LOW : MAX_FRAME_WIDTH_PC;
    // fix13 Stage 4: 軽量モード時はその旨を進捗ラベルに明示
    const seekLabel = lowMem ? "顔を検出中（軽量モード）..." : "顔を検出中...";

    // Mobile: playback-based (no seeking), PC: seek-based (fast)
    const result = mobile
      ? await extractFramesPlaybackBased(video, duration, detector, onProgress)
      : await extractFramesSeekBased(
          video,
          duration,
          detector,
          onProgress,
          signal,
          frameInterval,
          maxWidth,
          seekLabel
        );

    // Mobile playback failure (autoplay blocked, codec issue, etc.)
    if (mobile && result.playbackFailed) {
      throw new Error("MOBILE_PLAYBACK_FAILED");
    }

    onProgress(0.92, "候補を選別中...");
    const candidates = deduplicateCandidates(result.rawCandidates, result.usedCanvases);

    // Mobile: 0 candidates likely means processing limitation, not "no faces"
    if (mobile && candidates.length === 0 && result.rawCandidates.length === 0) {
      throw new Error("MOBILE_NO_RESULTS");
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
