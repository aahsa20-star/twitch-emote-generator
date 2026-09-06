import { describe, expect, it } from "vitest";
import { registryConsistency, generators } from "./index";
import { ANIMATION_CATALOG } from "./catalog";

describe("animation registry ↔ catalog", () => {
  it("every catalog id has a generator and there are no extra generators", () => {
    const r = registryConsistency();
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
    expect(r.count).toBe(100);
    expect(r.ok).toBe(true);
  });

  it("generators are distinct functions (no accidental aliasing between ids)", () => {
    const fns = ANIMATION_CATALOG.map((a) => generators[a.id]);
    expect(new Set(fns).size).toBe(fns.length);
  });
});
