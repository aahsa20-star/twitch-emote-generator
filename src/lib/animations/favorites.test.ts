import { describe, expect, it } from "vitest";
import { FAVORITES_KEY, MAX_FAVORITES, loadFavorites, parseFavorites, saveFavorites } from "./favorites";

describe("favorites storage (端末内・破損耐性)", () => {
  it("parses v1 payloads and legacy arrays, dropping unknown ids", () => {
    expect([...parseFavorites(JSON.stringify({ v: 1, ids: ["bow", "nope", "crown"] }))]).toEqual(["bow", "crown"]);
    expect([...parseFavorites(JSON.stringify(["shake", 42, null, "ai-custom"]))]).toEqual(["shake"]);
  });

  it("never throws on garbage", () => {
    for (const raw of ["{", "null", "", 123, { v: 9, ids: "bow" }, [[]], undefined]) {
      expect(parseFavorites(raw).size).toBe(0);
    }
  });

  it("caps the number of favorites", () => {
    const many = Array.from({ length: 300 }, () => "bow");
    expect(parseFavorites(many).size).toBe(1);
    expect(MAX_FAVORITES).toBe(100);
  });

  it("round-trips through a storage-like object and tolerates failing storage", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    saveFavorites(new Set(["bow", "orbit"]), storage);
    expect(mem.get(FAVORITES_KEY)).toContain("bow");
    expect([...loadFavorites(storage)]).toEqual(["bow", "orbit"]);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } };
    expect(loadFavorites(broken).size).toBe(0);
    expect(() => saveFavorites(new Set(["bow"]), broken)).not.toThrow();
  });
});
