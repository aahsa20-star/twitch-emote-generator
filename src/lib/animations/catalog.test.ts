import { describe, expect, it } from "vitest";
import { ANIMATION_CATALOG, ANIMATION_CATEGORIES, ANIMATION_COUNT, TRIAL_ANIMATION_IDS, filterAnimations, isAnimationId } from "./catalog";

describe("animation catalog (04: 固定 100 ID の一意性 / 定義と実装の整合)", () => {
  it("has exactly 100 entries with unique ids and labels", () => {
    expect(ANIMATION_COUNT).toBe(100);
    const ids = ANIMATION_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(100);
    const labels = ANIMATION_CATALOG.map((a) => a.label);
    expect(new Set(labels).size).toBe(100);
    expect(ids).not.toContain("none");
    expect(ids).not.toContain("ai-custom");
  });

  it("keeps the original 52 ids and adds 48", () => {
    expect(ANIMATION_CATALOG.filter((a) => a.since === "v1")).toHaveLength(52);
    expect(ANIMATION_CATALOG.filter((a) => a.since === "v2")).toHaveLength(48);
    for (const id of ["sway", "shake", "bounce", "gaming", "glitch", "neon", "sleepy", "stagger", "static"]) {
      expect(isAnimationId(id)).toBe(true);
    }
  });

  it("every entry has a valid category and at least one tag", () => {
    const cats = new Set(ANIMATION_CATEGORIES.map((c) => c.id));
    for (const a of ANIMATION_CATALOG) {
      expect(cats.has(a.category), a.id).toBe(true);
      expect(a.tags.length, a.id).toBeGreaterThan(0);
      expect(/^[a-z0-9-]+$/.test(a.id), a.id).toBe(true);
    }
  });

  it("representative preview frames are within 0..19", () => {
    for (const a of ANIMATION_CATALOG) {
      const f = (a as { previewFrame?: number }).previewFrame ?? 0;
      expect(Number.isInteger(f) && f >= 0 && f < 20, a.id).toBe(true);
    }
  });

  it("trial animations are bounce and shake only", () => {
    expect([...TRIAL_ANIMATION_IDS].sort()).toEqual(["bounce", "shake"]);
  });

  it("filterAnimations: category, favorites, and query (label / tag / id / category label, NFKC)", () => {
    expect(filterAnimations({ category: "all" })).toHaveLength(100);
    expect(filterAnimations({ category: "reaction" }).every((a) => a.category === "reaction")).toBe(true);
    const fav = new Set(["bow", "crown"]);
    expect(filterAnimations({ category: "favorites", favorites: fav }).map((a) => a.id).sort()).toEqual(["bow", "crown"]);
    expect(filterAnimations({ query: "おじぎ" }).map((a) => a.id)).toEqual(["bow"]);
    expect(filterAnimations({ query: "BOW" }).map((a) => a.id)).toContain("bow");
    expect(filterAnimations({ query: "？" }).map((a) => a.id)).toContain("question"); // full-width → NFKC
    expect(filterAnimations({ query: "リアクション" }).length).toBeGreaterThan(5);
    expect(filterAnimations({ query: "zzz-nothing" })).toHaveLength(0);
  });
});
