/**
 * Guarded save (13 §1): a save that started for one request must not deliver
 * after the request changed — even when the destination / format are the same
 * and only the text, the animation or the badge settings moved. Every await
 * (permission API, ZIP build) is followed by the same validity check.
 */

export type SaveFlowResult = "delivered" | "denied" | "aborted" | "failed";

export interface SaveFlowDeps<T> {
  /** Permission check (server). Resolves true when the save may proceed. */
  gate: () => Promise<boolean>;
  /**
   * True while the request this save was started for is still the current one
   * AND its outputs are current (not updating / failed). Evaluated after every
   * asynchronous step.
   */
  isStillValid: () => boolean;
  /** Optional asynchronous preparation (ZIP build). */
  prepare?: () => Promise<T>;
  /** Synchronous delivery (anchor download / window.open). */
  deliver: (prepared: T | undefined) => void;
  onAborted?: () => void;
}

export async function runGuardedSave<T = undefined>(deps: SaveFlowDeps<T>): Promise<SaveFlowResult> {
  if (!deps.isStillValid()) {
    deps.onAborted?.();
    return "aborted";
  }
  const allowed = await deps.gate();
  if (!allowed) return "denied";
  if (!deps.isStillValid()) {
    deps.onAborted?.();
    return "aborted";
  }
  let prepared: T | undefined;
  if (deps.prepare) {
    try {
      prepared = await deps.prepare();
    } catch {
      return "failed";
    }
    if (!deps.isStillValid()) {
      deps.onAborted?.();
      return "aborted";
    }
  }
  deps.deliver(prepared);
  return "delivered";
}

/**
 * Selection sequence (13 §2): every pick (image / GIF / video / sample) and
 * every cancel / reset advances the number; an asynchronous validation may
 * adopt its file only if its number is still the latest.
 */
export interface SelectionSequence {
  next(): number;
  current(): number;
  isCurrent(n: number): boolean;
}

export function createSelectionSequence(): SelectionSequence {
  let n = 0;
  return {
    next: () => ++n,
    current: () => n,
    isCurrent: (v) => v === n,
  };
}
