/**
 * Save readiness (12 §1): outputs are only saveable when the generation that
 * produced them is the one currently requested. Keys that bind iOS "prepared"
 * state, pending permission checks and result lines to the outputs.
 */
import type { ProcessingStage } from "@/types/emote";
import type { ExportPlan, ExportPlanFile } from "./export-plan";

export interface OutputStatus {
  /** Generation of the inputs currently shown / requested. */
  requestedGen: number;
  /** Generation whose outputs succeeded (null = nothing yet). */
  outputGen: number | null;
  /** Generation whose render failed (null = none). */
  failedGen: number | null;
  stage: ProcessingStage;
  variantCount: number;
}

export type OutputCondition = "current" | "updating" | "failed" | "none";

export function outputCondition(s: OutputStatus): OutputCondition {
  if (s.failedGen === s.requestedGen) return "failed";
  if (s.outputGen === s.requestedGen && s.stage === "ready" && s.variantCount > 0) return "current";
  if (s.variantCount === 0 && s.stage === "idle") return "none";
  return "updating";
}

/** Identity of a save plan for one output generation. */
export function savePlanKey(plan: Pick<ExportPlan, "platform" | "assetType" | "format">, outputGen: number | null, files: readonly ExportPlanFile[] = []): string {
  return `${plan.platform}:${plan.assetType}:${plan.format}:g${outputGen ?? "-"}:${files.map((f) => f.size + (f.available ? "" : "!")).join(",")}`;
}

export function canSaveFile(file: ExportPlanFile, cond: OutputCondition): boolean {
  return cond === "current" && file.available;
}

/** Every listed file must exist — never "some" (12 §1). */
export function canSaveAll(plan: Pick<ExportPlan, "files">, cond: OutputCondition): boolean {
  return cond === "current" && plan.files.length > 0 && plan.files.every((f) => f.available);
}
