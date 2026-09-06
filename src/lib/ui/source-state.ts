/**
 * Selected vs confirmed source (12 §3). The *confirmed* source is what the
 * editor and the save screen work on; a *candidate* is a file that has been
 * picked but not yet adjusted / trimmed / validated. Cancelling a candidate
 * restores the confirmed work untouched. Pure reducer — no DOM.
 */
import type { SourceKind } from "./steps";

export interface AdjustLike {
  zoom: number;
  offset: { x: number; y: number };
  crop: { x: number; y: number; w: number; h: number };
}

export interface ConfirmedSource<F = File> {
  kind: SourceKind;
  /** Display name (never changes until a candidate is adopted). */
  name: string;
  /** What the processing hook receives. */
  file: F;
  /** Raw upload: images re-adjust from it, videos re-trim from it. */
  original: F;
  adjust: AdjustLike | null;
}

export interface CandidateSource<F = File> {
  kind: SourceKind;
  name: string;
  file: F;
}

export interface SourceState<F = File> {
  confirmed: ConfirmedSource<F> | null;
  candidate: CandidateSource<F> | null;
}

export type SourceAction<F = File> =
  | { type: "select"; candidate: CandidateSource<F> }
  /** Adopt the candidate (or re-adjust the confirmed source when there is none). */
  | { type: "confirm"; file: F; adjust: AdjustLike | null }
  /** Drop the candidate; the confirmed work stays. */
  | { type: "cancel" }
  | { type: "clear" };

export const EMPTY_SOURCE: SourceState<never> = { confirmed: null, candidate: null };

export function sourceReducer<F>(state: SourceState<F>, action: SourceAction<F>): SourceState<F> {
  switch (action.type) {
    case "select":
      return { ...state, candidate: action.candidate };
    case "confirm": {
      if (state.candidate) {
        const c = state.candidate;
        return { confirmed: { kind: c.kind, name: c.name, file: action.file, original: c.file, adjust: action.adjust }, candidate: null };
      }
      if (!state.confirmed) return state;
      return { ...state, confirmed: { ...state.confirmed, file: action.file, adjust: action.adjust } };
    }
    case "cancel":
      return { ...state, candidate: null };
    case "clear":
      return { confirmed: null, candidate: null };
  }
}

/** What step 2 works on: the candidate if one is pending, else the confirmed source. */
export function adjustTarget<F>(state: SourceState<F>): { file: F; kind: SourceKind; name: string; adjust: AdjustLike | null; isCandidate: boolean } | null {
  if (state.candidate) return { file: state.candidate.file, kind: state.candidate.kind, name: state.candidate.name, adjust: null, isCandidate: true };
  if (state.confirmed) return { file: state.confirmed.original, kind: state.confirmed.kind, name: state.confirmed.name, adjust: state.confirmed.adjust, isCandidate: false };
  return null;
}
