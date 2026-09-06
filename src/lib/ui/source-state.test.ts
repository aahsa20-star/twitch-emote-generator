import { describe, expect, it } from "vitest";
import { adjustTarget, sourceReducer, type SourceState } from "./source-state";

type F = { id: string };
const f = (id: string): F => ({ id });
const empty: SourceState<F> = { confirmed: null, candidate: null };

describe("source state (selected vs confirmed)", () => {
  it("selecting keeps the confirmed work and only adds a candidate", () => {
    const a = sourceReducer(sourceReducer(empty, { type: "select", candidate: { kind: "image", name: "a.png", file: f("a") } }), { type: "confirm", file: f("a-cropped"), adjust: null });
    expect(a.confirmed?.name).toBe("a.png");
    const withB = sourceReducer(a, { type: "select", candidate: { kind: "image", name: "b.png", file: f("b") } });
    expect(withB.confirmed).toEqual(a.confirmed); // editor still on A
    expect(withB.candidate?.name).toBe("b.png");
    expect(adjustTarget(withB)).toMatchObject({ file: f("b"), name: "b.png", isCandidate: true, adjust: null });
  });

  it("cancelling a candidate restores the confirmed source, name and crop", () => {
    const adjust = { zoom: 120, offset: { x: 3, y: -2 }, crop: { x: 10, y: 10, w: 200, h: 200 } };
    const a = sourceReducer(sourceReducer(empty, { type: "select", candidate: { kind: "image", name: "a.png", file: f("a") } }), { type: "confirm", file: f("a-cropped"), adjust });
    const cancelled = sourceReducer(sourceReducer(a, { type: "select", candidate: { kind: "video", name: "b.mp4", file: f("b") } }), { type: "cancel" });
    expect(cancelled).toEqual(a);
    expect(adjustTarget(cancelled)).toMatchObject({ file: f("a"), adjust, isCandidate: false, kind: "image" });
  });

  it("confirming a candidate switches everything at once", () => {
    const a = sourceReducer(sourceReducer(empty, { type: "select", candidate: { kind: "image", name: "a.png", file: f("a") } }), { type: "confirm", file: f("a-cropped"), adjust: null });
    const b = sourceReducer(sourceReducer(a, { type: "select", candidate: { kind: "image", name: "b.png", file: f("b") } }), { type: "confirm", file: f("b-cropped"), adjust: null });
    expect(b.candidate).toBeNull();
    expect(b.confirmed).toEqual({ kind: "image", name: "b.png", file: f("b-cropped"), original: f("b"), adjust: null });
  });

  it("re-adjusting without a candidate keeps name and original", () => {
    const a = sourceReducer(sourceReducer(empty, { type: "select", candidate: { kind: "image", name: "a.png", file: f("a") } }), { type: "confirm", file: f("a1"), adjust: null });
    const adjust = { zoom: 90, offset: { x: 0, y: 0 }, crop: { x: 0, y: 0, w: 320, h: 320 } };
    const re = sourceReducer(a, { type: "confirm", file: f("a2"), adjust });
    expect(re.confirmed).toEqual({ kind: "image", name: "a.png", file: f("a2"), original: f("a"), adjust });
  });

  it("confirm with nothing selected is a no-op; clear empties both", () => {
    expect(sourceReducer(empty, { type: "confirm", file: f("x"), adjust: null })).toEqual(empty);
    const a = sourceReducer(sourceReducer(empty, { type: "select", candidate: { kind: "gif", name: "a.gif", file: f("a") } }), { type: "confirm", file: f("a"), adjust: null });
    expect(sourceReducer(a, { type: "clear" })).toEqual(empty);
  });
});
