import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- fake encoder core: records what reaches the encoder ----
const encoded: number[][] = [];
vi.mock("./encoder-core", () => ({
  encodeGifSync: (frames: Array<{ rgba: Uint8ClampedArray }>) => {
    if (frames.some((f) => f.rgba.length === 0)) throw new Error("rgba length mismatch");
    encoded.push(frames.map((f) => f.rgba.length));
    return { bytes: new Uint8Array([71, 73, 70]), reports: [] };
  },
}));

// ---- controllable Worker mock ----
type Mode = "ctor-throw" | "crash-after-transfer" | "post-throw" | "report-error" | "ok" | "slow";
const ctl: { mode: Mode; delay: number; posted: number; instances: number } = { mode: "ok", delay: 0, posted: 0, instances: 0 };

class MockWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((ev: { message: string }) => void) | null = null;
  constructor() {
    ctl.instances++;
    if (ctl.mode === "ctor-throw") throw new Error("no workers here");
  }
  postMessage(msg: { id: number; frames: Array<{ rgba: Uint8ClampedArray }> }, transfer: ArrayBuffer[]) {
    if (ctl.mode === "post-throw") throw new Error("DataCloneError");
    // emulate a real transfer: the caller's buffers become detached
    const cloned = structuredClone(msg, { transfer }) as typeof msg;
    ctl.posted++;
    if (ctl.mode === "crash-after-transfer") {
      setTimeout(() => this.onerror?.({ message: "worker died" }), 0);
      return;
    }
    if (ctl.mode === "report-error") {
      setTimeout(() => this.onmessage?.({ data: { id: msg.id, ok: false, error: "frame size mismatch" } }), 0);
      return;
    }
    const finish = () => {
      encoded.push(cloned.frames.map((f) => f.rgba.length));
      this.onmessage?.({ data: { id: msg.id, ok: true, bytes: new Uint8Array([71]), reports: [] } });
    };
    setTimeout(finish, ctl.mode === "slow" ? ctl.delay : 0);
  }
  terminate() {}
}
vi.stubGlobal("Worker", MockWorker);
vi.stubGlobal("Blob", class { constructor(public parts: unknown[], public opts?: unknown) {} });

import { GifEncodeCancelledError, GifEncodeError, _encodeQueueStats, _resetEncodeState, encodeGifFrames } from "./encode";

const frame = (n = 2) => ({ rgba: new Uint8ClampedArray(n * n * 4).fill(200), width: n, height: n, delayMs: 50 });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("encodeGifFrames — worker failure modes (07 §1)", () => {
  beforeEach(() => {
    _resetEncodeState();
    encoded.length = 0;
    ctl.mode = "ok"; ctl.delay = 0; ctl.posted = 0; ctl.instances = 0;
  });
  afterEach(() => _resetEncodeState());

  it("Worker constructor failure → encodes inline with the original (intact) frames", async () => {
    ctl.mode = "ctor-throw";
    const f = frame();
    const r = await encodeGifFrames([f], {});
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(encoded).toEqual([[16]]);
    expect(_encodeQueueStats().workerBroken).toBe(true);
  });

  it("crash after transfer: retries from rebuild() (never with the detached buffers)", async () => {
    ctl.mode = "crash-after-transfer";
    const f = frame();
    const rebuild = vi.fn(() => [frame()]);
    const r = await encodeGifFrames([f], {}, { rebuild });
    expect(f.rgba.length).toBe(0); // caller's buffer was transferred
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(encoded).toEqual([[16]]);
    expect(_encodeQueueStats().pendingInWorker).toBe(0);
  });

  it("crash after transfer without rebuild → explicit GifEncodeError(worker-crashed); next job still works", async () => {
    ctl.mode = "crash-after-transfer";
    await expect(encodeGifFrames([frame()], {})).rejects.toMatchObject({ name: "GifEncodeError", reason: "worker-crashed" });
    expect(encoded).toEqual([]);
    // worker is marked broken → the following job runs inline and succeeds
    ctl.mode = "ok";
    const r = await encodeGifFrames([frame()], {});
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(ctl.instances).toBe(1);
    expect(_encodeQueueStats()).toMatchObject({ running: false, waiting: 0, pendingInWorker: 0 });
  });

  it("postMessage throws synchronously → pending entry removed, inline encode with intact frames", async () => {
    ctl.mode = "post-throw";
    const f = frame();
    const r = await encodeGifFrames([f], {});
    expect(r.bytes.length).toBeGreaterThan(0);
    expect(f.rgba.length).toBe(16);
    expect(encoded).toEqual([[16]]);
    expect(_encodeQueueStats().pendingInWorker).toBe(0);
  });

  it("worker-reported encode error → GifEncodeError(encode-failed), no rebuild, queue continues", async () => {
    ctl.mode = "report-error";
    const rebuild = vi.fn(() => [frame()]);
    await expect(encodeGifFrames([frame()], {}, { rebuild })).rejects.toMatchObject({ reason: "encode-failed" });
    expect(rebuild).not.toHaveBeenCalled();
    ctl.mode = "ok";
    await expect(encodeGifFrames([frame()], {})).resolves.toBeTruthy();
    expect(_encodeQueueStats()).toMatchObject({ running: false, waiting: 0 });
  });
});

