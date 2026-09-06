import { describe, expect, it } from "vitest";
import { buildExportPlan } from "./export-plan";
import { canSaveAll, canSaveFile, outputCondition, savePlanKey } from "./save-state";

const base = { requestedGen: 5, outputGen: 5, failedGen: null, stage: "ready" as const, variantCount: 3 };

describe("output condition", () => {
  it("is current only when the requested generation succeeded", () => {
    expect(outputCondition(base)).toBe("current");
    expect(outputCondition({ ...base, requestedGen: 6 })).toBe("updating"); // setting changed, old outputs still shown
    expect(outputCondition({ ...base, stage: "generating-preview" })).toBe("updating");
    expect(outputCondition({ ...base, requestedGen: 6, failedGen: 6 })).toBe("failed");
    expect(outputCondition({ requestedGen: 1, outputGen: null, failedGen: null, stage: "idle", variantCount: 0 })).toBe("none");
  });

  it("a failed render never counts as current even though old variants remain", () => {
    expect(outputCondition({ ...base, requestedGen: 7, outputGen: 5, failedGen: 7, stage: "ready" })).toBe("failed");
  });
});

describe("save plan key / permissions", () => {
  const plan = buildExportPlan({
    platform: "twitch",
    assetType: "emote",
    format: "gif",
    variants: [28, 56, 112].map((size) => ({ size, gifBytes: 100, pngBytes: 50 })),
  });

  it("changes with the output generation even when sizes and format stay the same", () => {
    expect(savePlanKey(plan, 5, plan.files)).not.toBe(savePlanKey(plan, 6, plan.files));
    expect(savePlanKey(plan, 5, plan.files)).toBe(savePlanKey(plan, 5, plan.files));
  });

  it("single files save only when current; all-sizes needs every file", () => {
    expect(canSaveFile(plan.files[0], "current")).toBe(true);
    expect(canSaveFile(plan.files[0], "updating")).toBe(false);
    expect(canSaveAll(plan, "current")).toBe(true);
    const partial = buildExportPlan({
      platform: "twitch",
      assetType: "emote",
      format: "gif",
      variants: [{ size: 112, gifBytes: 100, pngBytes: 50 }, { size: 56, gifBytes: null, pngBytes: 50 }, { size: 28, gifBytes: 100, pngBytes: 50 }],
    });
    expect(canSaveFile(partial.files[0], "current")).toBe(true);
    expect(canSaveAll(partial, "current")).toBe(false);
    expect(canSaveAll(plan, "failed")).toBe(false);
  });
});
