import { describe, expect, it } from "vitest";
import { canEnterStep, stepAfterSelect, STUDIO_STEPS } from "./steps";

describe("studio steps", () => {
  it("lists the four steps in order", () => {
    expect(STUDIO_STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4]);
  });

  it("step 1 is always available", () => {
    expect(canEnterStep(1, { hasSource: false, sourceKind: null })).toEqual({ ok: true });
  });

  it("steps 2-4 need a source and say why", () => {
    for (const step of [2, 3, 4] as const) {
      const r = canEnterStep(step, { hasSource: false, sourceKind: null });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("画像");
    }
  });

  it("GIF sources skip the adjust step but can edit and save", () => {
    expect(canEnterStep(2, { hasSource: true, sourceKind: "gif" }).ok).toBe(false);
    expect(canEnterStep(3, { hasSource: true, sourceKind: "gif" }).ok).toBe(true);
    expect(canEnterStep(4, { hasSource: true, sourceKind: "gif" }).ok).toBe(true);
  });

  it("images and videos can enter every step", () => {
    for (const kind of ["image", "video"] as const) {
      for (const step of [1, 2, 3, 4] as const) {
        expect(canEnterStep(step, { hasSource: true, sourceKind: kind }).ok).toBe(true);
      }
    }
  });

  it("selecting a source opens the right step", () => {
    expect(stepAfterSelect("image")).toBe(2);
    expect(stepAfterSelect("video")).toBe(2);
    expect(stepAfterSelect("gif")).toBe(3);
  });
});
