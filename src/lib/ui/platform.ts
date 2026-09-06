"use client";

import { useSyncExternalStore } from "react";

/** iOS / iPadOS detection (touch Macs report as MacIntel with touch points). */
export function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

const subscribe = () => () => {};

/**
 * Hydration-safe iOS flag: the server and the first client render agree
 * (false), the real value applies right after hydration. Used for the two-tap
 * save flow labels (09 §4 iOS).
 */
export function useIsIOS(): boolean {
  return useSyncExternalStore(subscribe, detectIOS, () => false);
}
