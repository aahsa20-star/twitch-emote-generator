/**
 * The four studio steps (09 §設計方針 2): 画像を選ぶ / 画像を整える / 編集する /
 * 保存する. Pure helpers — no DOM — so the navigation rules are unit-testable.
 *
 * Moving between steps never resets editor state; a step is only *unavailable*
 * (with a reason) when the input it needs does not exist yet.
 */

export type StudioStep = 1 | 2 | 3 | 4;

export const STUDIO_STEPS: ReadonlyArray<{ id: StudioStep; label: string; eyebrow: string }> = [
  { id: 1, label: "画像を選ぶ", eyebrow: "01 / START WITH AN IMAGE" },
  { id: 2, label: "画像を整える", eyebrow: "02 / PREPARE" },
  { id: 3, label: "編集する", eyebrow: "03 / MAKE IT YOURS" },
  { id: 4, label: "保存する", eyebrow: "04 / READY TO REACT" },
];

export type SourceKind = "image" | "gif" | "video";

export interface StepContext {
  /** A confirmed source (image / GIF / video) exists — the editor has something to work on. */
  hasSource: boolean;
  sourceKind: SourceKind | null;
  /** A picked file is still waiting for 「この範囲で使う」/「調整せず使う」/ trim (12 §3). */
  pendingCandidate?: boolean;
}

export type StepAvailability = { ok: true } | { ok: false; reason: string };

export function canEnterStep(step: StudioStep, ctx: StepContext): StepAvailability {
  if (step === 1) return { ok: true };
  if (step === 2 && ctx.pendingCandidate) return { ok: true };
  if (ctx.pendingCandidate) {
    return { ok: false, reason: "「画像を整える」で「この範囲で使う」か「調整せず使う」を選ぶと進めます。" };
  }
  if (!ctx.hasSource) {
    return { ok: false, reason: "先に画像を選ぶか、サンプルで試してください。" };
  }
  if (step === 2 && ctx.sourceKind === "gif") {
    return { ok: false, reason: "GIF はそのままの動きを使うため、位置の調整はありません。" };
  }
  return { ok: true };
}

/** Which step a freshly accepted source should open. */
export function stepAfterSelect(kind: SourceKind): StudioStep {
  // GIFs are their own animation and go straight to editing; images and
  // videos need a preparation step (crop / trim) first.
  return kind === "gif" ? 3 : 2;
}
