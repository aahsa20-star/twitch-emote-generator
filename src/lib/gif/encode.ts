/**
 * Browser-side GIF encoding entry point (R2 §1 → 07 §1/§2).
 *
 * Execution: one job at a time in a dedicated Worker (CPU + memory bounded);
 * main-thread fallback when Workers are unavailable.
 *
 * Ownership of pixel data (07 §1): frames are TRANSFERRED to the worker, which
 * detaches the caller's buffers. If the worker dies after the transfer we can
 * only retry from a `rebuild()` callback (callers keep their canvases alive
 * until the promise settles and re-read them — a temporary second copy exists
 * only during that retry). Without `rebuild`, the failure is explicit
 * (`GifEncodeError` reason "worker-crashed") so the UI can offer a retry.
 * Constructor failures and synchronous `postMessage` failures happen before
 * the data is consumed, so they fall back inline with the original frames.
 *
 * Queue (07 §2): jobs carry an optional `owner`. For an owner at most one job
 * is running and one is waiting; a newer job replaces the waiting one, whose
 * promise settles with `GifEncodeCancelledError` and whose frames are dropped
 * immediately. An `AbortSignal` cancels a waiting job the same way. Jobs
 * without an owner (explicit exports, recommended patterns) are FIFO and are
 * never superseded. A running encode cannot be interrupted; its result is
 * simply discarded by the caller.
 */
import { encodeGifSync, type GifEncodeOptions, type GifEncodeResult, type GifFrameInput } from "./encoder-core";

export class GifEncodeCancelledError extends Error {
  constructor(message = "gif encode cancelled") {
    super(message);
    this.name = "GifEncodeCancelledError";
  }
}

export type GifEncodeFailure = "worker-crashed" | "encode-failed" | "post-failed";

export class GifEncodeError extends Error {
  constructor(message: string, public readonly reason: GifEncodeFailure) {
    super(message);
    this.name = "GifEncodeError";
  }
}

export interface EncodeJobOptions {
  /** Jobs with the same owner supersede each other while waiting. */
  owner?: string;
  /** Cancels the job while it is still waiting. */
  signal?: AbortSignal;
  /** Re-reads the source pixels for a retry after the worker consumed them. */
  rebuild?: () => GifFrameInput[];
}

export type EncodeOutput = GifEncodeResult & { blob: Blob };

interface Job {
  id: number;
  frames: GifFrameInput[] | null;
  opts: GifEncodeOptions;
  job: EncodeJobOptions;
  resolve: (r: EncodeOutput) => void;
  reject: (e: Error) => void;
  settled: boolean;
}

// ---- worker management ----
type Pending = { resolve: (r: GifEncodeResult) => void; reject: (e: Error) => void };
class WorkerCrashed extends Error {}
class PostFailed extends Error {}
class WorkerReported extends Error {}

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./encode.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent) => {
      const { id, ok, bytes, reports, error } = e.data as {
        id: number; ok: boolean; bytes?: Uint8Array; reports?: GifEncodeResult["reports"]; error?: string;
      };
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (ok && bytes) p.resolve({ bytes, reports: reports ?? [] });
      else p.reject(new WorkerReported(error ?? "gif encode failed"));
    };
    w.onerror = (ev) => {
      console.error("[gif] worker crashed; later jobs run on the main thread:", ev.message);
      workerBroken = true;
      const waiting = [...pending.values()];
      pending.clear();
      for (const p of waiting) p.reject(new WorkerCrashed("gif worker crashed"));
      try {
        w.terminate();
      } catch {
        // ignore
      }
      if (worker === w) worker = null;
    };
    worker = w;
    return w;
  } catch (e) {
    console.warn("[gif] Worker unavailable, encoding on the main thread:", e);
    workerBroken = true;
    return null;
  }
}

function encodeInWorker(w: Worker, frames: GifFrameInput[], opts: GifEncodeOptions): Promise<GifEncodeResult> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    try {
      w.postMessage({ id, frames, opts }, frames.map((f) => f.rgba.buffer as ArrayBuffer));
    } catch (e) {
      pending.delete(id);
      reject(new PostFailed(e instanceof Error ? e.message : String(e)));
    }
  });
}

const buffersIntact = (frames: GifFrameInput[]) => frames.every((f) => f.rgba.byteLength > 0);

