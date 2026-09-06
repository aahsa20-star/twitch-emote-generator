"use client";

import { STUDIO_STEPS, canEnterStep, type StepContext, type StudioStep } from "@/lib/ui/steps";

interface StepNavProps {
  current: StudioStep;
  context: StepContext;
  onSelect: (step: StudioStep) => void;
  /** Called with the reason when a step cannot be entered yet. */
  onBlocked: (reason: string) => void;
}

/**
 * 作成の流れ (09 §設計方針 2). Plain buttons with aria-current; a step that is
 * not available yet stays clickable and explains why (no silent no-op).
 */
export default function StepNav({ current, context, onSelect, onBlocked }: StepNavProps) {
  return (
    <nav aria-label="作成の流れ" className="max-w-[720px] mx-auto my-5 md:my-6 px-1">
      <ol className="flex items-center gap-2 md:gap-4">
        {STUDIO_STEPS.map((s, i) => {
          const avail = canEnterStep(s.id, context);
          const isCurrent = s.id === current;
          const done = s.id < current;
          return (
            <li key={s.id} className={`flex items-center min-w-0 ${i < STUDIO_STEPS.length - 1 ? "flex-1" : ""}`}>
              <button
                type="button"
                onClick={() => (avail.ok ? onSelect(s.id) : onBlocked(avail.reason))}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={avail.ok ? undefined : true}
                className={`flex flex-col md:flex-row items-center gap-1.5 md:gap-2 min-h-[44px] min-w-[54px] px-1 text-[10px] md:text-[12px] whitespace-nowrap transition-colors ${
                  isCurrent ? "text-studio-text font-bold" : avail.ok ? "text-[#92939e] hover:text-studio-text" : "text-[#5e5e69]"
                }`}
              >
                <span
                  aria-hidden
                  className={`w-[23px] h-[23px] rounded-full grid place-items-center text-[10px] border ${
                    isCurrent
                      ? "bg-studio-accent text-studio-accent-ink border-studio-accent"
                      : done
                        ? "text-studio-accent border-[#736386]"
                        : "border-[#51505c]"
                  }`}
                >
                  {done ? "✓" : s.id}
                </span>
                <span>{s.label}</span>
              </button>
              {i < STUDIO_STEPS.length - 1 && <span aria-hidden className="flex-1 h-px bg-[#39373e] mx-1 md:mx-2 -mt-4 md:mt-0" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
