import { describe, expect, it } from "vitest";
import { ANIMATION_LIST, isAnimationId, type AnimationId } from "./catalog";
import { RECOMMENDED_ANIMATION_IDS, resolvePicker } from "./picker";

const none = new Set<AnimationId>();

describe("animation picker scopes", () => {
  it("recommended ids exist in the catalog and keep their order", () => {
    expect(RECOMMENDED_ANIMATION_IDS).toHaveLength(12);
    for (const id of RECOMMENDED_ANIMATION_IDS) expect(isAnimationId(id)).toBe(true);
    const r = resolvePicker({ mode: "recommended", query: "", category: "all", favorites: none });
    expect(r.entries.map((e) => e.id)).toEqual([...RECOMMENDED_ANIMATION_IDS]);
    expect(r.scope).toBe("recommended");
    expect(r.widenedToAll).toBe(false);
    expect(r.summary).toBe("おすすめ 12 種類");
  });

  it("a search on おすすめ searches all 100 and says so", () => {
    // "bow" is not recommended; it must still be found.
    const r = resolvePicker({ mode: "recommended", query: "bow", category: "all", favorites: none });
    expect(r.scope).toBe("all");
    expect(r.widenedToAll).toBe(true);
    expect(r.entries.some((e) => e.id === "bow")).toBe(true);
    expect(r.summary).toContain(`全 ${ANIMATION_LIST.length} 種類`);
  });

  it("a category on おすすめ widens to all of that category", () => {
    const r = resolvePicker({ mode: "recommended", query: "", category: "scene", favorites: none });
    expect(r.scope).toBe("all");
    expect(r.entries.length).toBeGreaterThan(0);
    expect(r.entries.every((e) => e.category === "scene")).toBe(true);
  });

  it("a search on お気に入り stays inside favorites", () => {
    const favorites = new Set<AnimationId>(["hearts", "bow"]);
    const r = resolvePicker({ mode: "favorites", query: "ハート", category: "all", favorites });
    expect(r.scope).toBe("favorites");
    expect(r.entries.map((e) => e.id)).toEqual(["hearts"]);
    const miss = resolvePicker({ mode: "favorites", query: "sakura", category: "all", favorites });
    expect(miss.entries).toHaveLength(0);
  });

  it("すべて lists the full catalog", () => {
    const r = resolvePicker({ mode: "all", query: "", category: "all", favorites: none });
    expect(r.entries).toHaveLength(ANIMATION_LIST.length);
    expect(r.summary).toBe(`すべて ${ANIMATION_LIST.length} 種類`);
  });
});