async function execute(job: Job): Promise<GifEncodeResult> {
  const frames = job.frames!;
  job.frames = null; // the job no longer holds the pixels once they are handed over
  const w = getWorker();
  if (!w) return encodeGifSync(frames, job.opts); // construction failed: data untouched

  try {
    return await encodeInWorker(w, frames, job.opts);
  } catch (e) {
    if (e instanceof WorkerReported) {
      throw new GifEncodeError(e.message, "encode-failed"); // deterministic: no retry
    }
    if (e instanceof PostFailed && buffersIntact(frames)) {
      workerBroken = true; // do not keep posting to a worker that rejects messages
      return encodeGifSync(frames, job.opts);
    }
    // WorkerCrashed after transfer (buffers detached), or PostFailed with detached data
    if (job.job.rebuild) {
      const fresh = job.job.rebuild();
      if (buffersIntact(fresh)) return encodeGifSync(fresh, job.opts);
    }
    throw new GifEncodeError(
      "GIF エンコード用の Worker が停止し、元データを再取得できませんでした",
      e instanceof PostFailed ? "post-failed" : "worker-crashed",
    );
  }
}

// ---- queue ----
const fifo: Job[] = [];
const waitingByOwner = new Map<string, Job>();
let running: Job | null = null;

function cancelJob(job: Job, reason: string) {
  if (job.settled) return;
  job.settled = true;
  job.frames = null;
  const i = fifo.indexOf(job);
  if (i >= 0) fifo.splice(i, 1);
  if (job.job.owner && waitingByOwner.get(job.job.owner) === job) waitingByOwner.delete(job.job.owner);
  job.reject(new GifEncodeCancelledError(reason));
}

function pump() {
  if (running) return;
  const job = fifo.shift();
  if (!job) return;
  if (job.job.owner && waitingByOwner.get(job.job.owner) === job) waitingByOwner.delete(job.job.owner);
  running = job;
  execute(job)
    .then(
      (result) => ({ ok: true as const, result }),
      (err: unknown) => ({ ok: false as const, err: err instanceof Error ? err : new Error(String(err)) }),
    )
    .then((outcome) => {
      // Advance the queue BEFORE settling so callers observe a consistent state.
      running = null;
      pump();
      if (job.settled) return;
      job.settled = true;
      if (outcome.ok) job.resolve({ ...outcome.result, blob: new Blob([outcome.result.bytes as BlobPart], { type: "image/gif" }) });
      else job.reject(outcome.err);
    });
}

/** Encode frames to a GIF Blob (see the module comment for ownership / queue rules). */
export function encodeGifFrames(frames: GifFrameInput[], opts: GifEncodeOptions = {}, jobOpts: EncodeJobOptions = {}): Promise<EncodeOutput> {
  return new Promise<EncodeOutput>((resolve, reject) => {
    const job: Job = { id: ++seq, frames, opts, job: jobOpts, resolve, reject, settled: false };
    if (jobOpts.signal?.aborted) {
      cancelJob(job, "aborted before start");
      return;
    }
    if (jobOpts.owner) {
      const prev = waitingByOwner.get(jobOpts.owner);
      if (prev) cancelJob(prev, "superseded by a newer request");
      waitingByOwner.set(jobOpts.owner, job);
    }
    fifo.push(job);
    jobOpts.signal?.addEventListener("abort", () => {
      if (running !== job) cancelJob(job, "aborted");
    }, { once: true });
    pump();
  });
}

/** Diagnostics for tests / dev pages. */
export function _encodeQueueStats(): { running: boolean; waiting: number; owners: number; pendingInWorker: number; workerBroken: boolean } {
  return { running: running !== null, waiting: fifo.length, owners: waitingByOwner.size, pendingInWorker: pending.size, workerBroken };
}

/** Test hook: forget the worker state. */
export function _resetEncodeState() {
  try {
    worker?.terminate();
  } catch {
    // ignore
  }
  worker = null;
  workerBroken = false;
  pending.clear();
  for (const j of [...fifo]) cancelJob(j, "reset");
  fifo.length = 0;
  waitingByOwner.clear();
  running = null;
}

/** Read RGBA from canvases without modifying them. */
export function canvasesToFrames(canvases: HTMLCanvasElement[], delays: number[]): GifFrameInput[] {
  return canvases.map((c, i) => {
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return { rgba: img.data, width: img.width, height: img.height, delayMs: delays[i] ?? delays[0] ?? 50 };
  });
}
