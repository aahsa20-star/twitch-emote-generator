/**
 * Favorite animations — stored in the browser only (localStorage), never sent
 * to the server. Robust against corrupt / unknown / legacy data (04 指示).
 */
import { isAnimationId, type AnimationId } from "./catalog";

export const FAVORITES_KEY = "emote-animation-favorites-v1";
export const MAX_FAVORITES = 100;

interface Stored {
  v: 1;
  ids: string[];
}

/** Parse any stored value into a clean set of known ids. Never throws. */
export function parseFavorites(raw: unknown): Set<AnimationId> {
  const out = new Set<AnimationId>();
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return out;
    }
  }
  if (list && typeof list === "object" && !Array.isArray(list)) {
    list = (list as Partial<Stored>).ids;
  }
  if (!Array.isArray(list)) return out;
  for (const id of list) {
    if (out.size >= MAX_FAVORITES) break;
    if (isAnimationId(id)) out.add(id);
  }
  return out;
}

export function loadFavorites(storage: Pick<Storage, "getItem"> | null | undefined = safeStorage()): Set<AnimationId> {
  try {
    return parseFavorites(storage?.getItem(FAVORITES_KEY));
  } catch {
    return new Set();
  }
}

export function saveFavorites(ids: ReadonlySet<AnimationId>, storage: Pick<Storage, "setItem"> | null | undefined = safeStorage()): void {
  try {
    const payload: Stored = { v: 1, ids: [...ids].slice(0, MAX_FAVORITES) };
    storage?.setItem(FAVORITES_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode: favorites stay in memory only
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}