describe("encodeGifFrames — queue (07 §2)", () => {
  beforeEach(() => {
    _resetEncodeState();
    encoded.length = 0;
    ctl.mode = "slow"; ctl.delay = 30; ctl.posted = 0; ctl.instances = 0;
  });
  afterEach(() => _resetEncodeState());

  it("same owner: only the running job and the newest waiting job reach the encoder", async () => {
    const results = [1, 2, 3, 4, 5].map((n) =>
      encodeGifFrames([frame(n + 1)], {}, { owner: "preview" }).then(
        () => `ok${n}`,
        (e) => (e instanceof GifEncodeCancelledError ? `cancelled${n}` : `err${n}`),
      ),
    );
    expect(_encodeQueueStats().waiting).toBeLessThanOrEqual(1);
    const settled = await Promise.all(results);
    expect(settled).toEqual(["ok1", "cancelled2", "cancelled3", "cancelled4", "ok5"]);
    expect(ctl.posted).toBe(2);
    expect(encoded.map((e) => e[0])).toEqual([16, 144]); // 2×2 and 6×6 only
    expect(_encodeQueueStats()).toMatchObject({ running: false, waiting: 0, owners: 0 });
  });

  it("different owners / no owner are not superseded and run in order", async () => {
    const out: string[] = [];
    await Promise.all([
      encodeGifFrames([frame()], {}, { owner: "a" }).then(() => out.push("a")),
      encodeGifFrames([frame()], {}).then(() => out.push("fifo1")),
      encodeGifFrames([frame()], {}, { owner: "b" }).then(() => out.push("b")),
      encodeGifFrames([frame()], {}).then(() => out.push("fifo2")),
    ]);
    expect(out).toEqual(["a", "fifo1", "b", "fifo2"]);
    expect(ctl.posted).toBe(4);
  });

  it("an AbortSignal cancels a waiting job; a running job completes and the queue drains", async () => {
    const ac = new AbortController();
    const running = encodeGifFrames([frame()], {});
    const waiting = encodeGifFrames([frame()], {}, { signal: ac.signal }).catch((e) => e);
    ac.abort();
    expect(await waiting).toBeInstanceOf(GifEncodeCancelledError);
    await expect(running).resolves.toBeTruthy();
    expect(ctl.posted).toBe(1);
    expect(_encodeQueueStats()).toMatchObject({ running: false, waiting: 0 });
  });

  it("an already-aborted signal rejects immediately without touching the worker", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(encodeGifFrames([frame()], {}, { signal: ac.signal })).rejects.toBeInstanceOf(GifEncodeCancelledError);
    expect(ctl.posted).toBe(0);
  });

  it("a failure does not block later requests", async () => {
    ctl.mode = "report-error";
    await expect(encodeGifFrames([frame()], {})).rejects.toBeInstanceOf(GifEncodeError);
    ctl.mode = "slow";
    await expect(encodeGifFrames([frame()], {})).resolves.toBeTruthy();
    await sleep(5);
    expect(_encodeQueueStats()).toMatchObject({ running: false, waiting: 0 });
  });
});
