/**
 * Animation picker scopes (09 §アニメーション選択): おすすめ 12 / すべて / お気に入り.
 * Pure resolution of "which entries are listed and what scope is really being
 * searched" so the UI can label it honestly.
 *
 * - A search typed while on おすすめ searches all 100 (never "not in the
 *   recommended set, so not found").
 * - A category chosen while on おすすめ also widens to all.
 * - A search on お気に入り stays inside favorites; the UI offers a "search all"
 *   escape hatch when nothing matches.
 */
import { ANIMATION_LIST, filterAnimations, type AnimationCategory, type AnimationId, type CatalogEntry } from "./catalog";

export const RECOMMENDED_ANIMATION_IDS = [
  "bounce", "sway", "hearts", "shake", "float", "spin",
  "jelly", "gaming", "angry", "cry", "blush", "surprise",
] as const satisfies readonly AnimationId[];

export type PickerMode = "recommended" | "all" | "favorites";

export interface PickerInput {
  mode: PickerMode;
  query: string;
  category: AnimationCategory | "all";
  favorites: ReadonlySet<AnimationId>;
}

export interface PickerResult {
  entries: CatalogEntry[];
  /** Scope that was actually listed (may differ from `mode`, see above). */
  scope: PickerMode;
  /** True when the user's おすすめ view was widened to all 100 by a search / category. */
  widenedToAll: boolean;
  /** Short label for the result line, e.g. 「検索結果 3 種類（全 100 種類から）」. */
  summary: string;
}

export function isRecommended(id: string): boolean {
  return (RECOMMENDED_ANIMATION_IDS as readonly string[]).includes(id);
}

export function resolvePicker(input: PickerInput): PickerResult {
  const query = input.query.trim();
  const hasQuery = query.length > 0;
  const hasCategory = input.category !== "all";

  let scope: PickerMode = input.mode;
  let widenedToAll = false;
  if (input.mode === "recommended" && (hasQuery || hasCategory)) {
    scope = "all";
    widenedToAll = true;
  }

  let entries: CatalogEntry[];
  if (scope === "recommended") {
    const order = new Map<string, number>(RECOMMENDED_ANIMATION_IDS.map((id, i) => [id, i]));
    entries = ANIMATION_LIST.filter((a) => order.has(a.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  } else if (scope === "favorites") {
    entries = filterAnimations({ query, category: "favorites", favorites: input.favorites });
    if (hasCategory) entries = entries.filter((a) => a.category === input.category);
  } else {
    entries = filterAnimations({ query, category: input.category });
  }

  const n = entries.length;
  let summary: string;
  if (hasQuery) {
    summary = scope === "favorites" ? `お気に入りから ${n} 種類` : `検索結果 ${n} 種類（全 ${ANIMATION_LIST.length} 種類から）`;
  } else if (scope === "recommended") {
    summary = `おすすめ ${n} 種類`;
  } else if (scope === "favorites") {
    summary = `お気に入り ${n} 種類`;
  } else if (hasCategory) {
    summary = `この分類 ${n} 種類（全 ${ANIMATION_LIST.length} 種類から）`;
  } else {
    summary = `すべて ${n} 種類`;
  }

  return { entries, scope, widenedToAll, summary };
}
