import { describe, expect, it } from "vitest";
import { buildExportPlan } from "./export-plan";
import { outputCondition, savePlanKey, type OutputStatus } from "./save-state";
import { sourceReducer, type SourceState } from "./source-state";
import { createSelectionSequence, runGuardedSave } from "./save-flow";

/**
 * A model of what the parent (EmoteGenerator → ExportPanel → SaveActions)
 * derives from the processing hook: the plan key and the output condition
 * are computed by the same functions the components use, from the same
 * generation numbers the hook exposes.
 */
function parentModel() {
  const hook: OutputStatus = { requestedGen: 5, outputGen: 5, failedGen: null, stage: "ready", variantCount: 3 };
  const plan = buildExportPlan({ platform: "twitch", assetType: "emote", format: "gif", variants: [28, 56, 112].map((size) => ({ size, gifBytes: 100, pngBytes: 50 })) });
  const key = () => savePlanKey(plan, hook.requestedGen, plan.files);
  const condition = () => outputCondition(hook);
  return {
    hook,
    plan,
    key,
    condition,
    /** Same destination / format: only the text or the animation changed. */
    changeSetting() {
      hook.requestedGen += 1;
      hook.stage = "generating-preview";
    },
    renderSucceeds() {
      hook.outputGen = hook.requestedGen;
      hook.stage = "ready";
    },
    renderFails() {
      hook.failedGen = hook.requestedGen;
      hook.stage = "ready";
    },
    /** What SaveActions captures when a save starts. */
    startSave() {
      const snapshot = key();
      return () => key() === snapshot && condition() === "current";
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("guarded save vs. a setting change while waiting (13 §1)", () => {
  it("permission pending → same-destination text change → render pending → permission ok: aborted, nothing delivered", async () => {
    const m = parentModel();
    const gate = deferred<boolean>();
    let delivered = 0;
    let aborted = 0;
    const run = runGuardedSave({ gate: () => gate.promise, isStillValid: m.startSave(), deliver: () => delivered++, onAborted: () => aborted++ });
    m.changeSetting(); // requestedGen 6, outputGen still 5 → key changed, condition "updating"
    gate.resolve(true);
    expect(await run).toBe("aborted");
    expect(delivered).toBe(0);
    expect(aborted).toBe(1);
  });

  it("a change during ZIP building aborts before delivery", async () => {
    const m = parentModel();
    const zip = deferred<string>();
    let delivered = 0;
    const run = runGuardedSave<string>({ gate: async () => true, isStillValid: m.startSave(), prepare: () => zip.promise, deliver: () => delivered++ });
    await Promise.resolve();
    m.changeSetting();
    m.renderSucceeds(); // outputs of the NEW request exist, but this save was for the old one
    zip.resolve("zip");
    expect(await run).toBe("aborted");
    expect(delivered).toBe(0);
  });

  it("a failed render also blocks a save that had already started", async () => {
    const m = parentModel();
    const gate = deferred<boolean>();
    let delivered = 0;
    const run = runGuardedSave({ gate: () => gate.promise, isStillValid: m.startSave(), deliver: () => delivered++ });
    m.changeSetting();
    m.renderFails();
    gate.resolve(true);
    expect(await run).toBe("aborted");
    expect(delivered).toBe(0);
    expect(m.condition()).toBe("failed");
  });

  it("with nothing changed the save is delivered; a denied permission never delivers", async () => {
    const m = parentModel();
    let delivered = 0;
    expect(await runGuardedSave({ gate: async () => true, isStillValid: m.startSave(), deliver: () => delivered++ })).toBe("delivered");
    expect(delivered).toBe(1);
    expect(await runGuardedSave({ gate: async () => false, isStillValid: m.startSave(), deliver: () => delivered++ })).toBe("denied");
    expect(delivered).toBe(1);
  });

  it("the prepared (iOS) key is dropped as soon as the request changes, before the render completes", () => {
    const m = parentModel();
    const prepared = m.key();
    m.changeSetting();
    expect(m.key()).not.toBe(prepared); // same destination / format, only requestedGen moved
    expect(m.condition()).toBe("updating");
    m.renderSucceeds();
    expect(m.key()).not.toBe(prepared);
  });
});

describe("selection sequence vs. a GIF still being validated (13 §2)", () => {
  type F = { id: string };
  const f = (id: string): F => ({ id });

  async function pickGifThenOther(other: { kind: "image" | "video" | "gif"; name: string; file: F }) {
    const seq = createSelectionSequence();
    let state: SourceState<F> = { confirmed: null, candidate: null };
    const validation = deferred<boolean>();
    // GIF A picked: validation starts with its selection number.
    const tokenA = seq.next();
    const adoptA = validation.promise.then((ok) => {
      if (!ok || !seq.isCurrent(tokenA)) return "ignored";
      state = sourceReducer(state, { type: "select", candidate: { kind: "gif", name: "a.gif", file: f("a") } });
      state = sourceReducer(state, { type: "confirm", file: f("a"), adjust: null });
      return "adopted";
    });
    // Other file picked while A is still being read.
    seq.next();
    if (other.kind === "gif") {
      // B is a GIF too: its own validation completes first.
      state = sourceReducer(state, { type: "select", candidate: other });
      state = sourceReducer(state, { type: "confirm", file: other.file, adjust: null });
    } else {
      state = sourceReducer(state, { type: "select", candidate: other });
    }
    validation.resolve(true);
    const outcome = await adoptA;
    return { outcome, state };
  }

  it("a still image picked during GIF validation keeps its adjust screen and candidate", async () => {
    const { outcome, state } = await pickGifThenOther({ kind: "image", name: "b.png", file: f("b") });
    expect(outcome).toBe("ignored");
    expect(state.candidate?.name).toBe("b.png");
    expect(state.confirmed).toBeNull();
  });

  it("the same holds for a video or the sample", async () => {
    const video = await pickGifThenOther({ kind: "video", name: "b.mp4", file: f("v") });
    expect(video.outcome).toBe("ignored");
    expect(video.state.candidate?.name).toBe("b.mp4");
    const sample = await pickGifThenOther({ kind: "image", name: "sample-star.png", file: f("s") });
    expect(sample.state.candidate?.name).toBe("sample-star.png");
  });

  it("GIF A then GIF B: A finishing later does not replace B", async () => {
    const { outcome, state } = await pickGifThenOther({ kind: "gif", name: "b.gif", file: f("b") });
    expect(outcome).toBe("ignored");
    expect(state.confirmed?.name).toBe("b.gif");
  });

  it("a cancel / reset also invalidates an earlier validation", () => {
    const seq = createSelectionSequence();
    const token = seq.next();
    seq.next(); // cancel
    expect(seq.isCurrent(token)).toBe(false);
  });
});
